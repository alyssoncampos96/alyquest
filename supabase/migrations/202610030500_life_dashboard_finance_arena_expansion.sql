begin;

create table if not exists public.aq_daily_missions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 mission_day date not null,
 code text not null,
 title text not null,
 description text not null default '',
 category text not null default 'Pessoal',
 target_count int not null default 1 check(target_count between 1 and 100),
 progress_count int not null default 0,
 reward_xp numeric not null default 1,
 reward_coins numeric not null default 1,
 completed_at timestamptz,
 created_at timestamptz not null default now(),
 unique(user_id, mission_day, code)
);

create table if not exists public.aq_quick_inbox (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 content text not null check(length(trim(content)) between 1 and 1000),
 kind text not null default 'idea' check(kind in ('idea','task','finance','workout','fasting','reminder')),
 status text not null default 'open' check(status in ('open','archived','converted')),
 created_at timestamptz not null default now()
);

create table if not exists public.aq_daily_plans (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 plan_day date not null,
 intention text not null default '',
 top_task_ids uuid[] not null default '{}',
 workout_intention text not null default '',
 focus_minutes int not null default 0,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(user_id, plan_day)
);

create table if not exists public.aq_night_reviews (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 review_day date not null,
 wins text not null default '',
 blockers text not null default '',
 tomorrow text not null default '',
 mood int check(mood between 1 and 5),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(user_id, review_day)
);

create table if not exists public.aq_finance_budgets (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 budget_month text not null check(budget_month ~ '^\d{4}-\d{2}$'),
 category text not null,
 amount numeric not null check(amount >= 0 and amount <= 100000000),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(user_id, budget_month, category)
);

create table if not exists public.aq_arena_battles (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 monster_id text not null,
 result text not null default 'win' check(result in ('win','lose')),
 battle jsonb not null default '{}'::jsonb,
 reward_xp numeric not null default 0,
 reward_coins numeric not null default 0,
 created_at timestamptz not null default now()
);

create table if not exists public.aq_consumable_uses (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 item_id uuid not null references public.items(id) on delete cascade,
 context text not null default 'arena',
 used_at timestamptz not null default now()
);

create table if not exists public.aq_theme_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 theme text not null default 'default',
 updated_at timestamptz not null default now()
);

alter table if exists public.user_items add column if not exists pet_xp numeric not null default 0;
alter table if exists public.user_items add column if not exists pet_level int not null default 1;

alter table public.aq_daily_missions enable row level security;
alter table public.aq_quick_inbox enable row level security;
alter table public.aq_daily_plans enable row level security;
alter table public.aq_night_reviews enable row level security;
alter table public.aq_finance_budgets enable row level security;
alter table public.aq_arena_battles enable row level security;
alter table public.aq_consumable_uses enable row level security;
alter table public.aq_theme_preferences enable row level security;

drop policy if exists own_daily_missions on public.aq_daily_missions;
drop policy if exists own_quick_inbox on public.aq_quick_inbox;
drop policy if exists own_daily_plans on public.aq_daily_plans;
drop policy if exists own_night_reviews on public.aq_night_reviews;
drop policy if exists own_finance_budgets on public.aq_finance_budgets;
drop policy if exists own_arena_battles on public.aq_arena_battles;
drop policy if exists own_consumable_uses on public.aq_consumable_uses;
drop policy if exists own_theme_preferences on public.aq_theme_preferences;

create policy own_daily_missions on public.aq_daily_missions for select to authenticated using(user_id=(select auth.uid()));
create policy own_quick_inbox on public.aq_quick_inbox for select to authenticated using(user_id=(select auth.uid()));
create policy own_daily_plans on public.aq_daily_plans for select to authenticated using(user_id=(select auth.uid()));
create policy own_night_reviews on public.aq_night_reviews for select to authenticated using(user_id=(select auth.uid()));
create policy own_finance_budgets on public.aq_finance_budgets for select to authenticated using(user_id=(select auth.uid()));
create policy own_arena_battles on public.aq_arena_battles for select to authenticated using(user_id=(select auth.uid()));
create policy own_consumable_uses on public.aq_consumable_uses for select to authenticated using(user_id=(select auth.uid()));
create policy own_theme_preferences on public.aq_theme_preferences for select to authenticated using(user_id=(select auth.uid()));

revoke all on public.aq_daily_missions,public.aq_quick_inbox,public.aq_daily_plans,public.aq_night_reviews,public.aq_finance_budgets,public.aq_arena_battles,public.aq_consumable_uses,public.aq_theme_preferences from anon,authenticated;
grant select on public.aq_daily_missions,public.aq_quick_inbox,public.aq_daily_plans,public.aq_night_reviews,public.aq_finance_budgets,public.aq_arena_battles,public.aq_consumable_uses,public.aq_theme_preferences to authenticated;

create or replace function public.aq_generate_daily_missions(p_day date default null) returns int language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); d date:=coalesce(p_day,(now() at time zone 'America/Sao_Paulo')::date); created int:=0; defs jsonb;
begin
 if uid is null then raise exception 'Não autenticado'; end if;
 defs:='[
  {"code":"tasks-3","title":"Trinca de missões","description":"Conclua 3 tarefas hoje.","category":"Pessoal","target":3,"xp":3,"coins":3},
  {"code":"focus-1","title":"Modo foco ligado","description":"Complete 1 sessão de foco.","category":"Trabalho","target":1,"xp":2,"coins":2},
  {"code":"finance-1","title":"Carteira no radar","description":"Registre 1 lançamento financeiro.","category":"Financeiro","target":1,"xp":1,"coins":1},
  {"code":"health-1","title":"Cuidar do corpo","description":"Faça 1 treino, jejum ou tarefa de saúde.","category":"Saúde","target":1,"xp":2,"coins":2}
 ]'::jsonb;
 insert into public.aq_daily_missions(user_id,mission_day,code,title,description,category,target_count,reward_xp,reward_coins)
 select uid,d,x->>'code',x->>'title',x->>'description',x->>'category',(x->>'target')::int,(x->>'xp')::numeric,(x->>'coins')::numeric
 from jsonb_array_elements(defs) x
 on conflict(user_id,mission_day,code) do nothing;
 get diagnostics created = row_count;
 update public.aq_daily_missions m set progress_count=least(m.target_count,case m.code
  when 'tasks-3' then (select count(*) from public.tasks t where t.user_id=uid and t.status='completed' and (t.completed_at at time zone 'America/Sao_Paulo')::date=d)
  when 'focus-1' then (select count(*) from public.pomodoro_sessions f where f.user_id=uid and f.focus_completed and (f.created_at at time zone 'America/Sao_Paulo')::date=d)
  when 'finance-1' then (select count(*) from public.aq_finance_transactions x where x.user_id=uid and x.occurred_on=d)
  when 'health-1' then (select count(*) from public.tasks t where t.user_id=uid and t.status='completed' and t.category='Saúde' and (t.completed_at at time zone 'America/Sao_Paulo')::date=d) + (select count(*) from public.aq_fasting_sessions f where f.user_id=uid and f.status='completed' and (f.ended_at at time zone 'America/Sao_Paulo')::date=d)
  else 0 end)
 where m.user_id=uid and m.mission_day=d and m.completed_at is null;
 return created;
end $$;

create or replace function public.aq_claim_daily_mission(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); m public.aq_daily_missions%rowtype; claim_id uuid:=gen_random_uuid();
begin
 if uid is null then raise exception 'Não autenticado'; end if;
 select * into m from public.aq_daily_missions where id=p_id and user_id=uid for update;
 if not found then raise exception 'Missão diária indisponível'; end if;
 if m.completed_at is not null then return jsonb_build_object('claimed',false,'xp',0,'coins',0); end if;
 perform public.aq_generate_daily_missions(m.mission_day);
 select * into m from public.aq_daily_missions where id=p_id and user_id=uid for update;
 if m.progress_count<m.target_count then raise exception 'Conclua o objetivo antes de resgatar'; end if;
 update public.aq_daily_missions set completed_at=now() where id=p_id;
 if m.reward_xp>0 then insert into public.xp_transactions(user_id,amount,reason,reference_id) values(uid,m.reward_xp,'Missão diária: '||m.code,claim_id); end if;
 if m.reward_coins>0 then insert into public.coin_transactions(user_id,amount,reason,reference_id) values(uid,m.reward_coins,'Missão diária: '||m.code,claim_id); end if;
 return jsonb_build_object('claimed',true,'xp',m.reward_xp,'coins',m.reward_coins);
end $$;

create or replace function public.aq_save_quick_inbox(p_content text,p_kind text default 'idea') returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); rid uuid;
begin
 if uid is null then raise exception 'Não autenticado'; end if;
 if length(trim(coalesce(p_content,''))) not between 1 and 1000 or coalesce(p_kind,'idea') not in ('idea','task','finance','workout','fasting','reminder') then raise exception 'Entrada inválida'; end if;
 insert into public.aq_quick_inbox(user_id,content,kind) values(uid,trim(p_content),p_kind) returning id into rid;
 return rid;
end $$;

create or replace function public.aq_update_quick_inbox(p_id uuid,p_status text) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Não autenticado'; end if;
 if p_status not in ('open','archived','converted') then raise exception 'Estado inválido'; end if;
 update public.aq_quick_inbox set status=p_status where id=p_id and user_id=auth.uid();
 if not found then raise exception 'Entrada indisponível'; end if;
end $$;

create or replace function public.aq_save_daily_plan(p_day date,p_intention text,p_top_task_ids uuid[],p_workout_intention text,p_focus_minutes int) returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); rid uuid;
begin
 if uid is null then raise exception 'Não autenticado'; end if;
 if p_day is null or coalesce(p_focus_minutes,0) not between 0 and 1440 then raise exception 'Plano inválido'; end if;
 insert into public.aq_daily_plans(user_id,plan_day,intention,top_task_ids,workout_intention,focus_minutes)
 values(uid,p_day,coalesce(p_intention,''),coalesce(p_top_task_ids,'{}'::uuid[]),coalesce(p_workout_intention,''),coalesce(p_focus_minutes,0))
 on conflict(user_id,plan_day) do update set intention=excluded.intention,top_task_ids=excluded.top_task_ids,workout_intention=excluded.workout_intention,focus_minutes=excluded.focus_minutes,updated_at=now()
 returning id into rid;
 return rid;
end $$;

create or replace function public.aq_save_night_review(p_day date,p_wins text,p_blockers text,p_tomorrow text,p_mood int) returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); rid uuid;
begin
 if uid is null then raise exception 'Não autenticado'; end if;
 if p_day is null or (p_mood is not null and p_mood not between 1 and 5) then raise exception 'Revisão inválida'; end if;
 insert into public.aq_night_reviews(user_id,review_day,wins,blockers,tomorrow,mood)
 values(uid,p_day,coalesce(p_wins,''),coalesce(p_blockers,''),coalesce(p_tomorrow,''),p_mood)
 on conflict(user_id,review_day) do update set wins=excluded.wins,blockers=excluded.blockers,tomorrow=excluded.tomorrow,mood=excluded.mood,updated_at=now()
 returning id into rid;
 return rid;
end $$;

create or replace function public.aq_save_finance_budget(p_month text,p_category text,p_amount numeric) returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); rid uuid;
begin
 if uid is null then raise exception 'Não autenticado'; end if;
 if p_month !~ '^\d{4}-\d{2}$' or length(trim(coalesce(p_category,''))) not between 1 and 80 or p_amount is null or p_amount<0 then raise exception 'Orçamento inválido'; end if;
 insert into public.aq_finance_budgets(user_id,budget_month,category,amount) values(uid,p_month,trim(p_category),p_amount)
 on conflict(user_id,budget_month,category) do update set amount=excluded.amount,updated_at=now()
 returning id into rid;
 return rid;
end $$;

create or replace function public.aq_set_theme(p_theme text) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Não autenticado'; end if;
 if coalesce(p_theme,'default') not in ('default','medieval','cyberpunk','forest','gym','finance') then raise exception 'Tema inválido'; end if;
 insert into public.aq_theme_preferences(user_id,theme) values(auth.uid(),p_theme)
 on conflict(user_id) do update set theme=excluded.theme,updated_at=now();
end $$;

create or replace function public.aq_claim_arena_victory_detail(p_monster_id text,p_battle jsonb default '{}'::jsonb,p_consumable_item_id uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); result jsonb; battle_id uuid; xp numeric:=0; coins numeric:=0; pet_gain numeric:=0;
begin
 if uid is null then raise exception 'Não autenticado'; end if;
 if p_battle is null or jsonb_typeof(p_battle) is distinct from 'object' then p_battle:='{}'::jsonb; end if;
 if p_consumable_item_id is not null then
  if not exists(select 1 from public.user_items ui join public.items i on i.id=ui.item_id where ui.user_id=uid and ui.item_id=p_consumable_item_id and coalesce(i.item_type,'')='consumable') or exists(select 1 from public.aq_consumable_uses cu where cu.user_id=uid and cu.item_id=p_consumable_item_id) then raise exception 'Consumível indisponível'; end if;
 end if;
 result:=public.aq_claim_arena_victory(p_monster_id);
 xp:=coalesce((result->>'xp')::numeric,0); coins:=coalesce((result->>'coins')::numeric,0);
 if coalesce((result->>'claimed')::boolean,false) then
  insert into public.aq_arena_battles(user_id,monster_id,result,battle,reward_xp,reward_coins) values(uid,p_monster_id,'win',p_battle,xp,coins) returning id into battle_id;
  if p_consumable_item_id is not null then insert into public.aq_consumable_uses(user_id,item_id,context) values(uid,p_consumable_item_id,'arena:'||p_monster_id); end if;
  pet_gain:=greatest(1,xp);
  update public.user_items ui set pet_xp=coalesce(ui.pet_xp,0)+pet_gain, pet_level=least(100,1+floor((coalesce(ui.pet_xp,0)+pet_gain)/25)::int)
  from public.items i where i.id=ui.item_id and ui.user_id=uid and coalesce(ui.equipped,false) and coalesce(i.item_type,'')='pet';
 end if;
 return result || jsonb_build_object('battle_id',battle_id,'pet_xp',pet_gain);
end $$;

revoke execute on function public.aq_generate_daily_missions(date),public.aq_claim_daily_mission(uuid),public.aq_save_quick_inbox(text,text),public.aq_update_quick_inbox(uuid,text),public.aq_save_daily_plan(date,text,uuid[],text,int),public.aq_save_night_review(date,text,text,text,int),public.aq_save_finance_budget(text,text,numeric),public.aq_set_theme(text),public.aq_claim_arena_victory_detail(text,jsonb,uuid) from public,anon;
grant execute on function public.aq_generate_daily_missions(date),public.aq_claim_daily_mission(uuid),public.aq_save_quick_inbox(text,text),public.aq_update_quick_inbox(uuid,text),public.aq_save_daily_plan(date,text,uuid[],text,int),public.aq_save_night_review(date,text,text,text,int),public.aq_save_finance_budget(text,text,numeric),public.aq_set_theme(text),public.aq_claim_arena_victory_detail(text,jsonb,uuid) to authenticated;

alter table if exists public.bosses alter column reward_coins set default 10;
update public.bosses set reward_coins=10 where coalesce(reward_coins,0)=0;
create unique index if not exists aq_consumable_once on public.aq_consumable_uses(user_id,item_id);
notify pgrst,'reload schema';
commit;



