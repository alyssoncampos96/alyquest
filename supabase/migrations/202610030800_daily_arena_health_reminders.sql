begin;

-- Três desafios mensuráveis por dia. A escolha varia em ciclos e nunca apaga
-- recompensas já resgatadas.
create or replace function public.aq_generate_daily_missions(p_day date default null)
returns int language plpgsql security definer set search_path='' as $$
declare
  uid uuid := auth.uid();
  d date := coalesce(p_day, (now() at time zone 'America/Sao_Paulo')::date);
  slot int;
  created int;
begin
  if uid is null then raise exception 'Não autenticado'; end if;
  if d <> (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'As missões só podem ser geradas para hoje';
  end if;
  slot := (d - date '2026-01-01') % 4;
  insert into public.aq_daily_missions
    (user_id, mission_day, code, title, description, category, target_count, reward_xp, reward_coins)
  select uid, d, code, title, description, category, target_count, reward_xp, 1
  from (values
    ('tasks-3', 'Trinca de missões', 'Conclua 3 tarefas hoje.', 'Pessoal', 3, 3, true),
    ('focus-1', 'Modo foco ligado', 'Complete uma sessão de foco.', 'Trabalho', 1, 2, slot in (0,1)),
    ('health-1', 'Cuidar do corpo', 'Conclua um treino, uma tarefa de saúde ou um jejum.', 'Saúde', 1, 2, slot in (1,2)),
    ('plan-1', 'Dia com direção', 'Salve seu plano do dia.', 'Pessoal', 1, 1, slot in (2,3)),
    ('finance-1', 'Carteira no radar', 'Registre um lançamento financeiro.', 'Financeiro', 1, 1, slot in (0,3))
  ) as v(code,title,description,category,target_count,reward_xp,selected)
  where selected
  on conflict (user_id,mission_day,code) do nothing;
  get diagnostics created = row_count;

  update public.aq_daily_missions m
  set progress_count = least(m.target_count, case m.code
    when 'tasks-3' then (select count(*) from public.tasks t where t.user_id=uid and t.status='completed' and (t.completed_at at time zone 'America/Sao_Paulo')::date=d)
    when 'focus-1' then (select count(*) from public.pomodoro_sessions f where f.user_id=uid and f.focus_completed and (f.completed_at at time zone 'America/Sao_Paulo')::date=d)
    when 'health-1' then
      (select count(*) from public.tasks t where t.user_id=uid and t.status='completed' and t.category='Saúde' and (t.completed_at at time zone 'America/Sao_Paulo')::date=d)
      + (select count(*) from public.aq_fasting_sessions f where f.user_id=uid and f.status='completed' and (f.ended_at at time zone 'America/Sao_Paulo')::date=d)
    when 'plan-1' then (select count(*) from public.aq_daily_plans p where p.user_id=uid and p.plan_day=d)
    when 'finance-1' then (select count(*) from public.aq_finance_transactions x where x.user_id=uid and x.occurred_on=d)
    else 0 end)
  where m.user_id=uid and m.mission_day=d and m.completed_at is null;
  return created;
end $$;

create or replace function public.aq_delete_notification_rule(p_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Não autenticado'; end if;
  delete from public.aq_notification_rules where id=p_id and user_id=auth.uid();
  if not found then raise exception 'Lembrete não encontrado'; end if;
end $$;

create table if not exists public.aq_arena_health (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_hp int not null check (current_hp >= 0),
  last_regen_at timestamptz not null default now()
);
create table if not exists public.aq_arena_potions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  quantity int not null default 0 check (quantity >= 0)
);
alter table public.aq_arena_health enable row level security;
alter table public.aq_arena_potions enable row level security;
drop policy if exists own_arena_health on public.aq_arena_health;
drop policy if exists own_arena_potions on public.aq_arena_potions;
create policy own_arena_health on public.aq_arena_health for select to authenticated using (user_id=(select auth.uid()));
create policy own_arena_potions on public.aq_arena_potions for select to authenticated using (user_id=(select auth.uid()));
revoke all on public.aq_arena_health, public.aq_arena_potions from anon,authenticated;
grant select on public.aq_arena_health, public.aq_arena_potions to authenticated;

create or replace function public.aq_arena_health_snapshot(p_max_hp int)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); hp int; tick timestamptz; gained int;
begin
  if uid is null then raise exception 'Não autenticado'; end if;
  if p_max_hp not between 1 and 10000 then raise exception 'HP máximo inválido'; end if;
  insert into public.aq_arena_health(user_id,current_hp) values(uid,p_max_hp)
  on conflict(user_id) do nothing;
  select current_hp,last_regen_at into hp,tick from public.aq_arena_health where user_id=uid for update;
  hp:=least(hp,p_max_hp);
  gained:=greatest(0,floor(extract(epoch from now()-tick)/3600)::int);
  if hp=p_max_hp then
    tick:=now();
  elsif gained>0 then
    hp:=least(p_max_hp,hp+gained);
    tick:=case when hp=p_max_hp then now() else tick+gained*interval '1 hour' end;
  end if;
  update public.aq_arena_health set current_hp=hp,last_regen_at=tick where user_id=uid;
  return jsonb_build_object('current_hp',hp,'max_hp',p_max_hp,'next_hp_at',case when hp<p_max_hp then tick+interval '1 hour' else null end);
end $$;

create or replace function public.aq_arena_take_damage(p_max_hp int,p_damage int)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); state jsonb; hp int; tick timestamptz;
begin
  if uid is null then raise exception 'Não autenticado'; end if;
  if p_damage not between 1 and 10000 then raise exception 'Dano inválido'; end if;
  state:=public.aq_arena_health_snapshot(p_max_hp);
  hp:=greatest(0,(state->>'current_hp')::int-p_damage);
  select last_regen_at into tick from public.aq_arena_health where user_id=uid for update;
  if (state->>'current_hp')::int=p_max_hp then tick:=now(); end if;
  update public.aq_arena_health set current_hp=hp,last_regen_at=tick where user_id=uid;
  return jsonb_build_object('current_hp',hp,'max_hp',p_max_hp,'next_hp_at',tick+interval '1 hour');
end $$;

create or replace function public.aq_buy_arena_potion()
returns int language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); balance numeric; qty int; purchase_id uuid:=gen_random_uuid();
begin
  if uid is null then raise exception 'Não autenticado'; end if;
  perform 1 from auth.users where id=uid for update;
  select coalesce(sum(amount),0) into balance from public.coin_transactions where user_id=uid;
  if balance<10 then raise exception 'Você precisa de 10 moedas para comprar uma poção'; end if;
  insert into public.coin_transactions(user_id,amount,reason,reference_id)
  values(uid,-10,'Poção de vida da Arena',purchase_id);
  insert into public.aq_arena_potions(user_id,quantity) values(uid,1)
  on conflict(user_id) do update set quantity=public.aq_arena_potions.quantity+1
  returning quantity into qty;
  return qty;
end $$;

create or replace function public.aq_use_arena_potion(p_max_hp int)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); state jsonb; hp int; qty int; tick timestamptz;
begin
  if uid is null then raise exception 'Não autenticado'; end if;
  state:=public.aq_arena_health_snapshot(p_max_hp);
  hp:=(state->>'current_hp')::int;
  if hp>=p_max_hp then raise exception 'Seu HP já está cheio'; end if;
  select quantity into qty from public.aq_arena_potions where user_id=uid for update;
  if coalesce(qty,0)<1 then raise exception 'Você não possui poções'; end if;
  update public.aq_arena_potions set quantity=quantity-1 where user_id=uid returning quantity into qty;
  hp:=least(p_max_hp,hp+25);
  select last_regen_at into tick from public.aq_arena_health where user_id=uid for update;
  if hp=p_max_hp then tick:=now(); end if;
  update public.aq_arena_health set current_hp=hp,last_regen_at=tick where user_id=uid;
  return jsonb_build_object('current_hp',hp,'max_hp',p_max_hp,'next_hp_at',case when hp<p_max_hp then tick+interval '1 hour' else null end,'potions',qty);
end $$;

revoke execute on function public.aq_delete_notification_rule(uuid),public.aq_arena_health_snapshot(int),public.aq_arena_take_damage(int,int),public.aq_buy_arena_potion(),public.aq_use_arena_potion(int) from public,anon;
grant execute on function public.aq_delete_notification_rule(uuid),public.aq_arena_health_snapshot(int),public.aq_arena_take_damage(int,int),public.aq_buy_arena_potion(),public.aq_use_arena_potion(int) to authenticated;
notify pgrst,'reload schema';
commit;
