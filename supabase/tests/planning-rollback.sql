-- Executar no SQL Editor como administrador. Usa a primeira conta existente apenas
-- dentro da transação; todas as gravações são desfeitas. Qualquer falha interrompe.
begin;
do $$ begin perform set_config('request.jwt.claim.sub',(select id::text from auth.users order by created_at limit 1),true); end $$;
set local role authenticated;
do $$
declare b uuid;t uuid;copied uuid;r uuid;rule jsonb;data jsonb;failed boolean;x numeric; coins numeric;
begin
 select coalesce(sum(amount),0) into x from public.xp_transactions;
 select coalesce(sum(amount),0) into coins from public.coin_transactions;
 b:=public.aq_save_boss_details(null,'__AQ_TEST__','Saúde',10,'Teste transacional',current_date+30);
 if not exists(select 1 from public.bosses where id=b and description='Teste transacional' and due_date=current_date+30) then raise exception 'Boss metadata failed';end if;
 data:=jsonb_build_object('title','__AQ_TEST__','category','Saúde','priority','medium','estimated_hours',1,'kind','workout','boss_id',b);
 t:=public.aq_save_task(null,data,null,'one');
 perform public.aq_save_steps(t,'[{"id":"a","title":"Esteira","target":"3 km","actual":"2 km","done":true}]'::jsonb);
 copied:=public.aq_repeat_workout(t);
 if (select steps->0->>'done' from public.aq_task_plans where task_id=copied)<>'false' or (select steps->0->>'actual' from public.aq_task_plans where task_id=copied)<>'' then raise exception 'Copy reset failed';end if;
 if (select steps->0->>'actual' from public.aq_task_plans where task_id=t)<>'2 km' then raise exception 'Original session changed';end if;
 rule:=jsonb_build_object('frequency','daily','interval',1,'weekdays','[1]'::jsonb,'start',(now() at time zone 'America/Sao_Paulo')::date::text,'until',null,'count',2);
 t:=public.aq_save_task(null,data,rule,'one');select routine_id into r from public.aq_task_plans where task_id=t;
 perform public.aq_save_routine(r,data||'{"title":"__AQ_TEST__ future"}'::jsonb,rule);
 if (select title from public.tasks where id=t)<>'__AQ_TEST__' then raise exception 'History changed on template edit';end if;
 if (select title from public.aq_routines where id=r)<>'__AQ_TEST__ future' then raise exception 'Template edit failed';end if;
 perform public.complete_task(t);perform public.complete_task(t);
 if (select coalesce(sum(amount),0) from public.xp_transactions)-x<>1 or (select coalesce(sum(amount),0) from public.coin_transactions)-coins<>1 then raise exception 'Reward or idempotency failed';end if;
 if (select current_hp from public.bosses where id=b)>=10 then raise exception 'Boss damage failed';end if;
 perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 if exists(select 1 from public.aq_task_plans where task_id=copied) then raise exception 'RLS failed';end if;
 failed:=false;begin perform public.aq_repeat_workout(copied);exception when others then failed:=true;end;
 if not failed then raise exception 'Other user copied session';end if;
end $$;
rollback;
select 'PASS: authenticated permissions, RLS isolation, boss details, repeat workout, template edit, original rewards and idempotency. All test writes rolled back.' as result,
(select count(*) from public.tasks where title like '__AQ_TEST__%') as leftover_test_tasks;
