begin;
-- Descriptions are optional; defaults preserve all existing missions and routines.
alter table public.tasks add column if not exists description text not null default '';
alter table public.aq_routines add column if not exists description text not null default '';
do $$ begin
 if not exists (select 1 from pg_constraint where conname='aq_tasks_description_length' and conrelid='public.tasks'::regclass) then
  alter table public.tasks add constraint aq_tasks_description_length check (length(description) <= 4000) not valid;
 end if;
 if not exists (select 1 from pg_constraint where conname='aq_routines_description_length' and conrelid='public.aq_routines'::regclass) then
  alter table public.aq_routines add constraint aq_routines_description_length check (length(description) <= 4000) not valid;
 end if;
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
    if not exists(select 1 from public.aq_task_plans where routine_id=r.id and occurrence_date=d and not superseded) then
     t:=jsonb_populate_record(null::public.tasks,jsonb_build_object('title',r.title,'description',r.description,'category',r.category,'priority',r.priority,'estimated_hours',r.estimated_hours,'boss_id',r.boss_id));
     insert into public.tasks(user_id,title,description,category,priority,estimated_hours,due_date,boss_id,status)
      values(uid,t.title,coalesce(t.description,''),t.category,t.priority,t.estimated_hours,d,t.boss_id,'pending') returning id into tid;
     insert into public.aq_task_plans(task_id,user_id,kind,routine_id,occurrence_date,steps) values(tid,uid,r.kind,r.id,d,r.steps);
     created:=created+1;
     if d>(now() at time zone 'America/Sao_Paulo')::date and r.kind<>'workout' then stop_day:=d; end if;
    end if;
    r.emitted:=r.emitted+1;
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
 if length(coalesce(t.description,''))>4000 then raise exception 'Descrição longa demais'; end if;
 if t.boss_id is not null and not exists(select 1 from public.bosses where id=t.boss_id and user_id=uid and defeated_at is null) then raise exception 'Chefe indisponível'; end if;
 perform public.aq_validate_rule(p_rule);
 if p_data ? 'steps' then perform public.aq_validate_steps(p_data->'steps');end if;
 if p_task_id is null then
  if p_rule is not null then
   if (p_rule->>'start')::date < (now() at time zone 'America/Sao_Paulo')::date then raise exception 'Inicie a recorrência hoje ou no futuro'; end if;
   insert into public.aq_routines(user_id,title,description,category,priority,estimated_hours,boss_id,kind,rule,steps) values(uid,trim(t.title),coalesce(trim(t.description),''),t.category::text,t.priority::text,t.estimated_hours,t.boss_id,v_kind,p_rule,coalesce(p_data->'steps','[]'::jsonb)) returning id into rid;
   perform public.aq_materialize();
   select task_id into tid from public.aq_task_plans where routine_id=rid order by occurrence_date limit 1;
   return tid;
  end if;
  insert into public.tasks(user_id,title,description,category,priority,estimated_hours,due_date,boss_id,status) values(uid,trim(t.title),coalesce(trim(t.description),''),t.category,t.priority,t.estimated_hours,t.due_date,t.boss_id,'pending') returning id into tid;
  insert into public.aq_task_plans(task_id,user_id,kind,steps) values(tid,uid,v_kind,coalesce(p_data->'steps','[]'::jsonb));
  return tid;
 end if;
 -- Ordem de locks: rotina antes da tarefa, igual à materialização.
 select * into plan from public.aq_task_plans where task_id=p_task_id and user_id=uid;
 if plan.routine_id is not null then perform 1 from public.aq_routines where id=plan.routine_id and user_id=uid for update; end if;
 select * into old from public.tasks where id=p_task_id and user_id=uid for update;
 if not found or old.status::text<>'pending' then raise exception 'Missão indisponível'; end if;
 update public.tasks set title=trim(t.title),description=coalesce(trim(t.description),''),category=t.category,priority=t.priority,estimated_hours=t.estimated_hours,due_date=t.due_date,boss_id=t.boss_id where id=p_task_id;
 insert into public.aq_task_plans(task_id,user_id,kind) values(p_task_id,uid,v_kind) on conflict(task_id) do update set kind=excluded.kind;
 if p_scope='future' and plan.routine_id is not null then
  if p_rule is null then update public.aq_routines set active=false where id=plan.routine_id;
  else
   -- Mantém a identidade, âncora e contador da série; só ocorrências ainda não geradas mudam.
   select (rule->>'start')::date into starts from public.aq_routines where id=plan.routine_id;
   p_rule:=jsonb_set(p_rule,'{start}',to_jsonb(starts::text));
   perform public.aq_validate_rule(p_rule);
   update public.aq_routines set title=trim(t.title),description=coalesce(trim(t.description),''),category=t.category::text,priority=t.priority::text,estimated_hours=t.estimated_hours,boss_id=t.boss_id,kind=v_kind,rule=p_rule,steps=coalesce(p_data->'steps',steps) where id=plan.routine_id;
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
 if length(coalesce(t.description,''))>4000 then raise exception 'Descrição longa demais';end if;
 if t.boss_id is not null and not exists(select 1 from public.bosses where id=t.boss_id and user_id=uid and defeated_at is null) then raise exception 'Chefe indisponível';end if;
 p_rule:=jsonb_set(p_rule,'{start}',r.rule->'start');perform public.aq_validate_rule(p_rule);
 update public.aq_routines set title=trim(t.title),description=coalesce(trim(t.description),''),category=t.category::text,priority=t.priority::text,estimated_hours=t.estimated_hours,boss_id=t.boss_id,kind=k,rule=p_rule,steps=coalesce(p_data->'steps',steps) where id=p_id;
end $$;

create or replace function public.aq_edit_mission(p_task_id uuid,p_routine_id uuid,p_data jsonb,p_rule jsonb,p_scope text) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();r public.aq_routines%rowtype;p public.aq_task_plans%rowtype;t public.tasks%rowtype;cutoff date;old_rule jsonb;old_kind text;
begin
 if uid is null then raise exception 'Entre novamente';end if;
 if p_scope not in ('one','future','all') then raise exception 'Escopo inválido';end if;
 if p_task_id is null and p_routine_id is null then perform public.aq_save_task(null,p_data,p_rule,'one');return;end if;
 if p_scope='one' then perform public.aq_save_task(p_task_id,p_data,p_rule,'one');return;end if;
 if p_task_id is not null then
  select * into p from public.aq_task_plans where task_id=p_task_id and user_id=uid and not superseded;
  p_routine_id:=p.routine_id;
 end if;
 select * into r from public.aq_routines where id=p_routine_id and user_id=uid for update;
 if not found then raise exception 'Série indisponível';end if;
 old_rule:=r.rule;old_kind:=r.kind;
 cutoff:=case when p_scope='all' then (now() at time zone 'America/Sao_Paulo')::date else p.occurrence_date end;
 if cutoff is null then raise exception 'Ocorrência indisponível';end if;
 perform public.aq_save_routine(r.id,p_data,p_rule);
 select * into r from public.aq_routines where id=r.id;
 t:=jsonb_populate_record(null::public.tasks,p_data);
 if p_rule is null then return;end if;
 -- Update editable metadata across pending occurrences. Completed records are immutable.
 update public.tasks x set title=trim(t.title),description=coalesce(trim(t.description),''),category=t.category,priority=t.priority,estimated_hours=t.estimated_hours,boss_id=t.boss_id from public.aq_task_plans q where x.id=q.task_id and q.routine_id=r.id and q.user_id=uid and not q.superseded and x.status='pending' and (p_scope='all' or q.occurrence_date>=cutoff);
 update public.aq_task_plans q set kind=r.kind from public.tasks x where x.id=q.task_id and q.routine_id=r.id and not q.superseded and x.status='pending' and (p_scope='all' or q.occurrence_date>=cutoff);
 if r.rule is distinct from old_rule then
  -- Archive rather than delete old future occurrences. Partial progress remains in history.
  update public.aq_task_plans q set superseded=true from public.tasks x where x.id=q.task_id and q.routine_id=r.id and not q.superseded and x.status='pending' and q.occurrence_date>=cutoff;
  update public.tasks x set status='skipped' from public.aq_task_plans q where q.task_id=x.id and q.routine_id=r.id and q.superseded and x.status='pending';
  update public.aq_routines set cursor_date=greatest(cutoff,(rule->>'start')::date)-1,emitted=(select count(*) from public.aq_task_plans where routine_id=r.id and not superseded and occurrence_date<cutoff) where id=r.id;
  perform public.aq_materialize();
 elsif p_task_id is not null then
  update public.tasks set due_date=t.due_date where id=p_task_id and user_id=uid and status='pending';
 end if;
end $$;

create or replace function public.aq_gpt_create_task(p_token text,p_title text,p_category text default 'Pessoal',p_priority text default 'medium',p_estimated_hours numeric default 1,p_due_date date default null,p_notes text default '') returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid; tid uuid; clean_priority text:=coalesce(nullif(trim(p_priority),''),'medium'); clean_category text:=coalesce(nullif(trim(p_category),''),'Pessoal'); clean_hours numeric:=coalesce(p_estimated_hours,1);
begin
 uid:=public.aq_gpt_token_user(p_token);
 perform set_config('request.jwt.claim.sub',uid::text,true);
 if length(coalesce(p_notes,''))>4000 then raise exception 'Descrição longa demais'; end if;
 if p_title is null or length(trim(p_title)) not between 1 and 200 then raise exception 'Informe o nome da missão'; end if;
 if clean_priority not in ('low','medium','high') then clean_priority:='medium'; end if;
 if clean_hours<=0 or clean_hours>1000 then clean_hours:=1; end if;
 insert into public.tasks(user_id,title,description,category,priority,estimated_hours,due_date,status) values(uid,trim(p_title),coalesce(trim(p_notes),''),clean_category,clean_priority,clean_hours,p_due_date,'pending') returning id into tid;
 insert into public.aq_task_plans(task_id,user_id,kind) values(tid,uid,'task') on conflict(task_id) do nothing;
 return jsonb_build_object('id',tid,'status','created','title',trim(p_title),'category',clean_category,'priority',clean_priority,'due_date',p_due_date,'notes_received',coalesce(p_notes,'')<>'');
end $$;

create or replace function public.aq_gpt_list_tasks(p_token text,p_scope text default 'today',p_limit int default 12) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid; today date:=(now() at time zone 'America/Sao_Paulo')::date; clean_scope text:=coalesce(nullif(trim(p_scope),''),'today'); clean_limit int:=least(greatest(coalesce(p_limit,12),1),50); items jsonb;
begin
 uid:=public.aq_gpt_token_user(p_token);
 if clean_scope not in ('today','pending','overdue','all') then raise exception 'Filtro de missões inválido'; end if;
 select jsonb_agg(to_jsonb(q)) into items from (
  select id,title,description,category,priority,estimated_hours,due_date,status,completed_at
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
notify pgrst, 'reload schema';
commit;
