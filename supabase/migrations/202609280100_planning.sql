-- AlyQuest: migração aditiva. Execute o arquivo inteiro no SQL Editor.
-- Não redefine complete_task, não apaga tarefas e não altera saldos existentes.
begin;
create table public.aq_routines (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
 title text not null check(length(trim(title)) between 1 and 200), category text not null, priority text not null,
 estimated_hours numeric not null check(estimated_hours > 0 and estimated_hours <= 1000),
 boss_id uuid references public.bosses(id), kind text not null default 'task' check(kind in ('task','workout')),
 rule jsonb not null, active boolean not null default true, cursor_date date, emitted integer not null default 0,
 created_at timestamptz not null default now()
);
create table public.aq_task_plans (
 task_id uuid primary key references public.tasks(id), user_id uuid not null references auth.users(id),
 kind text not null default 'task' check(kind in ('task','workout')), steps jsonb not null default '[]'::jsonb check(jsonb_typeof(steps)='array' and jsonb_array_length(steps)<=100),
 routine_id uuid references public.aq_routines(id), occurrence_date date,
 unique(routine_id, occurrence_date)
);
create table public.aq_workout_modules (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
 name text not null check(length(trim(name)) between 1 and 100),
 steps jsonb not null check(jsonb_typeof(steps)='array' and jsonb_array_length(steps) between 1 and 100),
 created_at timestamptz not null default now()
);
create index aq_routines_owner on public.aq_routines(user_id);
create index aq_task_plans_owner on public.aq_task_plans(user_id);
create index aq_workout_modules_owner on public.aq_workout_modules(user_id);
alter table public.aq_routines enable row level security;
alter table public.aq_task_plans enable row level security;
alter table public.aq_workout_modules enable row level security;
-- Escritas nas novas tabelas passam apenas pelas funções validadas abaixo.
create policy own_routines on public.aq_routines for select to authenticated using(user_id=(select auth.uid()));
create policy own_plans on public.aq_task_plans for select to authenticated using(user_id=(select auth.uid()));
create policy own_modules on public.aq_workout_modules for select to authenticated using(user_id=(select auth.uid()));
revoke all on public.aq_routines, public.aq_task_plans, public.aq_workout_modules from anon, authenticated;
grant select on public.aq_routines, public.aq_task_plans, public.aq_workout_modules to authenticated;

create function public.aq_validate_rule(r jsonb) returns void language plpgsql set search_path='' as $$
declare d date; u date; n int;
begin
 if r is null then return; end if;
 if r->>'frequency' not in ('daily','weekly','monthly','yearly') or r->>'frequency' is null then raise exception 'Frequência inválida'; end if;
 n := (r->>'interval')::int;
 if n is null or n < 1 or n > 99 then raise exception 'Intervalo inválido'; end if;
 d := (r->>'start')::date;
 if d is null or d < date '2000-01-01' or d > date '2200-01-01' then raise exception 'Data inicial inválida'; end if;
 if jsonb_typeof(r->'weekdays') is distinct from 'array' then raise exception 'Dias inválidos'; end if;
 if exists(select 1 from jsonb_array_elements_text(r->'weekdays') x where x::int not between 0 and 6) then raise exception 'Dias inválidos'; end if;
 if r->>'frequency'='weekly' and jsonb_array_length(r->'weekdays')=0 then raise exception 'Escolha os dias'; end if;
 u := (r->>'until')::date; n := (r->>'count')::int;
 if u < d or n < 1 or n > 10000 or (u is not null and n is not null) then raise exception 'Término inválido'; end if;
end $$;

create function public.aq_rule_matches(r jsonb, d date) returns boolean language plpgsql immutable set search_path='' as $$
declare start_day date := (r->>'start')::date; n int := (r->>'interval')::int; months int;
begin
 if d < start_day or ((r->>'until') is not null and d > (r->>'until')::date) then return false; end if;
 case r->>'frequency'
 when 'daily' then return (d-start_day)%n=0;
 when 'weekly' then return ((date_trunc('week',d)::date-date_trunc('week',start_day)::date)/7)%n=0 and exists(select 1 from jsonb_array_elements_text(r->'weekdays') x where x::int=extract(dow from d)::int);
 when 'monthly' then
 months := (extract(year from d)::int-extract(year from start_day)::int)*12 + extract(month from d)::int-extract(month from start_day)::int;
 return months%n=0 and extract(day from d)=least(extract(day from start_day),extract(day from (date_trunc('month',d)+interval '1 month - 1 day')));
 when 'yearly' then return (extract(year from d)::int-extract(year from start_day)::int)%n=0 and extract(month from d)=extract(month from start_day) and extract(day from d)=least(extract(day from start_day),extract(day from (date_trunc('month',d)+interval '1 month - 1 day')));
 else return false;
 end case;
end $$;

-- Materializa apenas ocorrências vencidas/hoje e a primeira ocorrência futura.
-- Lock por rotina + unique impedem duplicação entre abas e dispositivos.
create function public.aq_materialize() returns integer language plpgsql security definer set search_path='' as $$
declare uid uuid := auth.uid(); r public.aq_routines%rowtype; t public.tasks%rowtype; d date; stop_day date; created int:=0; tid uuid; loops int;
begin
 if uid is null then raise exception 'Não autenticado'; end if;
 for r in select * from public.aq_routines where user_id=uid and active order by id for update loop
  perform public.aq_validate_rule(r.rule);
  d:=coalesce(r.cursor_date+1,(r.rule->>'start')::date);
  stop_day:=greatest((now() at time zone 'America/Sao_Paulo')::date,(r.rule->>'start')::date + case when r.emitted=0 and r.rule->>'frequency'='weekly' then 7*(r.rule->>'interval')::int else 0 end);
  loops:=0;
  while d<=stop_day loop
   if (r.rule->>'count') is not null and r.emitted >= (r.rule->>'count')::int then exit; end if;
   if (r.rule->>'until') is not null and d>(r.rule->>'until')::date then exit; end if;
   if public.aq_rule_matches(r.rule,d) then
    if not exists(select 1 from public.aq_task_plans where routine_id=r.id and occurrence_date=d) then
     t:=jsonb_populate_record(null::public.tasks,jsonb_build_object('title',r.title,'category',r.category,'priority',r.priority,'estimated_hours',r.estimated_hours,'boss_id',r.boss_id));
     insert into public.tasks(user_id,title,category,priority,estimated_hours,due_date,boss_id,status)
      values(uid,t.title,t.category,t.priority,t.estimated_hours,d,t.boss_id,'pending') returning id into tid;
     insert into public.aq_task_plans(task_id,user_id,kind,routine_id,occurrence_date) values(tid,uid,r.kind,r.id,d);
     r.emitted:=r.emitted+1; created:=created+1;
     if d>(now() at time zone 'America/Sao_Paulo')::date then stop_day:=d; end if;
    end if;
   end if;
   r.cursor_date:=d; d:=d+1; loops:=loops+1;
   if loops>=3660 or created>=365 then exit; end if;
  end loop;
  update public.aq_routines set cursor_date=r.cursor_date,emitted=r.emitted where id=r.id;
 end loop;
 return created;
end $$;

create function public.aq_save_task(p_task_id uuid, p_data jsonb, p_rule jsonb default null, p_scope text default 'one') returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); t public.tasks%rowtype; old public.tasks%rowtype; tid uuid; rid uuid; v_kind text:=coalesce(p_data->>'kind','task'); plan public.aq_task_plans%rowtype; starts date;
begin
 if uid is null then raise exception 'Não autenticado'; end if;
 if p_scope not in ('one','future') or v_kind not in ('task','workout') then raise exception 'Opção inválida'; end if;
 t:=jsonb_populate_record(null::public.tasks,p_data);
 if t.title is null or length(trim(t.title)) not between 1 and 200 or t.estimated_hours is null or t.estimated_hours<=0 or t.estimated_hours>1000 or t.priority::text not in ('low','medium','high') or t.category is null then raise exception 'Dados da missão inválidos'; end if;
 if t.boss_id is not null and not exists(select 1 from public.bosses where id=t.boss_id and user_id=uid and defeated_at is null) then raise exception 'Chefe indisponível'; end if;
 perform public.aq_validate_rule(p_rule);
 if p_task_id is null then
  if p_rule is not null then
   if (p_rule->>'start')::date < (now() at time zone 'America/Sao_Paulo')::date then raise exception 'Inicie a recorrência hoje ou no futuro'; end if;
   insert into public.aq_routines(user_id,title,category,priority,estimated_hours,boss_id,kind,rule) values(uid,trim(t.title),t.category::text,t.priority::text,t.estimated_hours,t.boss_id,v_kind,p_rule) returning id into rid;
   perform public.aq_materialize();
   select task_id into tid from public.aq_task_plans where routine_id=rid order by occurrence_date limit 1;
   return tid;
  end if;
  insert into public.tasks(user_id,title,category,priority,estimated_hours,due_date,boss_id,status) values(uid,trim(t.title),t.category,t.priority,t.estimated_hours,t.due_date,t.boss_id,'pending') returning id into tid;
  insert into public.aq_task_plans(task_id,user_id,kind) values(tid,uid,v_kind);
  return tid;
 end if;
 -- Ordem de locks: rotina antes da tarefa, igual à materialização.
 select * into plan from public.aq_task_plans where task_id=p_task_id and user_id=uid;
 if plan.routine_id is not null then perform 1 from public.aq_routines where id=plan.routine_id and user_id=uid for update; end if;
 select * into old from public.tasks where id=p_task_id and user_id=uid for update;
 if not found or old.status::text<>'pending' then raise exception 'Missão indisponível'; end if;
 update public.tasks set title=trim(t.title),category=t.category,priority=t.priority,estimated_hours=t.estimated_hours,due_date=t.due_date,boss_id=t.boss_id where id=p_task_id;
 insert into public.aq_task_plans(task_id,user_id,kind) values(p_task_id,uid,v_kind) on conflict(task_id) do update set kind=excluded.kind;
 if p_scope='future' and plan.routine_id is not null then
  if p_rule is null then update public.aq_routines set active=false where id=plan.routine_id;
  else
   -- Mantém a identidade, âncora e contador da série; só ocorrências ainda não geradas mudam.
   select (rule->>'start')::date into starts from public.aq_routines where id=plan.routine_id;
   p_rule:=jsonb_set(p_rule,'{start}',to_jsonb(starts::text));
   perform public.aq_validate_rule(p_rule);
   update public.aq_routines set title=trim(t.title),category=t.category::text,priority=t.priority::text,estimated_hours=t.estimated_hours,boss_id=t.boss_id,kind=v_kind,rule=p_rule where id=plan.routine_id;
  end if;
 elsif plan.routine_id is null and p_rule is not null then
  raise exception 'Crie uma nova missão para iniciar uma série recorrente';
 end if;
 return p_task_id;
end $$;

create function public.aq_save_steps(p_task_id uuid,p_steps jsonb) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); item jsonb; t public.tasks%rowtype;
begin
 if uid is null then raise exception 'Não autenticado'; end if;
 select * into t from public.tasks where id=p_task_id and user_id=uid for update;
 if not found or t.status::text<>'pending' then raise exception 'Missão indisponível'; end if;
 if jsonb_typeof(p_steps) is distinct from 'array' or jsonb_array_length(p_steps)>100 then raise exception 'Etapas inválidas'; end if;
 for item in select * from jsonb_array_elements(p_steps) loop
  if coalesce(length(trim(item->>'title')),0) not between 1 and 200 or jsonb_typeof(item->'done') is distinct from 'boolean' or coalesce(length(item->>'id'),0) not between 1 and 100 or coalesce(length(item->>'target'),0)>300 or coalesce(length(item->>'actual'),0)>500 then raise exception 'Etapa inválida'; end if;
 end loop;
 if (select count(distinct x->>'id') from jsonb_array_elements(p_steps) x)<>jsonb_array_length(p_steps) then raise exception 'Etapas duplicadas'; end if;
 insert into public.aq_task_plans(task_id,user_id,steps) values(p_task_id,uid,p_steps) on conflict(task_id) do update set steps=excluded.steps;
end $$;

create function public.aq_complete_task(p_task_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); t public.tasks%rowtype;
begin
 if uid is null then raise exception 'Não autenticado'; end if;
 select * into t from public.tasks where id=p_task_id and user_id=uid for update;
 if not found then raise exception 'Missão indisponível'; end if;
 if t.status::text='completed' then return; end if;
 if t.status::text<>'pending' then raise exception 'Estado inválido'; end if;
 -- Recompensas continuam integralmente na função original. Etapas não dão XP extra.
 perform public.complete_task(p_task_id);
end $$;

create function public.aq_save_module(p_id uuid,p_name text,p_steps jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); result uuid; item jsonb;
begin
 if uid is null then raise exception 'Não autenticado'; end if;
 if length(trim(p_name)) not between 1 and 100 or p_name is null or jsonb_typeof(p_steps) is distinct from 'array' or jsonb_array_length(p_steps) not between 1 and 100 then raise exception 'Módulo inválido'; end if;
 for item in select * from jsonb_array_elements(p_steps) loop
  if coalesce(length(trim(item->>'title')),0) not between 1 and 200 or coalesce(length(item->>'target'),0)>300 then raise exception 'Exercício inválido'; end if;
 end loop;
 if p_id is null then insert into public.aq_workout_modules(user_id,name,steps) values(uid,trim(p_name),p_steps) returning id into result;
 else update public.aq_workout_modules set name=trim(p_name),steps=p_steps where id=p_id and user_id=uid returning id into result; end if;
 if result is null then raise exception 'Módulo indisponível'; end if;
 return result;
end $$;

create function public.aq_save_boss(p_id uuid,p_name text,p_category text,p_hp numeric) returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); result uuid; b public.bosses%rowtype;
begin
 if uid is null then raise exception 'Não autenticado'; end if;
 if p_name is null or length(trim(p_name)) not between 1 and 100 or p_hp is null or p_hp<=0 or p_hp>100000 or p_category not in ('Pessoal','Trabalho','Faculdade','Financeiro','Saúde') then raise exception 'Dados do chefe inválidos'; end if;
 b:=jsonb_populate_record(null::public.bosses,jsonb_build_object('category',p_category));
 if p_id is null then insert into public.bosses(user_id,name,category,max_hp,current_hp) values(uid,trim(p_name),b.category,p_hp,p_hp) returning id into result;
 else
  select * into b from public.bosses where id=p_id and user_id=uid for update;
  if not found or b.defeated_at is not null then raise exception 'Chefe indisponível'; end if;
  -- Preserva dano já causado; não concede vitória por reduzir artificialmente o HP.
  if p_hp <= b.max_hp-b.current_hp then raise exception 'HP total deve superar o dano já causado'; end if;
  update public.bosses set name=trim(p_name),category=(jsonb_populate_record(null::public.bosses,jsonb_build_object('category',p_category))).category,max_hp=p_hp,current_hp=p_hp-(b.max_hp-b.current_hp) where id=p_id returning id into result;
 end if;
 return result;
end $$;

create function public.aq_pause_routine(p_id uuid,p_active boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Não autenticado'; end if;
 update public.aq_routines set active=p_active where id=p_id and user_id=auth.uid();
 if not found then raise exception 'Recorrência indisponível'; end if;
end $$;

revoke execute on function public.aq_validate_rule(jsonb),public.aq_rule_matches(jsonb,date),public.aq_materialize(),public.aq_save_task(uuid,jsonb,jsonb,text),public.aq_save_steps(uuid,jsonb),public.aq_complete_task(uuid),public.aq_save_module(uuid,text,jsonb),public.aq_save_boss(uuid,text,text,numeric),public.aq_pause_routine(uuid,boolean) from public,anon;
grant execute on function public.aq_materialize(),public.aq_save_task(uuid,jsonb,jsonb,text),public.aq_save_steps(uuid,jsonb),public.aq_complete_task(uuid),public.aq_save_module(uuid,text,jsonb),public.aq_save_boss(uuid,text,text,numeric),public.aq_pause_routine(uuid,boolean) to authenticated;
notify pgrst, 'reload schema';
commit;
