-- Run in the SQL editor as postgres. The whole test is rolled back.
begin;
select set_config('request.jwt.claim.sub',(select id::text from auth.users order by created_at limit 1),true);
select set_config('aq.rest.test_id',gen_random_uuid()::text,true);
set local role authenticated;
select public.aq_rest_session(current_setting('aq.rest.test_id')::uuid,'start',15);
do $$ begin
  begin
    perform public.aq_rest_session(current_setting('aq.rest.test_id')::uuid,'complete');
    raise exception 'Premature completion was accepted';
  exception when others then
    if sqlerrm <> 'O descanso ainda não terminou' then raise; end if;
  end;
end $$;
select public.aq_rest_session(current_setting('aq.rest.test_id')::uuid,'pause');
select public.aq_rest_session(current_setting('aq.rest.test_id')::uuid,'resume');
reset role;
update public.aq_rest_sessions set running_since=now()-interval '15 minutes 1 second'
where id=current_setting('aq.rest.test_id')::uuid;
set local role authenticated;
select public.aq_rest_session(current_setting('aq.rest.test_id')::uuid,'complete');
do $$ declare result jsonb; begin
  result:=public.aq_rest_session(current_setting('aq.rest.test_id')::uuid,'complete');
  if result->>'status'<>'completed' or (result->>'coins')::int<>1 then raise exception 'Incorrect or non-idempotent reward: %',result; end if;
end $$;
reset role;
do $$ declare n int; begin
  select count(*) into n from public.coin_transactions where reference_id=current_setting('aq.rest.test_id')::uuid;
  if n<>1 then raise exception 'Expected one coin transaction, got %',n; end if;
end $$;
select set_config('aq.rest.test_id_2',gen_random_uuid()::text,true);
set local role authenticated;
select public.aq_rest_session(current_setting('aq.rest.test_id_2')::uuid,'start',30);
reset role;
update public.aq_rest_sessions set running_since=now()-interval '30 minutes 1 second'
where id=current_setting('aq.rest.test_id_2')::uuid;
set local role authenticated;
do $$ declare result jsonb; begin
  result:=public.aq_rest_session(current_setting('aq.rest.test_id_2')::uuid,'complete');
  if (result->>'coins')::int<>2 then raise exception '30 minutes should earn two coins: %',result; end if;
end $$;
rollback;
