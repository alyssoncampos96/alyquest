begin;
alter table public.aq_task_plans add column superseded boolean not null default false;
alter table public.aq_task_plans drop constraint aq_task_plans_routine_id_occurrence_date_key;
create unique index aq_active_occurrence on public.aq_task_plans(routine_id,occurrence_date) where not superseded;
alter table public.aq_routines add column resumed_at timestamptz;
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
     t:=jsonb_populate_record(null::public.tasks,jsonb_build_object('title',r.title,'category',r.category,'priority',r.priority,'estimated_hours',r.estimated_hours,'boss_id',r.boss_id));
     insert into public.tasks(user_id,title,category,priority,estimated_hours,due_date,boss_id,status)
      values(uid,t.title,t.category,t.priority,t.estimated_hours,d,t.boss_id,'pending') returning id into tid;
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
create function public.aq_edit_mission(p_task_id uuid,p_routine_id uuid,p_data jsonb,p_rule jsonb,p_scope text) returns void language plpgsql security definer set search_path='' as $$
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
 update public.tasks x set title=trim(t.title),category=t.category,priority=t.priority,estimated_hours=t.estimated_hours,boss_id=t.boss_id from public.aq_task_plans q where x.id=q.task_id and q.routine_id=r.id and q.user_id=uid and not q.superseded and x.status='pending' and (p_scope='all' or q.occurrence_date>=cutoff);
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
create or replace function public.aq_pause_routine(p_id uuid,p_active boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Não autenticado';end if;
 update public.aq_routines set resumed_at=case when p_active and not active then now() else resumed_at end,active=p_active where id=p_id and user_id=auth.uid();
 if not found then raise exception 'Recorrência indisponível';end if;
end $$;
revoke execute on function public.aq_edit_mission(uuid,uuid,jsonb,jsonb,text) from public,anon;
grant execute on function public.aq_edit_mission(uuid,uuid,jsonb,jsonb,text) to authenticated;
notify pgrst,'reload schema';
commit;
