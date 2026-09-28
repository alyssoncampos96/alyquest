begin;
alter table public.aq_task_plans drop constraint aq_task_plans_kind_check;
alter table public.aq_task_plans add constraint aq_task_plans_kind_check check(kind in ('single','task','workout'));
alter table public.aq_routines drop constraint aq_routines_kind_check;
alter table public.aq_routines add constraint aq_routines_kind_check check(kind in ('single','task','workout'));
alter table public.aq_routines add column steps jsonb not null default '[]'::jsonb;
create function public.aq_validate_steps(p_steps jsonb) returns void language plpgsql set search_path='' as $$
declare item jsonb;
begin
 if jsonb_typeof(p_steps) is distinct from 'array' or jsonb_array_length(p_steps)>100 then raise exception 'Etapas inválidas'; end if;
 for item in select * from jsonb_array_elements(p_steps) loop
  if jsonb_typeof(item->'title') is distinct from 'string' or length(trim(item->>'title')) not between 1 and 200 or jsonb_typeof(item->'done') is distinct from 'boolean' or coalesce(length(item->>'id'),0) not between 1 and 100 or jsonb_typeof(item->'target') is distinct from 'string' or length(item->>'target')>300 or jsonb_typeof(item->'actual') is distinct from 'string' or length(item->>'actual')>500 then raise exception 'Etapa inválida'; end if;
 end loop;
 if (select count(distinct x->>'id') from jsonb_array_elements(p_steps) x)<>jsonb_array_length(p_steps) then raise exception 'Etapas duplicadas'; end if;
end $$;
create or replace function public.aq_materialize() returns integer language plpgsql security definer set search_path='' as $$
declare uid uuid := auth.uid(); r public.aq_routines%rowtype; t public.tasks%rowtype; d date; stop_day date; created int:=0; tid uuid; loops int;
begin
 if uid is null then raise exception 'Não autenticado'; end if;
 for r in select * from public.aq_routines where user_id=uid and active order by id for update loop
  perform public.aq_validate_rule(r.rule);
  d:=coalesce(r.cursor_date+1,(r.rule->>'start')::date);
  stop_day:=greatest((now() at time zone 'America/Sao_Paulo')::date + case when r.kind='workout' then 6 else 0 end,(r.rule->>'start')::date + case when r.emitted=0 and r.rule->>'frequency'='weekly' then 7*(r.rule->>'interval')::int else 0 end);
  loops:=0;
  while d<=stop_day loop
   if (r.rule->>'count') is not null and r.emitted >= (r.rule->>'count')::int then exit; end if;
   if (r.rule->>'until') is not null and d>(r.rule->>'until')::date then exit; end if;
   if public.aq_rule_matches(r.rule,d) then
    if not exists(select 1 from public.aq_task_plans where routine_id=r.id and occurrence_date=d) then
     t:=jsonb_populate_record(null::public.tasks,jsonb_build_object('title',r.title,'category',r.category,'priority',r.priority,'estimated_hours',r.estimated_hours,'boss_id',r.boss_id));
     insert into public.tasks(user_id,title,category,priority,estimated_hours,due_date,boss_id,status)
      values(uid,t.title,t.category,t.priority,t.estimated_hours,d,t.boss_id,'pending') returning id into tid;
     insert into public.aq_task_plans(task_id,user_id,kind,routine_id,occurrence_date,steps) values(tid,uid,r.kind,r.id,d,r.steps);
     r.emitted:=r.emitted+1; created:=created+1;
     if d>(now() at time zone 'America/Sao_Paulo')::date and r.kind<>'workout' then stop_day:=d; end if;
    end if;
   end if;
   r.cursor_date:=d; d:=d+1; loops:=loops+1;
   if loops>=3660 or created>=365 then exit; end if;
  end loop;
  update public.aq_routines set cursor_date=r.cursor_date,emitted=r.emitted where id=r.id;
 end loop;
 return created;
end $$;
create or replace function public.aq_save_task(p_task_id uuid, p_data jsonb, p_rule jsonb default null, p_scope text default 'one') returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); t public.tasks%rowtype; old public.tasks%rowtype; tid uuid; rid uuid; v_kind text:=coalesce(p_data->>'kind','task'); plan public.aq_task_plans%rowtype; starts date;
begin
 if uid is null then raise exception 'Não autenticado'; end if;
 if p_scope not in ('one','future') or v_kind not in ('single','task','workout') then raise exception 'Opção inválida'; end if;
 t:=jsonb_populate_record(null::public.tasks,p_data);
 if t.title is null or length(trim(t.title)) not between 1 and 200 or t.estimated_hours is null or t.estimated_hours<=0 or t.estimated_hours>1000 or t.priority::text not in ('low','medium','high') or t.category is null then raise exception 'Dados da missão inválidos'; end if;
 if t.boss_id is not null and not exists(select 1 from public.bosses where id=t.boss_id and user_id=uid and defeated_at is null) then raise exception 'Chefe indisponível'; end if;
 perform public.aq_validate_rule(p_rule);
 if p_data ? 'steps' then perform public.aq_validate_steps(p_data->'steps');end if;
 if p_task_id is null then
  if p_rule is not null then
   if (p_rule->>'start')::date < (now() at time zone 'America/Sao_Paulo')::date then raise exception 'Inicie a recorrência hoje ou no futuro'; end if;
   insert into public.aq_routines(user_id,title,category,priority,estimated_hours,boss_id,kind,rule,steps) values(uid,trim(t.title),t.category::text,t.priority::text,t.estimated_hours,t.boss_id,v_kind,p_rule,coalesce(p_data->'steps','[]'::jsonb)) returning id into rid;
   perform public.aq_materialize();
   select task_id into tid from public.aq_task_plans where routine_id=rid order by occurrence_date limit 1;
   return tid;
  end if;
  insert into public.tasks(user_id,title,category,priority,estimated_hours,due_date,boss_id,status) values(uid,trim(t.title),t.category,t.priority,t.estimated_hours,t.due_date,t.boss_id,'pending') returning id into tid;
  insert into public.aq_task_plans(task_id,user_id,kind,steps) values(tid,uid,v_kind,coalesce(p_data->'steps','[]'::jsonb));
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
   update public.aq_routines set title=trim(t.title),category=t.category::text,priority=t.priority::text,estimated_hours=t.estimated_hours,boss_id=t.boss_id,kind=v_kind,rule=p_rule,steps=coalesce(p_data->'steps',steps) where id=plan.routine_id;
  end if;
 elsif plan.routine_id is null and p_rule is not null then
  raise exception 'Crie uma nova missão para iniciar uma série recorrente';
 end if;
 return p_task_id;
end $$;
create or replace function public.aq_save_routine(p_id uuid,p_data jsonb,p_rule jsonb) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); r public.aq_routines%rowtype; t public.tasks%rowtype; k text:=coalesce(p_data->>'kind','task');
begin
 if uid is null then raise exception 'Não autenticado'; end if;
 select * into r from public.aq_routines where id=p_id and user_id=uid for update;
 if not found then raise exception 'Recorrência indisponível'; end if;
 if p_rule is null then update public.aq_routines set active=false where id=p_id;return;end if;
 if p_data ? 'steps' then perform public.aq_validate_steps(p_data->'steps');end if;
 t:=jsonb_populate_record(null::public.tasks,p_data);
 if t.title is null or length(trim(t.title)) not between 1 and 200 or t.estimated_hours is null or t.estimated_hours<=0 or t.estimated_hours>1000 or t.priority::text not in ('low','medium','high') or t.category is null or k not in ('single','task','workout') then raise exception 'Dados inválidos';end if;
 if t.boss_id is not null and not exists(select 1 from public.bosses where id=t.boss_id and user_id=uid and defeated_at is null) then raise exception 'Chefe indisponível';end if;
 p_rule:=jsonb_set(p_rule,'{start}',r.rule->'start');perform public.aq_validate_rule(p_rule);
 update public.aq_routines set title=trim(t.title),category=t.category::text,priority=t.priority::text,estimated_hours=t.estimated_hours,boss_id=t.boss_id,kind=k,rule=p_rule,steps=coalesce(p_data->'steps',steps) where id=p_id;
end $$;
alter table public.pomodoro_sessions add column task_ids uuid[] not null default '{}';
alter table public.pomodoro_sessions add column other_activity text not null default '';
create function public.aq_complete_focus(p_session_id uuid,p_task_ids uuid[],p_other text,p_phase text,p_focus_minutes int,p_break_minutes int) returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); session public.pomodoro_sessions%rowtype; result uuid;
begin
 if uid is null or p_session_id is null then raise exception 'Não autenticado';end if;
 if p_phase not in ('focus','break') or p_focus_minutes not in (25,45,50,60) or p_break_minutes not in (5,10,15,20) or p_other is null or length(p_other)>500 or p_task_ids is null or cardinality(p_task_ids)>100 then raise exception 'Dados inválidos';end if;
 if exists(select 1 from unnest(p_task_ids) id where not exists(select 1 from public.tasks t where t.id=id and t.user_id=uid)) then raise exception 'Missão indisponível';end if;
 -- The client keeps this UUID across retries; locking serializes both phases.
 perform pg_advisory_xact_lock(hashtextextended(p_session_id::text,0));
 select * into session from public.pomodoro_sessions where id=p_session_id for update;
 if found then
  if session.user_id<>uid then raise exception 'Sessão indisponível';end if;
 else
  if p_phase<>'focus' then raise exception 'Conclua o foco primeiro';end if;
  insert into public.pomodoro_sessions(id,user_id,task_id,focus_minutes,break_minutes,task_ids,other_activity) values(p_session_id,uid,p_task_ids[1],p_focus_minutes,p_break_minutes,p_task_ids,trim(p_other));
 end if;
 result:=public.complete_pomodoro_phase(p_session_id,p_task_ids[1],p_phase,p_focus_minutes,p_break_minutes);
 return result;
end $$;
revoke execute on function public.aq_validate_steps(jsonb),public.aq_complete_focus(uuid,uuid[],text,text,int,int) from public,anon;
grant execute on function public.aq_complete_focus(uuid,uuid[],text,text,int,int) to authenticated;
notify pgrst,'reload schema';
commit;
