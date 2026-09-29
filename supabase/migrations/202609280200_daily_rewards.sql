begin;
alter table public.aq_task_plans add column revision integer not null default 0;
alter table public.aq_task_plans add column rewarded_steps integer not null default 0;
create table public.aq_completion_events(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),task_id uuid not null references public.tasks(id),xp numeric not null,coins numeric not null,boss_id uuid references public.bosses(id),boss_before jsonb,boss_after jsonb,damage numeric not null default 0,created_at timestamptz not null default now(),undone boolean not null default false);
create unique index aq_one_active_completion on public.aq_completion_events(task_id) where not undone;
alter table public.aq_completion_events enable row level security;
create policy own_events on public.aq_completion_events for select to authenticated using(user_id=auth.uid());
revoke all on public.aq_completion_events from anon,authenticated;
grant select on public.aq_completion_events to authenticated;
create table public.aq_sheet_outbox(task_id uuid primary key references public.tasks(id),user_id uuid not null references auth.users(id),version uuid not null default gen_random_uuid(),desired_status text not null,previous_status text not null,state text not null default 'pending',message text not null default '',updated_at timestamptz not null default now());
alter table public.aq_sheet_outbox enable row level security;
create policy own_outbox on public.aq_sheet_outbox for select to authenticated using(user_id=auth.uid());
revoke all on public.aq_sheet_outbox from anon,authenticated;
grant select on public.aq_sheet_outbox to authenticated;
create function public.aq_save_steps_v2(p_task_id uuid,p_steps jsonb,p_revision integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();old_count int:=0;new_count int;rev int:=0;delta int;
begin
 if uid is null then raise exception 'Entre novamente';end if;
 perform 1 from public.tasks where id=p_task_id and user_id=uid and status='pending' for update;
 if not found then raise exception 'Missão indisponível';end if;
 select rewarded_steps,revision into old_count,rev from public.aq_task_plans where task_id=p_task_id and user_id=uid for update;
 old_count:=coalesce(old_count,0);rev:=coalesce(rev,0);
 if p_revision is distinct from rev then raise exception 'O progresso mudou em outra aba. Recarregue antes de editar.';end if;
 perform public.aq_validate_steps(p_steps);
 perform public.aq_save_steps(p_task_id,p_steps);
 select count(*) into new_count from jsonb_array_elements(p_steps) s where s->>'done'='true';delta:=new_count-old_count;
 if delta<>0 then
  insert into public.xp_transactions(user_id,amount,reason,reference_id) values(uid,delta,'Etapas da missão',p_task_id);
  insert into public.coin_transactions(user_id,amount,reason,reference_id) values(uid,delta,'Etapas da missão',p_task_id);
 end if;
 update public.aq_task_plans set rewarded_steps=new_count,revision=rev+1 where task_id=p_task_id;
 return jsonb_build_object('revision',rev+1,'xp',delta,'coins',delta);
end $$;
create function public.aq_finish_mission(p_task_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();t public.tasks%rowtype;p public.aq_task_plans%rowtype;b public.bosses%rowtype;a public.bosses%rowtype;reward numeric;legacy_reward numeric;extra numeric:=0;bx numeric:=0;bc numeric:=0;step_delta int:=0;event_id uuid;damage numeric:=0;prev text;
begin
 if uid is null then raise exception 'Entre novamente';end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text||'missions',0));
 select * into t from public.tasks where id=p_task_id and user_id=uid for update;
 if not found then raise exception 'Missão indisponível';end if;
 if t.status='completed' then return jsonb_build_object('task_id',t.id,'xp',0,'coins',0,'damage',0,'undo_id',null);end if;
 if t.status<>'pending' then raise exception 'Restaure a missão antes de concluir';end if;
 select * into p from public.aq_task_plans where task_id=t.id and user_id=uid;
 legacy_reward:=greatest(coalesce(t.estimated_hours,1),0.5);reward:=legacy_reward;
 if p.task_id is not null and jsonb_array_length(p.steps)>0 then
  step_delta:=(public.aq_save_steps_v2(t.id,p.steps,p.revision)->>'xp')::int;
  reward:=1;
 end if;
 if t.boss_id is not null then select * into b from public.bosses where id=t.boss_id and user_id=uid for update;end if;
 perform public.complete_task(t.id);
 extra:=reward-legacy_reward;
 if extra<>0 then
  insert into public.xp_transactions(user_id,amount,reason,reference_id) values(uid,extra,'Ajuste: conclusão de missão com etapas',t.id);
  insert into public.coin_transactions(user_id,amount,reason,reference_id) values(uid,extra,'Ajuste: conclusão de missão com etapas',t.id);
 end if;
 if b.id is not null then
  select * into a from public.bosses where id=b.id;
  damage:=greatest(0,b.current_hp-a.current_hp);
  if b.defeated_at is null and a.defeated_at is not null then bx:=b.reward_xp;bc:=b.reward_coins;end if;
 end if;
 insert into public.aq_completion_events(user_id,task_id,xp,coins,boss_id,boss_before,boss_after,damage) values(uid,t.id,reward+bx,reward+bc,b.id,to_jsonb(b),to_jsonb(a),damage) returning id into event_id;
 select source_status into prev from public.aq_sheet_links where user_id=uid and task_id=t.id;
 if found then insert into public.aq_sheet_outbox(task_id,user_id,desired_status,previous_status) values(t.id,uid,'Concluído',prev) on conflict(task_id) do update set version=gen_random_uuid(),desired_status='Concluído',previous_status=excluded.previous_status,state='pending',message='',updated_at=now();end if;
 return jsonb_build_object('task_id',t.id,'xp',reward+bx+step_delta,'coins',reward+bc+step_delta,'damage',damage,'undo_id',event_id);
end $$;
create function public.aq_undo_mission(p_event_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();e public.aq_completion_events%rowtype;b public.bosses%rowtype;o public.aq_sheet_outbox%rowtype;
begin
 if uid is null then raise exception 'Entre novamente';end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text||'missions',0));
 select * into e from public.aq_completion_events where id=p_event_id and user_id=uid for update;
 if not found then raise exception 'Conclusão indisponível';end if;
 if e.undone then return;end if;
 if e.created_at<now()-interval '5 minutes' then raise exception 'O prazo de 5 minutos para desfazer terminou';end if;
 perform 1 from public.tasks where id=e.task_id and user_id=uid and status='completed' for update;
 if not found then raise exception 'A missão já foi alterada';end if;
 if e.damage>0 then
  select * into b from public.bosses where id=e.boss_id and user_id=uid for update;
  if b.current_hp is distinct from (e.boss_after->>'current_hp')::numeric or b.max_hp is distinct from (e.boss_after->>'max_hp')::numeric or b.defeated_at is distinct from (e.boss_after->>'defeated_at')::timestamptz then raise exception 'O chefe recebeu alterações posteriores. Desfaça primeiro a conclusão mais recente dele.';end if;
  update public.bosses set current_hp=(e.boss_before->>'current_hp')::numeric,defeated_at=(e.boss_before->>'defeated_at')::timestamptz where id=e.boss_id;
 end if;
 insert into public.xp_transactions(user_id,amount,reason,reference_id) values(uid,-e.xp,'Conclusão desfeita',e.task_id);
 insert into public.coin_transactions(user_id,amount,reason,reference_id) values(uid,-e.coins,'Conclusão desfeita',e.task_id);
 update public.tasks set status='pending',completed_at=null where id=e.task_id;
 update public.aq_completion_events set undone=true where id=e.id;
 select * into o from public.aq_sheet_outbox where task_id=e.task_id and user_id=uid for update;
 if found then update public.aq_sheet_outbox set version=gen_random_uuid(),desired_status=o.previous_status,previous_status='Concluído',state='pending',message='',updated_at=now() where task_id=e.task_id;end if;
end $$;
create function public.aq_task_state(p_task_id uuid,p_action text,p_date date default null) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();t public.tasks%rowtype;
begin
 if uid is null then raise exception 'Entre novamente';end if;
 select * into t from public.tasks where id=p_task_id and user_id=uid for update;
 if not found or t.status='completed' then raise exception 'Missão indisponível';end if;
 case p_action
 when 'postpone' then if p_date is null then raise exception 'Escolha uma data';end if;update public.tasks set due_date=p_date where id=t.id;
 when 'cancel' then update public.tasks set status='cancelled' where id=t.id;
 when 'skip' then if not exists(select 1 from public.aq_task_plans where task_id=t.id and routine_id is not null) then raise exception 'Não é recorrente';end if;update public.tasks set status='skipped' where id=t.id;
 when 'restore' then update public.tasks set status='pending' where id=t.id;
 else raise exception 'Ação inválida';end case;
end $$;
create function public.aq_sheet_ack(p_task_id uuid,p_version uuid,p_ok boolean,p_message text) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Entre novamente';end if;
 update public.aq_sheet_outbox set state=case when p_ok then 'synced' else 'pending' end,message=left(coalesce(p_message,''),500) where task_id=p_task_id and user_id=auth.uid() and version=p_version;
end $$;
revoke execute on function public.aq_save_steps_v2(uuid,jsonb,integer),public.aq_finish_mission(uuid),public.aq_undo_mission(uuid),public.aq_task_state(uuid,text,date),public.aq_sheet_ack(uuid,uuid,boolean,text) from public,anon;
grant execute on function public.aq_save_steps_v2(uuid,jsonb,integer),public.aq_finish_mission(uuid),public.aq_undo_mission(uuid),public.aq_task_state(uuid,text,date),public.aq_sheet_ack(uuid,uuid,boolean,text) to authenticated;
notify pgrst,'reload schema';
commit;
