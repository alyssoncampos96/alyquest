begin;
create extension if not exists pgcrypto with schema extensions;

create or replace function public.aq_gpt_token_user(p_token text) returns uuid language plpgsql security definer set search_path='' as $$
declare token_row public.aq_integration_tokens%rowtype;
begin
 select * into token_row from public.aq_integration_tokens where token_hash=encode(extensions.digest(trim(coalesce(p_token,'')),'sha256'),'hex') and active for update;
 if not found then raise exception 'Token inválido'; end if;
 update public.aq_integration_tokens set last_used_at=now() where id=token_row.id;
 return token_row.user_id;
end $$;

create or replace function public.aq_fasting_start(p_started_at timestamptz,p_notes text) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); existing public.aq_fasting_sessions%rowtype; sid uuid;
begin
 if uid is null then raise exception 'Não autenticado'; end if;
 if p_started_at is null or p_started_at > now() + interval '1 day' or p_started_at < now() - interval '45 days' then raise exception 'Confira o início do jejum'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text||'fasting',0));
 select * into existing from public.aq_fasting_sessions where user_id=uid and status='active' and ended_at is null order by started_at desc limit 1 for update;
 if found then
  return jsonb_build_object('id',existing.id,'status','already_active','started_at',existing.started_at,'notes',existing.notes);
 end if;
 insert into public.aq_fasting_sessions(user_id,started_at,status,notes) values(uid,p_started_at,'active',coalesce(p_notes,'')) returning id into sid;
 return jsonb_build_object('id',sid,'status','active','started_at',p_started_at);
end $$;

create or replace function public.aq_gpt_list_finance_transactions(p_token text,p_month text default null,p_category text default null,p_kind text default null,p_limit int default 20) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid; start_day date; end_day date; clean_limit int; items jsonb; clean_category text:=nullif(trim(coalesce(p_category,'')),''); clean_kind text:=nullif(trim(coalesce(p_kind,'')),'');
begin
 uid:=public.aq_gpt_token_user(p_token);
 if clean_kind is not null and clean_kind not in ('expense','income') then raise exception 'Tipo financeiro inválido'; end if;
 if p_month is null or trim(p_month)='' then start_day:=date_trunc('month',now() at time zone 'America/Sao_Paulo')::date;
 elsif p_month ~ '^\d{4}-\d{2}$' then start_day:=(p_month||'-01')::date;
 else raise exception 'Informe o mês como YYYY-MM'; end if;
 end_day:=(start_day + interval '1 month')::date;
 clean_limit:=least(greatest(coalesce(p_limit,20),1),50);
 select jsonb_agg(to_jsonb(q)) into items from (
  select id,title,amount,kind,category,occurred_on,payment_method,installment_number,installment_count,notes,source
  from public.aq_finance_transactions
  where user_id=uid and occurred_on>=start_day and occurred_on<end_day and (clean_category is null or category=clean_category) and (clean_kind is null or kind=clean_kind)
  order by occurred_on desc, created_at desc
  limit clean_limit
 ) q;
 return jsonb_build_object('month',to_char(start_day,'YYYY-MM'),'count',coalesce(jsonb_array_length(coalesce(items,'[]'::jsonb)),0),'transactions',coalesce(items,'[]'::jsonb));
end $$;

create or replace function public.aq_gpt_finance_summary(p_token text,p_month text default null,p_category text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid; start_day date; end_day date; clean_category text:=nullif(trim(coalesce(p_category,'')),''); income_total numeric; expense_total numeric; tx_count int; categories jsonb;
begin
 uid:=public.aq_gpt_token_user(p_token);
 if p_month is null or trim(p_month)='' then start_day:=date_trunc('month',now() at time zone 'America/Sao_Paulo')::date;
 elsif p_month ~ '^\d{4}-\d{2}$' then start_day:=(p_month||'-01')::date;
 else raise exception 'Informe o mês como YYYY-MM'; end if;
 end_day:=(start_day + interval '1 month')::date;
 select coalesce(sum(amount) filter(where kind='income'),0),coalesce(sum(amount) filter(where kind='expense'),0),count(*) into income_total,expense_total,tx_count
 from public.aq_finance_transactions
 where user_id=uid and occurred_on>=start_day and occurred_on<end_day and (clean_category is null or category=clean_category);
 select jsonb_agg(to_jsonb(q) order by q.expense desc) into categories from (
  select category,coalesce(sum(amount) filter(where kind='income'),0) as income,coalesce(sum(amount) filter(where kind='expense'),0) as expense,count(*) as count
  from public.aq_finance_transactions
  where user_id=uid and occurred_on>=start_day and occurred_on<end_day and (clean_category is null or category=clean_category)
  group by category
 ) q;
 return jsonb_build_object('month',to_char(start_day,'YYYY-MM'),'category',clean_category,'income',income_total,'expense',expense_total,'balance',income_total-expense_total,'count',tx_count,'by_category',coalesce(categories,'[]'::jsonb));
end $$;

create or replace function public.aq_gpt_create_task(p_token text,p_title text,p_category text default 'Pessoal',p_priority text default 'medium',p_estimated_hours numeric default 1,p_due_date date default null,p_notes text default '') returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid; tid uuid; clean_priority text:=coalesce(nullif(trim(p_priority),''),'medium'); clean_category text:=coalesce(nullif(trim(p_category),''),'Pessoal'); clean_hours numeric:=coalesce(p_estimated_hours,1);
begin
 uid:=public.aq_gpt_token_user(p_token);
 perform set_config('request.jwt.claim.sub',uid::text,true);
 if p_title is null or length(trim(p_title)) not between 1 and 200 then raise exception 'Informe o nome da missão'; end if;
 if clean_priority not in ('low','medium','high') then clean_priority:='medium'; end if;
 if clean_hours<=0 or clean_hours>1000 then clean_hours:=1; end if;
 insert into public.tasks(user_id,title,category,priority,estimated_hours,due_date,status) values(uid,trim(p_title),clean_category,clean_priority,clean_hours,p_due_date,'pending') returning id into tid;
 insert into public.aq_task_plans(task_id,user_id,kind) values(tid,uid,'task') on conflict(task_id) do nothing;
 return jsonb_build_object('id',tid,'status','created','title',trim(p_title),'category',clean_category,'priority',clean_priority,'due_date',p_due_date,'notes_received',coalesce(p_notes,'')<>'');
end $$;

create or replace function public.aq_gpt_list_tasks(p_token text,p_scope text default 'today',p_limit int default 12) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid; today date:=(now() at time zone 'America/Sao_Paulo')::date; clean_scope text:=coalesce(nullif(trim(p_scope),''),'today'); clean_limit int:=least(greatest(coalesce(p_limit,12),1),50); items jsonb;
begin
 uid:=public.aq_gpt_token_user(p_token);
 if clean_scope not in ('today','pending','overdue','all') then raise exception 'Filtro de missões inválido'; end if;
 select jsonb_agg(to_jsonb(q)) into items from (
  select id,title,category,priority,estimated_hours,due_date,status,completed_at
  from public.tasks
  where user_id=uid and (
   clean_scope='all'
   or (clean_scope='pending' and status='pending')
   or (clean_scope='today' and status='pending' and (due_date is null or due_date<=today))
   or (clean_scope='overdue' and status='pending' and due_date<today)
  )
  order by case when due_date is null then 1 else 0 end,due_date asc,created_at desc
  limit clean_limit
 ) q;
 return jsonb_build_object('scope',clean_scope,'today',today,'count',coalesce(jsonb_array_length(coalesce(items,'[]'::jsonb)),0),'tasks',coalesce(items,'[]'::jsonb));
end $$;

create or replace function public.aq_gpt_complete_task(p_token text,p_task_id uuid default null,p_query text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid; target_id uuid; match_count int; candidates jsonb; result jsonb; clean_query text:=nullif(trim(coalesce(p_query,'')),'');
begin
 uid:=public.aq_gpt_token_user(p_token);
 perform set_config('request.jwt.claim.sub',uid::text,true);
 if p_task_id is not null then
  target_id:=p_task_id;
 else
  if clean_query is null then raise exception 'Informe a missão'; end if;
  select count(*) into match_count from (
   select id from public.tasks where user_id=uid and status='pending' and lower(title) like '%'||lower(clean_query)||'%' limit 3
  ) m;
  if match_count=0 then raise exception 'Nenhuma missão encontrada'; end if;
  if match_count>1 then
   select jsonb_agg(to_jsonb(q)) into candidates from (
    select id,title,category,priority,due_date from public.tasks where user_id=uid and status='pending' and lower(title) like '%'||lower(clean_query)||'%' order by due_date nulls last,created_at desc limit 5
   ) q;
   return jsonb_build_object('status','ambiguous','message','Encontrei mais de uma missão. Peça ao usuário para escolher uma pelo id ou título exato.','candidates',coalesce(candidates,'[]'::jsonb));
  end if;
  select id into target_id from public.tasks where user_id=uid and status='pending' and lower(title) like '%'||lower(clean_query)||'%' order by due_date nulls last,created_at desc limit 1;
 end if;
 result:=public.aq_finish_mission(target_id);
 return jsonb_build_object('status','completed','result',result);
end $$;

create or replace function public.aq_gpt_start_fast(p_token text,p_started_at timestamptz default null,p_notes text default '') returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid;
begin
 uid:=public.aq_gpt_token_user(p_token);
 perform set_config('request.jwt.claim.sub',uid::text,true);
 return public.aq_fasting_start(coalesce(p_started_at,now()),p_notes);
end $$;

create or replace function public.aq_gpt_fasting_status(p_token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid; session public.aq_fasting_sessions%rowtype; hours numeric; units int;
begin
 uid:=public.aq_gpt_token_user(p_token);
 select * into session from public.aq_fasting_sessions where user_id=uid and status='active' and ended_at is null order by started_at desc limit 1;
 if not found then return jsonb_build_object('active',false); end if;
 hours:=extract(epoch from (now()-session.started_at))/3600;
 units:=floor(hours/4);
 return jsonb_build_object('active',true,'id',session.id,'started_at',session.started_at,'duration_hours',round(hours,2),'reward_units',units,'next_reward_hours',(units+1)*4);
end $$;

create or replace function public.aq_gpt_finish_fast(p_token text,p_session_id uuid default null,p_started_at timestamptz default null,p_ended_at timestamptz default null,p_notes text default '') returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid; sid uuid:=p_session_id; started timestamptz;
begin
 uid:=public.aq_gpt_token_user(p_token);
 perform set_config('request.jwt.claim.sub',uid::text,true);
 if sid is null then
  select id,started_at into sid,started from public.aq_fasting_sessions where user_id=uid and status='active' and ended_at is null order by started_at desc limit 1;
 else
  select started_at into started from public.aq_fasting_sessions where id=sid and user_id=uid;
 end if;
 started:=coalesce(p_started_at,started);
 if started is null then raise exception 'Informe o início do jejum'; end if;
 return public.aq_fasting_finish(sid,started,coalesce(p_ended_at,now()),p_notes);
end $$;

revoke execute on function public.aq_gpt_token_user(text),public.aq_fasting_start(timestamptz,text),public.aq_gpt_list_finance_transactions(text,text,text,text,int),public.aq_gpt_finance_summary(text,text,text),public.aq_gpt_create_task(text,text,text,text,numeric,date,text),public.aq_gpt_list_tasks(text,text,int),public.aq_gpt_complete_task(text,uuid,text),public.aq_gpt_start_fast(text,timestamptz,text),public.aq_gpt_fasting_status(text),public.aq_gpt_finish_fast(text,uuid,timestamptz,timestamptz,text) from public,anon;
grant execute on function public.aq_fasting_start(timestamptz,text) to authenticated;
grant execute on function public.aq_gpt_list_finance_transactions(text,text,text,text,int),public.aq_gpt_finance_summary(text,text,text),public.aq_gpt_create_task(text,text,text,text,numeric,date,text),public.aq_gpt_list_tasks(text,text,int),public.aq_gpt_complete_task(text,uuid,text),public.aq_gpt_start_fast(text,timestamptz,text),public.aq_gpt_fasting_status(text),public.aq_gpt_finish_fast(text,uuid,timestamptz,timestamptz,text) to anon, authenticated;

notify pgrst,'reload schema';
commit;
