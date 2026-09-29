begin;
do $$ begin perform set_config('request.jwt.claim.sub','1aef265b-8a27-4b3b-81ba-2942a6edbe98',true);end $$;
set local role authenticated;
do $$
declare t uuid;r uuid;b uuid;event uuid;x numeric;c numeric;result jsonb;steps jsonb;payload jsonb;rule jsonb;failed boolean;v uuid;lease uuid;next_t uuid;done_t uuid;
begin
 payload:='{"title":"__AQ_TEST__ steps","category":"Saúde","priority":"medium","estimated_hours":3,"kind":"task"}'::jsonb;
 t:=public.aq_save_task(null,payload,null,'one');
 steps:='[{"id":"a","title":"A","target":"","actual":"","done":true},{"id":"b","title":"B","target":"","actual":"","done":true},{"id":"c","title":"C","target":"","actual":"","done":true},{"id":"d","title":"D","target":"","actual":"","done":true}]'::jsonb;
 result:=public.aq_save_steps_v2(t,steps,0);if (result->>'xp')::int<>4 then raise exception 'Four steps reward failed';end if;
 failed:=false;begin perform public.aq_save_steps_v2(t,steps,0);exception when others then failed:=true;end;if not failed then raise exception 'Stale revision accepted';end if;
 result:=public.aq_save_steps_v2(t,steps,1);if (result->>'xp')::int<>0 then raise exception 'Repeated save rewarded twice';end if;
 steps:=jsonb_set(steps,'{0,done}','false');result:=public.aq_save_steps_v2(t,steps,2);if (result->>'xp')::int<>-1 then raise exception 'Unchecked step not reversed';end if;
 steps:=jsonb_set(steps,'{0,done}','true');perform public.aq_save_steps_v2(t,steps,3);
 result:=public.aq_finish_mission(t);event:=(result->>'undo_id')::uuid;
 if (result->>'xp')::numeric<>1 or (select sum(amount) from public.xp_transactions where reference_id=t)<>5 or (select sum(amount) from public.coin_transactions where reference_id=t)<>5 then raise exception 'Four steps + completion must equal five';end if;
 perform public.aq_finish_mission(t);if (select sum(amount) from public.xp_transactions where reference_id=t)<>5 then raise exception 'Double completion awarded';end if;
 perform public.aq_undo_mission(event);perform public.aq_undo_mission(event);if (select sum(amount) from public.xp_transactions where reference_id=t)<>4 or (select status from public.tasks where id=t)<>'pending' then raise exception 'Undo incorrect';end if;
 perform public.aq_task_state(t,'cancel');failed:=false;begin perform public.aq_finish_mission(t);exception when others then failed:=true;end;if not failed then raise exception 'Cancelled task completed';end if;
 perform public.aq_task_state(t,'restore');perform public.aq_task_state(t,'postpone',current_date+1);if (select due_date from public.tasks where id=t)<>current_date+1 then raise exception 'Postpone failed';end if;
 -- Boss damage and defeat rewards must reverse exactly.
 b:=public.aq_save_boss(null,'__AQ_TEST__ boss','Saúde',1);
 payload:=jsonb_set(payload,'{boss_id}',to_jsonb(b));
 t:=public.aq_save_task(null,payload,null,'one');
 select coalesce(sum(amount),0) into x from public.xp_transactions;select coalesce(sum(amount),0) into c from public.coin_transactions;
 result:=public.aq_finish_mission(t);event:=(result->>'undo_id')::uuid;
 if (result->>'damage')::numeric<>1 or (select current_hp from public.bosses where id=b)<>0 then raise exception 'Boss defeat failed';end if;
 perform public.aq_undo_mission(event);
 if (select current_hp from public.bosses where id=b)<>1 or (select defeated_at from public.bosses where id=b) is not null or (select coalesce(sum(amount),0) from public.xp_transactions)<>x or (select coalesce(sum(amount),0) from public.coin_transactions)<>c then raise exception 'Boss undo failed';end if;
 payload:=payload-'boss_id';
 -- Recurrence edits preserve completed records and regenerate pending dates.
 payload:=jsonb_set(payload,'{kind}','"workout"');rule:=jsonb_build_object('frequency','daily','interval',1,'weekdays','[1]'::jsonb,'start',(now() at time zone 'America/Sao_Paulo')::date::text,'until',null,'count',7);
 t:=public.aq_save_task(null,payload,rule,'one');select routine_id into r from public.aq_task_plans where task_id=t;
 perform public.aq_finish_mission(t);done_t:=t;
 select q.task_id into next_t from public.aq_task_plans q join public.tasks x on x.id=q.task_id where q.routine_id=r and x.status='pending' order by q.occurrence_date limit 1;
 payload:=jsonb_set(payload,'{title}','"__AQ_TEST__ edited"');rule:=jsonb_set(rule,'{interval}','2');
 perform public.aq_edit_mission(next_t,null,payload,rule,'future');
 if (select status from public.tasks where id=done_t)<>'completed' or (select title from public.tasks where id=done_t)<>'__AQ_TEST__ steps' then raise exception 'Completed history modified';end if;
 if not exists(select 1 from public.aq_task_plans where task_id=next_t and superseded) then raise exception 'Old occurrence not archived';end if;
 select q.task_id into t from public.aq_task_plans q join public.tasks x on x.id=q.task_id where q.routine_id=r and not q.superseded and x.status='pending' order by q.occurrence_date limit 1;
 if t is null then raise exception 'Replacement occurrence missing';end if;
 perform public.aq_task_state(t,'skip');perform public.aq_materialize();if (select status from public.tasks where id=t)<>'skipped' then raise exception 'Skip lost';end if;
 -- Sheet outbox remains pending when an older worker releases after an undo.
 perform public.aq_import_sheet('Alysson Campos','[{"id":"__AQ_TEST__ queue","title":"__AQ_TEST__ sheet","status":"Pendente","active":true,"due":null,"project":"Test"}]'::jsonb);
 select task_id into t from public.aq_sheet_links where external_id='__AQ_TEST__ queue';result:=public.aq_finish_mission(t);event:=(result->>'undo_id')::uuid;
 select version into v from public.aq_sheet_outbox where task_id=t;lease:=public.aq_sheet_claim(t,v);if lease is null or public.aq_sheet_claim(t,v) is not null then raise exception 'Lease exclusivity failed';end if;
 perform public.aq_undo_mission(event);perform public.aq_sheet_release(t,v,lease,true,'');
 if not exists(select 1 from public.aq_sheet_outbox where task_id=t and state='pending' and desired_status='Pendente' and lease_token is null) then raise exception 'Newer outbox version was lost';end if;
 perform public.aq_finish_mission(t);if (select previous_status from public.aq_sheet_outbox where task_id=t)<>'Pendente' then raise exception 'Redo baseline lost';end if;
 perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 if exists(select 1 from public.aq_sheet_outbox where task_id=t) or exists(select 1 from public.aq_completion_events where task_id=t) then raise exception 'New tables RLS failed';end if;
 failed:=false;begin perform public.aq_finish_mission(t);exception when others then failed:=true;end;if not failed then raise exception 'Foreign completion accepted';end if;
end $$;
rollback;
select 'PASS: five-point reward, revisions, undo, task states, recurrence history, exclusive sheet delivery, redo and RLS. Rolled back.' as result,(select count(*) from public.tasks where title like '__AQ_TEST__%') as leftover_test_tasks;
