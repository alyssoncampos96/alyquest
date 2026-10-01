begin;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.aq_finance_cards (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 name text not null check(length(trim(name)) between 1 and 80),
 closing_day int check(closing_day between 1 and 31),
 due_day int check(due_day between 1 and 31),
 created_at timestamptz not null default now()
);

create table if not exists public.aq_finance_transactions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 title text not null check(length(trim(title)) between 1 and 180),
 amount numeric not null check(amount > 0 and amount <= 100000000),
 kind text not null default 'expense' check(kind in ('expense','income')),
 category text not null default 'Outros' check(length(trim(category)) between 1 and 80),
 occurred_on date not null,
 payment_method text not null default 'cash' check(payment_method in ('cash','pix','debit','credit','bank_transfer','other')),
 card_id uuid references public.aq_finance_cards(id) on delete set null,
 installment_parent_id uuid references public.aq_finance_transactions(id) on delete cascade,
 installment_number int not null default 1 check(installment_number > 0 and installment_number <= 120),
 installment_count int not null default 1 check(installment_count > 0 and installment_count <= 120),
 notes text not null default '' check(length(notes) <= 1000),
 source text not null default 'manual' check(source in ('manual','gpt')),
 created_at timestamptz not null default now()
);

create table if not exists public.aq_fasting_sessions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 started_at timestamptz not null,
 ended_at timestamptz,
 status text not null default 'active' check(status in ('active','completed','cancelled')),
 reward_units int not null default 0 check(reward_units >= 0 and reward_units <= 1000),
 notes text not null default '' check(length(notes) <= 1000),
 created_at timestamptz not null default now()
);

create table if not exists public.aq_integration_tokens (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 name text not null check(length(trim(name)) between 1 and 80),
 token_hash text not null unique,
 last4 text not null,
 active boolean not null default true,
 last_used_at timestamptz,
 created_at timestamptz not null default now()
);

create table if not exists public.aq_achievement_claims (
 user_id uuid not null references auth.users(id) on delete cascade,
 code text not null,
 reward_xp numeric not null default 0,
 reward_coins numeric not null default 0,
 claimed_at timestamptz not null default now(),
 primary key(user_id, code)
);

create index if not exists aq_finance_cards_owner on public.aq_finance_cards(user_id);
create index if not exists aq_finance_transactions_owner_date on public.aq_finance_transactions(user_id, occurred_on desc);
create index if not exists aq_fasting_sessions_owner_date on public.aq_fasting_sessions(user_id, started_at desc);
create index if not exists aq_integration_tokens_owner on public.aq_integration_tokens(user_id);

alter table public.aq_finance_cards enable row level security;
alter table public.aq_finance_transactions enable row level security;
alter table public.aq_fasting_sessions enable row level security;
alter table public.aq_integration_tokens enable row level security;
alter table public.aq_achievement_claims enable row level security;

drop policy if exists own_finance_cards on public.aq_finance_cards;
drop policy if exists own_finance_transactions on public.aq_finance_transactions;
drop policy if exists own_fasting_sessions on public.aq_fasting_sessions;
drop policy if exists own_integration_tokens on public.aq_integration_tokens;
drop policy if exists own_achievement_claims on public.aq_achievement_claims;

create policy own_finance_cards on public.aq_finance_cards for select to authenticated using(user_id=(select auth.uid()));
create policy own_finance_transactions on public.aq_finance_transactions for select to authenticated using(user_id=(select auth.uid()));
create policy own_fasting_sessions on public.aq_fasting_sessions for select to authenticated using(user_id=(select auth.uid()));
create policy own_integration_tokens on public.aq_integration_tokens for select to authenticated using(user_id=(select auth.uid()));
create policy own_achievement_claims on public.aq_achievement_claims for select to authenticated using(user_id=(select auth.uid()));

revoke all on public.aq_finance_cards, public.aq_finance_transactions, public.aq_fasting_sessions, public.aq_integration_tokens, public.aq_achievement_claims from anon, authenticated;
grant select on public.aq_finance_cards, public.aq_finance_transactions, public.aq_fasting_sessions, public.aq_integration_tokens, public.aq_achievement_claims to authenticated;

create or replace function public.aq_finance_save_card(p_id uuid,p_name text,p_closing_day int,p_due_day int) returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); result uuid;
begin
 if uid is null then raise exception 'Não autenticado'; end if;
 if p_name is null or length(trim(p_name)) not between 1 and 80 or (p_closing_day is not null and p_closing_day not between 1 and 31) or (p_due_day is not null and p_due_day not between 1 and 31) then raise exception 'Confira os dados do cartão'; end if;
 if p_id is null then
  insert into public.aq_finance_cards(user_id,name,closing_day,due_day) values(uid,trim(p_name),p_closing_day,p_due_day) returning id into result;
 else
  update public.aq_finance_cards set name=trim(p_name),closing_day=p_closing_day,due_day=p_due_day where id=p_id and user_id=uid returning id into result;
  if result is null then raise exception 'Cartão indisponível'; end if;
 end if;
 return result;
end $$;

create or replace function public.aq_finance_add_transaction(p_title text,p_amount numeric,p_kind text,p_category text,p_occurred_on date,p_payment_method text,p_card_id uuid,p_installments int,p_notes text,p_source text default 'manual') returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); parent_id uuid; item_id uuid; each_amount numeric; i int; clean_count int:=coalesce(p_installments,1);
begin
 if uid is null then raise exception 'Não autenticado'; end if;
 if p_title is null or length(trim(p_title)) not between 1 and 180 or p_amount is null or p_amount<=0 or p_amount>100000000 or p_kind not in ('expense','income') or p_payment_method not in ('cash','pix','debit','credit','bank_transfer','other') or p_occurred_on is null or clean_count not between 1 and 120 or p_source not in ('manual','gpt') then raise exception 'Confira os dados do lançamento'; end if;
 if p_card_id is not null and not exists(select 1 from public.aq_finance_cards where id=p_card_id and user_id=uid) then raise exception 'Cartão indisponível'; end if;
 each_amount:=round((p_amount/clean_count)::numeric,2);
 for i in 1..clean_count loop
  insert into public.aq_finance_transactions(user_id,title,amount,kind,category,occurred_on,payment_method,card_id,installment_parent_id,installment_number,installment_count,notes,source)
  values(uid,trim(p_title),case when i=clean_count then p_amount-(each_amount*(clean_count-1)) else each_amount end,p_kind,trim(coalesce(nullif(p_category,''),'Outros')),p_occurred_on + ((i-1) || ' months')::interval,p_payment_method,p_card_id,parent_id,i,clean_count,coalesce(p_notes,''),p_source)
  returning id into item_id;
  if i=1 then parent_id:=item_id; end if;
 end loop;
 return parent_id;
end $$;

create or replace function public.aq_fasting_finish(p_session_id uuid,p_started_at timestamptz,p_ended_at timestamptz,p_notes text) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); sid uuid:=coalesce(p_session_id,gen_random_uuid()); session public.aq_fasting_sessions%rowtype; units int; hours numeric;
begin
 if uid is null then raise exception 'Não autenticado'; end if;
 if p_started_at is null or p_ended_at is null or p_ended_at <= p_started_at or p_ended_at > now() + interval '1 day' or p_started_at < now() - interval '45 days' then raise exception 'Confira início e fim do jejum'; end if;
 perform pg_advisory_xact_lock(hashtextextended(sid::text,0));
 select * into session from public.aq_fasting_sessions where id=sid for update;
 if found and session.user_id<>uid then raise exception 'Sessão indisponível'; end if;
 if found and session.status='completed' then return jsonb_build_object('id',session.id,'xp',0,'coins',0,'reward_units',session.reward_units); end if;
 hours:=extract(epoch from (p_ended_at-p_started_at))/3600;
 units:=floor(hours/4);
 if found then
  update public.aq_fasting_sessions set started_at=p_started_at,ended_at=p_ended_at,status='completed',reward_units=units,notes=coalesce(p_notes,'') where id=sid;
 else
  insert into public.aq_fasting_sessions(id,user_id,started_at,ended_at,status,reward_units,notes) values(sid,uid,p_started_at,p_ended_at,'completed',units,coalesce(p_notes,''));
 end if;
 if units>0 then
  insert into public.xp_transactions(user_id,amount,reason,reference_id) values(uid,units,'Jejum',sid);
  insert into public.coin_transactions(user_id,amount,reason,reference_id) values(uid,units,'Jejum',sid);
 end if;
 return jsonb_build_object('id',sid,'xp',units,'coins',units,'reward_units',units);
end $$;

create or replace function public.aq_integration_create_token(p_name text,p_token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); clean text:=trim(coalesce(p_token,'')); result public.aq_integration_tokens%rowtype;
begin
 if uid is null then raise exception 'Não autenticado'; end if;
 if p_name is null or length(trim(p_name)) not between 1 and 80 or length(clean) < 32 then raise exception 'Token inválido'; end if;
 insert into public.aq_integration_tokens(user_id,name,token_hash,last4) values(uid,trim(p_name),encode(extensions.digest(clean,'sha256'),'hex'),right(clean,4)) returning * into result;
 return jsonb_build_object('id',result.id,'last4',result.last4,'name',result.name);
end $$;

create or replace function public.aq_gpt_add_finance_transaction(p_token text,p_title text,p_amount numeric,p_kind text,p_category text,p_occurred_on date,p_payment_method text,p_installments int,p_notes text) returns jsonb language plpgsql security definer set search_path='' as $$
declare token_row public.aq_integration_tokens%rowtype; tx uuid;
begin
 select * into token_row from public.aq_integration_tokens where token_hash=encode(extensions.digest(trim(coalesce(p_token,'')),'sha256'),'hex') and active for update;
 if not found then raise exception 'Token inválido'; end if;
 update public.aq_integration_tokens set last_used_at=now() where id=token_row.id;
 perform set_config('request.jwt.claim.sub',token_row.user_id::text,true);
 tx:=public.aq_finance_add_transaction(p_title,p_amount,coalesce(p_kind,'expense'),coalesce(p_category,'Outros'),p_occurred_on,coalesce(p_payment_method,'other'),null,coalesce(p_installments,1),coalesce(p_notes,''),'gpt');
 return jsonb_build_object('id',tx,'status','registered');
end $$;

revoke execute on function public.aq_finance_save_card(uuid,text,int,int),public.aq_finance_add_transaction(text,numeric,text,text,date,text,uuid,int,text,text),public.aq_fasting_finish(uuid,timestamptz,timestamptz,text),public.aq_integration_create_token(text,text),public.aq_gpt_add_finance_transaction(text,text,numeric,text,text,date,text,int,text) from public,anon;
grant execute on function public.aq_finance_save_card(uuid,text,int,int),public.aq_finance_add_transaction(text,numeric,text,text,date,text,uuid,int,text,text),public.aq_fasting_finish(uuid,timestamptz,timestamptz,text),public.aq_integration_create_token(text,text) to authenticated;
grant execute on function public.aq_gpt_add_finance_transaction(text,text,numeric,text,text,date,text,int,text) to anon, authenticated;

notify pgrst,'reload schema';
commit;
