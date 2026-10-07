create table if not exists public.aq_rest_sessions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  target_minutes integer not null check (target_minutes between 1 and 240),
  active_seconds integer not null default 0 check (active_seconds >= 0),
  running_since timestamptz,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  cancelled_at timestamptz,
  reward_coins integer not null default 0
);
create index if not exists aq_rest_sessions_user_created_idx on public.aq_rest_sessions(user_id,created_at desc);
alter table public.aq_rest_sessions enable row level security;
drop policy if exists "Read own rests" on public.aq_rest_sessions;
create policy "Read own rests" on public.aq_rest_sessions for select to authenticated using (user_id = (select auth.uid()));
grant select on public.aq_rest_sessions to authenticated;

create or replace function public.aq_rest_session(p_session_id uuid,p_action text,p_target_minutes integer default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); s public.aq_rest_sessions%rowtype; elapsed integer; earned integer;
begin
  if uid is null or p_session_id is null or p_action not in ('start','pause','resume','complete','cancel') then
    raise exception 'Sessão de descanso inválida';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_session_id::text,0));
  select * into s from public.aq_rest_sessions where id=p_session_id for update;
  if p_action='start' and not found then
    if p_target_minutes is null or p_target_minutes not between 1 and 240 then raise exception 'Escolha de 1 a 240 minutos'; end if;
    insert into public.aq_rest_sessions(id,user_id,target_minutes,running_since)
    values(p_session_id,uid,p_target_minutes,now()) returning * into s;
  elsif not found or s.user_id<>uid then
    raise exception 'Sessão de descanso indisponível';
  elsif p_action='start' then
    if s.target_minutes is distinct from p_target_minutes then raise exception 'Duração diferente da sessão iniciada'; end if;
  end if;
  if s.completed_at is not null or s.cancelled_at is not null then
    return jsonb_build_object('status',case when s.completed_at is not null then 'completed' else 'cancelled' end,'seconds',s.active_seconds,'coins',s.reward_coins,'minutes',s.target_minutes);
  end if;
  elapsed := s.active_seconds + case when s.running_since is null then 0 else greatest(0,floor(extract(epoch from now()-s.running_since))::integer) end;
  if p_action='pause' and s.running_since is not null then
    update public.aq_rest_sessions set active_seconds=elapsed,running_since=null where id=s.id returning * into s;
  elsif p_action='resume' and s.running_since is null then
    update public.aq_rest_sessions set running_since=now() where id=s.id returning * into s;
  elsif p_action='cancel' then
    update public.aq_rest_sessions set active_seconds=elapsed,running_since=null,cancelled_at=now() where id=s.id returning * into s;
    return jsonb_build_object('status','cancelled','seconds',elapsed,'coins',0,'minutes',s.target_minutes);
  elsif p_action='complete' then
    if elapsed < s.target_minutes*60 then raise exception 'O descanso ainda não terminou'; end if;
    earned := floor(s.target_minutes/15);
    update public.aq_rest_sessions set active_seconds=s.target_minutes*60,running_since=null,completed_at=now(),reward_coins=earned where id=s.id returning * into s;
    if earned>0 then
      insert into public.coin_transactions(user_id,amount,reason,reference_id)
      values(uid,earned,'Descanso: '||s.target_minutes||' min',s.id);
    end if;
    return jsonb_build_object('status','completed','seconds',s.active_seconds,'coins',earned,'minutes',s.target_minutes);
  end if;
  return jsonb_build_object('status',case when s.running_since is null then 'paused' else 'running' end,'seconds',elapsed,'coins',0,'minutes',s.target_minutes);
end $$;
revoke execute on function public.aq_rest_session(uuid,text,integer) from public,anon;
grant execute on function public.aq_rest_session(uuid,text,integer) to authenticated;
notify pgrst,'reload schema';
