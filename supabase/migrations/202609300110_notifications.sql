begin;

create table if not exists public.aq_notification_rules (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 task_id uuid references public.tasks(id) on delete cascade,
 kind text not null default 'daily_summary' check(kind in ('daily_summary','task')),
 title text not null check(length(trim(title)) between 1 and 160),
 weekdays int[] not null default '{1,2,3,4,5}' check(cardinality(weekdays) between 1 and 7),
 time_of_day time not null,
 active boolean not null default true,
 phrase_index int not null default 0 check(phrase_index >= 0),
 last_sent_on date,
 created_at timestamptz not null default now()
);

create index if not exists aq_notification_rules_owner on public.aq_notification_rules(user_id, active, time_of_day);
alter table public.aq_notification_rules enable row level security;
drop policy if exists own_notification_rules on public.aq_notification_rules;
create policy own_notification_rules on public.aq_notification_rules for select to authenticated using(user_id=(select auth.uid()));
revoke all on public.aq_notification_rules from anon, authenticated;
grant select on public.aq_notification_rules to authenticated;

create or replace function public.aq_save_notification_rule(p_id uuid,p_kind text,p_task_id uuid,p_title text,p_weekdays int[],p_time_of_day time,p_active boolean) returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); result uuid; clean_days int[];
begin
 if uid is null then raise exception 'Não autenticado'; end if;
 clean_days := (select array_agg(distinct d order by d) from unnest(p_weekdays) d where d between 0 and 6);
 if p_kind not in ('daily_summary','task') or p_time_of_day is null or clean_days is null or cardinality(clean_days)=0 or length(trim(coalesce(p_title,''))) not between 1 and 160 then raise exception 'Confira os dados do lembrete'; end if;
 if p_kind='task' and not exists(select 1 from public.tasks where id=p_task_id and user_id=uid) then raise exception 'Missão indisponível'; end if;
 if p_kind='daily_summary' then p_task_id:=null; end if;
 if p_id is null then
  insert into public.aq_notification_rules(user_id,task_id,kind,title,weekdays,time_of_day,active) values(uid,p_task_id,p_kind,trim(p_title),clean_days,p_time_of_day,coalesce(p_active,true)) returning id into result;
 else
  update public.aq_notification_rules set task_id=p_task_id,kind=p_kind,title=trim(p_title),weekdays=clean_days,time_of_day=p_time_of_day,active=coalesce(p_active,true) where id=p_id and user_id=uid returning id into result;
  if result is null then raise exception 'Lembrete indisponível'; end if;
 end if;
 return result;
end $$;

create or replace function public.aq_toggle_notification_rule(p_id uuid,p_active boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Não autenticado'; end if;
 update public.aq_notification_rules set active=p_active where id=p_id and user_id=auth.uid();
 if not found then raise exception 'Lembrete indisponível'; end if;
end $$;

revoke execute on function public.aq_save_notification_rule(uuid,text,uuid,text,int[],time,boolean), public.aq_toggle_notification_rule(uuid,boolean) from public,anon;
grant execute on function public.aq_save_notification_rule(uuid,text,uuid,text,int[],time,boolean), public.aq_toggle_notification_rule(uuid,boolean) to authenticated;

notify pgrst,'reload schema';
commit;
