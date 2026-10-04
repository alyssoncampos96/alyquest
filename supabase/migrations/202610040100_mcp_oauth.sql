begin;
alter table public.aq_integration_tokens add column if not exists expires_at timestamptz;
alter table public.aq_integration_tokens add column if not exists oauth_client_id uuid;
alter table public.aq_integration_tokens add column if not exists oauth_resource text;
create table if not exists public.aq_mcp_oauth_clients (
 id uuid primary key default gen_random_uuid(), name text not null,
 redirect_uris text[] not null, secret_hash text, created_at timestamptz not null default now()
);
create table if not exists public.aq_mcp_oauth_codes (
 code_hash text primary key, user_id uuid not null references auth.users(id) on delete cascade,
 client_id uuid not null references public.aq_mcp_oauth_clients(id), redirect_uri text not null,
 challenge text not null, expires_at timestamptz not null default now()+interval '5 minutes'
);
create table if not exists public.aq_mcp_oauth_sessions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 client_id uuid not null references public.aq_mcp_oauth_clients(id), refresh_hash text not null unique,
 access_id uuid not null references public.aq_integration_tokens(id),
 expires_at timestamptz not null default now()+interval '90 days', revoked boolean not null default false,
 created_at timestamptz not null default now()
);
alter table public.aq_mcp_oauth_clients enable row level security;
alter table public.aq_mcp_oauth_codes enable row level security;
alter table public.aq_mcp_oauth_sessions enable row level security;
revoke all on public.aq_mcp_oauth_clients,public.aq_mcp_oauth_codes,public.aq_mcp_oauth_sessions from public,anon,authenticated;

create or replace function public.aq_mcp_register_client(p_name text,p_redirects text[],p_secret text default null) returns uuid language plpgsql security definer set search_path='' as $$
declare rid uuid; uri text;
begin
 if length(p_name) not between 1 and 80 or cardinality(p_redirects) not between 1 and 5 then raise exception 'invalid_client_metadata'; end if;
 foreach uri in array p_redirects loop
  if uri !~ '^https://chatgpt\.com/(connector_platform_oauth_redirect|connector/oauth/[A-Za-z0-9_-]+)$' then raise exception 'invalid_redirect_uri'; end if;
 end loop;
 if (select count(*) from public.aq_mcp_oauth_clients where created_at>now()-interval '1 hour')>100 then raise exception 'registration_limit'; end if;
 if p_secret is not null and length(p_secret)<32 then raise exception 'invalid_client_metadata'; end if;
 insert into public.aq_mcp_oauth_clients(name,redirect_uris,secret_hash) values(p_name,p_redirects,case when p_secret is null then null else encode(extensions.digest(p_secret,'sha256'),'hex') end) returning id into rid;
 return rid;
end $$;
create or replace function public.aq_mcp_client(p_client uuid,p_redirect text) returns jsonb language sql security definer set search_path='' as $$
 select jsonb_build_object('name',name) from public.aq_mcp_oauth_clients where id=p_client and p_redirect=any(redirect_uris);
$$;
create or replace function public.aq_mcp_authorize(p_client uuid,p_redirect text,p_challenge text,p_code text) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or p_challenge !~ '^[A-Za-z0-9_-]{43}$' or length(p_code)<32 or public.aq_mcp_client(p_client,p_redirect) is null then raise exception 'invalid_request'; end if;
 delete from public.aq_mcp_oauth_codes where expires_at<now();
 insert into public.aq_mcp_oauth_codes(code_hash,user_id,client_id,redirect_uri,challenge) values(encode(extensions.digest(p_code,'sha256'),'hex'),auth.uid(),p_client,p_redirect,p_challenge);
end $$;
create or replace function public.aq_mcp_exchange(p_grant text,p_client uuid,p_secret text,p_credential text,p_redirect text,p_challenge text,p_access text,p_refresh text,p_resource text) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.aq_mcp_oauth_clients%rowtype; g public.aq_mcp_oauth_codes%rowtype; s public.aq_mcp_oauth_sessions%rowtype; uid uuid; aid uuid;
begin
 if p_resource is distinct from 'https://alyquestv3.vercel.app/api/mcp' or length(p_access)<32 or length(p_refresh)<32 or length(p_credential)<32 then raise exception 'invalid_grant'; end if;
 select * into c from public.aq_mcp_oauth_clients where id=p_client;
 if not found or (c.secret_hash is not null and c.secret_hash is distinct from encode(extensions.digest(coalesce(p_secret,''),'sha256'),'hex')) then raise exception 'invalid_client'; end if;
 if p_grant='authorization_code' then
  select * into g from public.aq_mcp_oauth_codes where code_hash=encode(extensions.digest(p_credential,'sha256'),'hex') for update;
  if not found or g.expires_at<=now() or g.client_id<>p_client or g.redirect_uri is distinct from p_redirect or g.challenge is distinct from p_challenge then raise exception 'invalid_grant'; end if;
  uid:=g.user_id;
  delete from public.aq_mcp_oauth_codes where code_hash=g.code_hash;
 elsif p_grant='refresh_token' then
  select * into s from public.aq_mcp_oauth_sessions where refresh_hash=encode(extensions.digest(p_credential,'sha256'),'hex') for update;
  if not found or s.revoked or s.expires_at<=now() or s.client_id<>p_client then raise exception 'invalid_grant'; end if;
  uid:=s.user_id;
  update public.aq_integration_tokens set active=false where id=s.access_id;
 else raise exception 'unsupported_grant_type'; end if;
 insert into public.aq_integration_tokens(user_id,name,token_hash,last4,expires_at,oauth_client_id,oauth_resource) values(uid,'ChatGPT · '||left(c.name,60),encode(extensions.digest(p_access,'sha256'),'hex'),right(p_access,4),now()+interval '1 hour',p_client,p_resource) returning id into aid;
 if p_grant='refresh_token' then
  update public.aq_mcp_oauth_sessions set refresh_hash=encode(extensions.digest(p_refresh,'sha256'),'hex'),access_id=aid where id=s.id;
 else
  insert into public.aq_mcp_oauth_sessions(user_id,client_id,refresh_hash,access_id) values(uid,p_client,encode(extensions.digest(p_refresh,'sha256'),'hex'),aid);
 end if;
 return jsonb_build_object('ok',true);
end $$;
create or replace function public.aq_mcp_connections() returns jsonb language sql security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'name',c.name,'active',not s.revoked and s.expires_at>now(),'created_at',s.created_at)),'[]'::jsonb) from public.aq_mcp_oauth_sessions s join public.aq_mcp_oauth_clients c on c.id=s.client_id where s.user_id=auth.uid();
$$;
create or replace function public.aq_mcp_revoke(p_session uuid) returns void language plpgsql security definer set search_path='' as $$
declare aid uuid;
begin
 update public.aq_mcp_oauth_sessions set revoked=true where id=p_session and user_id=auth.uid() returning access_id into aid;
 if aid is not null then update public.aq_integration_tokens set active=false where id=aid; end if;
end $$;
create or replace function public.aq_gpt_token_user(p_token text) returns uuid language plpgsql security definer set search_path='' as $$
declare token_row public.aq_integration_tokens%rowtype;
begin
 select * into token_row from public.aq_integration_tokens where token_hash=encode(extensions.digest(trim(coalesce(p_token,'')),'sha256'),'hex') and active and (expires_at is null or expires_at>now()) and (oauth_resource is null or oauth_resource='https://alyquestv3.vercel.app/api/mcp') for update;
 if not found then raise exception 'Token inválido'; end if;
 update public.aq_integration_tokens set last_used_at=now() where id=token_row.id;
 return token_row.user_id;
end $$;
-- This older finance RPC performed its own token lookup. Use the shared validator
-- so OAuth expiration/revocation applies to every GPT operation.
create or replace function public.aq_gpt_add_finance_transaction(p_token text,p_title text,p_amount numeric,p_kind text,p_category text,p_occurred_on date,p_payment_method text,p_installments int,p_notes text) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid; tx uuid;
begin
 uid:=public.aq_gpt_token_user(p_token);
 perform set_config('request.jwt.claim.sub',uid::text,true);
 tx:=public.aq_finance_add_transaction(p_title,p_amount,coalesce(p_kind,'expense'),coalesce(p_category,'Outros'),p_occurred_on,coalesce(p_payment_method,'other'),null,coalesce(p_installments,1),coalesce(p_notes,''),'gpt');
 return jsonb_build_object('id',tx,'status','registered');
end $$;
revoke all on function public.aq_mcp_register_client(text,text[],text),public.aq_mcp_client(uuid,text),public.aq_mcp_authorize(uuid,text,text,text),public.aq_mcp_exchange(text,uuid,text,text,text,text,text,text,text),public.aq_mcp_connections(),public.aq_mcp_revoke(uuid) from public,anon,authenticated;
grant execute on function public.aq_mcp_register_client(text,text[],text),public.aq_mcp_client(uuid,text),public.aq_mcp_exchange(text,uuid,text,text,text,text,text,text,text) to anon,authenticated;
grant execute on function public.aq_mcp_authorize(uuid,text,text,text),public.aq_mcp_connections(),public.aq_mcp_revoke(uuid) to authenticated;
commit;
