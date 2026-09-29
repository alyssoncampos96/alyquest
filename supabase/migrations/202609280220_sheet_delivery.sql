begin;
alter table public.aq_sheet_outbox add column lease_token uuid, add column lease_until timestamptz;
create function public.aq_sheet_claim(p_task_id uuid,p_version uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare token uuid:=gen_random_uuid();begin
 if auth.uid() is null then raise exception 'Entre novamente';end if;
 update public.aq_sheet_outbox set lease_token=token,lease_until=clock_timestamp()+interval '60 seconds' where task_id=p_task_id and user_id=auth.uid() and version=p_version and state='pending' and (lease_until is null or lease_until<clock_timestamp());
 if not found then return null;end if;return token;
end $$;
create function public.aq_sheet_release(p_task_id uuid,p_version uuid,p_token uuid,p_ok boolean,p_message text) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Entre novamente';end if;
 update public.aq_sheet_outbox set lease_token=null,lease_until=null,state=case when version=p_version and p_ok then 'synced' else state end,message=case when version=p_version then left(coalesce(p_message,''),500) else message end where task_id=p_task_id and user_id=auth.uid() and lease_token=p_token;
end $$;
revoke execute on function public.aq_sheet_claim(uuid,uuid),public.aq_sheet_release(uuid,uuid,uuid,boolean,text) from public,anon;
grant execute on function public.aq_sheet_claim(uuid,uuid),public.aq_sheet_release(uuid,uuid,uuid,boolean,text) to authenticated;
create or replace function public.aq_finish_mission(p_task_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
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
 if found then insert into public.aq_sheet_outbox(task_id,user_id,desired_status,previous_status) values(t.id,uid,'Concluído',prev) on conflict(task_id) do update set version=gen_random_uuid(),desired_status='Concluído',previous_status=case when public.aq_sheet_outbox.desired_status<>'Concluído' then public.aq_sheet_outbox.desired_status else excluded.previous_status end,state='pending',message='',updated_at=now();end if;
 return jsonb_build_object('task_id',t.id,'xp',reward+bx+step_delta,'coins',reward+bc+step_delta,'damage',damage,'undo_id',event_id);
end $$;
notify pgrst,'reload schema';
commit;
