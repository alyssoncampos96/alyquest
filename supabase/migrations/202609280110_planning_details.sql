begin;
alter table public.bosses add column if not exists description text not null default '';
alter table public.bosses add column if not exists due_date date;
create function public.aq_save_boss_details(p_id uuid,p_name text,p_category text,p_hp numeric,p_description text,p_due_date date) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if p_description is null or length(p_description)>2000 then raise exception 'Descrição inválida'; end if;
 result:=public.aq_save_boss(p_id,p_name,p_category,p_hp);
 update public.bosses set description=p_description,due_date=p_due_date where id=result and user_id=auth.uid();
 return result;
end $$;
create function public.aq_save_routine(p_id uuid,p_data jsonb,p_rule jsonb) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); r public.aq_routines%rowtype; t public.tasks%rowtype; k text:=coalesce(p_data->>'kind','task');
begin
 if uid is null then raise exception 'Não autenticado'; end if;
 select * into r from public.aq_routines where id=p_id and user_id=uid for update;
 if not found then raise exception 'Recorrência indisponível'; end if;
 if p_rule is null then update public.aq_routines set active=false where id=p_id;return;end if;
 t:=jsonb_populate_record(null::public.tasks,p_data);
 if t.title is null or length(trim(t.title)) not between 1 and 200 or t.estimated_hours is null or t.estimated_hours<=0 or t.estimated_hours>1000 or t.priority::text not in ('low','medium','high') or t.category is null or k not in ('task','workout') then raise exception 'Dados inválidos';end if;
 if t.boss_id is not null and not exists(select 1 from public.bosses where id=t.boss_id and user_id=uid and defeated_at is null) then raise exception 'Chefe indisponível';end if;
 p_rule:=jsonb_set(p_rule,'{start}',r.rule->'start');perform public.aq_validate_rule(p_rule);
 update public.aq_routines set title=trim(t.title),category=t.category::text,priority=t.priority::text,estimated_hours=t.estimated_hours,boss_id=t.boss_id,kind=k,rule=p_rule where id=p_id;
end $$;
create function public.aq_repeat_workout(p_task_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); t public.tasks%rowtype; p public.aq_task_plans%rowtype; tid uuid; clean jsonb;
begin
 if uid is null then raise exception 'Não autenticado'; end if;
 select * into t from public.tasks where id=p_task_id and user_id=uid;
 select * into p from public.aq_task_plans where task_id=p_task_id and user_id=uid and kind='workout';
 if t.id is null or p.task_id is null then raise exception 'Treino indisponível'; end if;
 tid:=public.aq_save_task(null,jsonb_build_object('title',t.title,'category',t.category,'priority',t.priority,'estimated_hours',t.estimated_hours,'due_date',(now() at time zone 'America/Sao_Paulo')::date,'boss_id',case when exists(select 1 from public.bosses where id=t.boss_id and user_id=uid and defeated_at is null) then t.boss_id else null end,'kind','workout'),null,'one');
 select coalesce(jsonb_agg(value||jsonb_build_object('done',false,'actual','') order by ordinal),'[]'::jsonb) into clean from jsonb_array_elements(p.steps) with ordinality as x(value,ordinal);
 perform public.aq_save_steps(tid,clean);
 return tid;
end $$;
revoke execute on function public.aq_save_boss_details(uuid,text,text,numeric,text,date),public.aq_save_routine(uuid,jsonb,jsonb),public.aq_repeat_workout(uuid) from public,anon;
grant execute on function public.aq_save_boss_details(uuid,text,text,numeric,text,date),public.aq_save_routine(uuid,jsonb,jsonb),public.aq_repeat_workout(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
