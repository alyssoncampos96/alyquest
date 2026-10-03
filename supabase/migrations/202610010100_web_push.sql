begin;

create table if not exists public.aq_push_subscriptions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 endpoint text not null unique,
 p256dh text not null,
 auth text not null,
 user_agent text,
 revoked_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create index if not exists aq_push_subscriptions_owner on public.aq_push_subscriptions(user_id, revoked_at);
alter table public.aq_push_subscriptions enable row level security;

drop policy if exists own_push_subscriptions_select on public.aq_push_subscriptions;
drop policy if exists own_push_subscriptions_insert on public.aq_push_subscriptions;
drop policy if exists own_push_subscriptions_update on public.aq_push_subscriptions;
drop policy if exists own_push_subscriptions_delete on public.aq_push_subscriptions;

create policy own_push_subscriptions_select on public.aq_push_subscriptions for select to authenticated using(user_id=(select auth.uid()));
create policy own_push_subscriptions_insert on public.aq_push_subscriptions for insert to authenticated with check(user_id=(select auth.uid()));
create policy own_push_subscriptions_update on public.aq_push_subscriptions for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy own_push_subscriptions_delete on public.aq_push_subscriptions for delete to authenticated using(user_id=(select auth.uid()));

revoke all on public.aq_push_subscriptions from anon, authenticated;
grant select, insert, update, delete on public.aq_push_subscriptions to authenticated;

notify pgrst,'reload schema';
commit;
