begin;

alter table if exists public.items add column if not exists item_type text not null default 'equipment';
alter table if exists public.items add column if not exists battle_slot text;
alter table if exists public.items add column if not exists pet_ability text;

update public.items set item_type='cosmetic' where coalesce(damage_bonus,0)=0 and coalesce(item_type,'equipment')='equipment';
update public.items set item_type='pet', battle_slot='pet', pet_ability='companheiro de batalha' where lower(name) like '%mascote%' or lower(name) like '%pet%';
update public.items set battle_slot=case
 when lower(name) like '%espada%' or lower(name) like '%martelo%' or lower(name) like '%luvas%' then 'weapon'
 when lower(name) like '%armadura%' or lower(name) like '%faixa%' then 'armor'
 when lower(name) like '%bota%' then 'boots'
 when lower(name) like '%capa%' then 'cloak'
 when lower(name) like '%elmo%' then 'helmet'
 when lower(name) like '%anel%' or lower(name) like '%óculos%' or lower(name) like '%oculos%' or lower(name) like '%coroa%' or lower(name) like '%caderno%' or lower(name) like '%garrafa%' then 'accessory'
 when item_type='pet' then 'pet'
 else coalesce(battle_slot,'cosmetic')
end
where battle_slot is null;

insert into public.items(name,icon,description,price,damage_bonus,item_type,battle_slot,pet_ability)
select item.name,item.icon,item.description,item.price,item.damage_bonus,item.item_type,item.battle_slot,item.pet_ability
from (values
 ('Armadura de Ferro','🛡️','Proteção firme para monstros difíceis.',160,0.18,'equipment','armor',null),
 ('Botas Relâmpago','🥾','Aumenta ritmo e chance de sobreviver.',120,0.13,'equipment','boots',null),
 ('Capa Estelar','🌌','Capa rara para batalhas longas.',180,0.2,'equipment','cloak',null),
 ('Espada de Hábitos','⚔️','Arma forte para fases avançadas.',220,0.24,'equipment','weapon',null),
 ('Coruja Estrategista','🦉','Pet que aumenta sua chance de crítico.',85,0.03,'pet','pet','+3% de poder e mais crítico'),
 ('Raposa Guardiã','🦊','Pet que ajuda na defesa durante a Arena.',110,0.04,'pet','pet','+4% de poder e mais defesa'),
 ('Dragãozinho do Foco','🐲','Pet raro para combates decisivos.',180,0.07,'pet','pet','+7% de poder na Arena')
) as item(name,icon,description,price,damage_bonus,item_type,battle_slot,pet_ability)
where to_regclass('public.items') is not null and not exists(select 1 from public.items i where lower(i.name)=lower(item.name));

create or replace function public.equip_item(p_item_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); owned public.user_items%rowtype; slot text; kind text;
begin
 if uid is null then raise exception 'Usuário não autenticado'; end if;
 select * into owned from public.user_items where user_id=uid and item_id=p_item_id for update;
 if not found then raise exception 'Compre o item antes de equipar'; end if;
 select coalesce(item_type,'equipment'),coalesce(battle_slot,case when coalesce(damage_bonus,0)>0 then 'accessory' else 'cosmetic' end) into kind,slot from public.items where id=p_item_id;
 if kind not in ('equipment','pet') then raise exception 'Este item não é equipável'; end if;
 update public.user_items ui set equipped=false
 from public.items i
 where ui.item_id=i.id and ui.user_id=uid and ui.item_id<>p_item_id and coalesce(i.battle_slot,'accessory')=slot;
 update public.user_items set equipped=not coalesce(equipped,false) where user_id=uid and item_id=p_item_id;
end $$;

alter table public.aq_arena_victories add column if not exists defeated_at timestamptz not null default now();
do $$
begin
 if exists(select 1 from pg_constraint where conname='aq_arena_victories_user_id_monster_id_victory_day_key') then
  alter table public.aq_arena_victories drop constraint aq_arena_victories_user_id_monster_id_victory_day_key;
 end if;
 if not exists(select 1 from pg_constraint where conname='aq_arena_victories_user_id_monster_id_key') then
  alter table public.aq_arena_victories add constraint aq_arena_victories_user_id_monster_id_key unique(user_id,monster_id);
 end if;
end $$;

create or replace function public.aq_claim_arena_victory(p_monster_id text) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); victory_id uuid; xp numeric; coins numeric:=1; clean text:=trim(coalesce(p_monster_id,'')); required int:=0; wins int;
begin
 if uid is null then raise exception 'Não autenticado'; end if;
 case clean
  when 'level-1-wolf' then xp:=3; required:=0;
  when 'level-1-goblin' then xp:=5; required:=0;
  when 'level-2-ogre' then xp:=8; required:=2;
  when 'level-2-mage' then xp:=10; required:=2;
  when 'level-3-dragon' then xp:=16; required:=4;
  when 'training-slime' then xp:=2; required:=0;
  when 'habit-goblin' then xp:=5; required:=0;
  when 'chaos-ogre' then xp:=8; required:=2;
  when 'deadline-dragon' then xp:=16; required:=4;
  else raise exception 'Monstro indisponível';
 end case;
 select count(*) into wins from public.aq_arena_victories where user_id=uid;
 if wins<required then raise exception 'Derrote monstros anteriores antes deste desafio'; end if;
 insert into public.aq_arena_victories(user_id,monster_id,victory_day,reward_xp,reward_coins,defeated_at) values(uid,clean,(now() at time zone 'America/Sao_Paulo')::date,xp,coins,now())
 on conflict(user_id,monster_id) do nothing returning id into victory_id;
 if victory_id is null then return jsonb_build_object('claimed',false,'xp',0,'coins',0,'message','Esse monstro já foi derrotado.'); end if;
 insert into public.xp_transactions(user_id,amount,reason,reference_id) values(uid,xp,'Arena: '||clean,victory_id);
 insert into public.coin_transactions(user_id,amount,reason,reference_id) values(uid,coins,'Arena: '||clean,victory_id);
 return jsonb_build_object('claimed',true,'id',victory_id,'xp',xp,'coins',coins);
end $$;

alter table public.aq_sheet_outbox add column if not exists completed_at timestamptz;

create or replace function public.aq_finish_mission(p_task_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();t public.tasks%rowtype;p public.aq_task_plans%rowtype;b public.bosses%rowtype;a public.bosses%rowtype;reward numeric;legacy_reward numeric;extra numeric:=0;bx numeric:=0;bc numeric:=0;step_delta int:=0;event_id uuid;damage numeric:=0;prev text;done_at timestamptz:=now();
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
 update public.tasks set completed_at=done_at where id=t.id and user_id=uid;
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
 if found then insert into public.aq_sheet_outbox(task_id,user_id,desired_status,previous_status,completed_at) values(t.id,uid,'Concluído',prev,done_at) on conflict(task_id) do update set version=gen_random_uuid(),desired_status='Concluído',previous_status=case when public.aq_sheet_outbox.desired_status<>'Concluído' then public.aq_sheet_outbox.desired_status else excluded.previous_status end,completed_at=excluded.completed_at,state='pending',message='',updated_at=now();end if;
 return jsonb_build_object('task_id',t.id,'xp',reward+bx+step_delta,'coins',reward+bc+step_delta,'damage',damage,'undo_id',event_id);
end $$;

create table if not exists public.aq_finance_recurring (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 title text not null check(length(trim(title)) between 1 and 180),
 amount numeric not null check(amount>0 and amount<=100000000),
 kind text not null default 'expense' check(kind in ('expense','income')),
 category text not null default 'Outros',
 start_on date not null,
 frequency text not null default 'monthly' check(frequency in ('weekly','monthly','yearly')),
 payment_method text not null default 'pix' check(payment_method in ('cash','pix','debit','credit','bank_transfer','other')),
 card_id uuid references public.aq_finance_cards(id) on delete set null,
 notes text not null default '' check(length(notes)<=1000),
 active boolean not null default true,
 created_at timestamptz not null default now()
);
alter table public.aq_finance_recurring enable row level security;
drop policy if exists own_finance_recurring on public.aq_finance_recurring;
create policy own_finance_recurring on public.aq_finance_recurring for select to authenticated using(user_id=(select auth.uid()));
revoke all on public.aq_finance_recurring from anon,authenticated;
grant select on public.aq_finance_recurring to authenticated;
create unique index if not exists aq_finance_recurring_tx_unique on public.aq_finance_transactions(user_id,source,notes,occurred_on) where source='recurring';

alter table public.aq_finance_transactions drop constraint if exists aq_finance_transactions_source_check;
alter table public.aq_finance_transactions add constraint aq_finance_transactions_source_check check(source in ('manual','gpt','recurring'));

create or replace function public.aq_finance_save_recurring(p_title text,p_amount numeric,p_kind text,p_category text,p_start_on date,p_frequency text,p_payment_method text,p_card_id uuid,p_notes text) returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); rid uuid;
begin
 if uid is null then raise exception 'Não autenticado'; end if;
 if p_title is null or length(trim(p_title)) not between 1 and 180 or p_amount is null or p_amount<=0 or p_kind not in ('expense','income') or p_frequency not in ('weekly','monthly','yearly') or p_payment_method not in ('cash','pix','debit','credit','bank_transfer','other') or p_start_on is null then raise exception 'Confira os dados da recorrência'; end if;
 if p_card_id is not null and not exists(select 1 from public.aq_finance_cards where id=p_card_id and user_id=uid) then raise exception 'Cartão indisponível'; end if;
 insert into public.aq_finance_recurring(user_id,title,amount,kind,category,start_on,frequency,payment_method,card_id,notes) values(uid,trim(p_title),p_amount,p_kind,trim(coalesce(nullif(p_category,''),'Outros')),p_start_on,p_frequency,p_payment_method,p_card_id,coalesce(p_notes,'')) returning id into rid;
 return rid;
end $$;

create or replace function public.aq_finance_generate_recurring(p_until date) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); r public.aq_finance_recurring%rowtype; d date; step interval; inserted int:=0; note_key text;
begin
 if uid is null then raise exception 'Não autenticado'; end if;
 if p_until is null or p_until < current_date - interval '1 year' or p_until > current_date + interval '2 years' then raise exception 'Data limite inválida'; end if;
 for r in select * from public.aq_finance_recurring where user_id=uid and active loop
  d:=r.start_on;
  step:=case r.frequency when 'weekly' then interval '1 week' when 'yearly' then interval '1 year' else interval '1 month' end;
  while d<=p_until loop
   note_key:='recurring:'||r.id::text;
   insert into public.aq_finance_transactions(user_id,title,amount,kind,category,occurred_on,payment_method,card_id,installment_number,installment_count,notes,source)
   values(uid,r.title,r.amount,r.kind,r.category,d,r.payment_method,r.card_id,1,1,note_key,'recurring')
   on conflict do nothing;
   if found then inserted:=inserted+1; end if;
   d:=(d::timestamp + step)::date;
  end loop;
 end loop;
 return jsonb_build_object('inserted',inserted);
end $$;

create or replace function public.aq_claim_achievement_reward(p_user_id uuid,p_code text,p_reward_xp numeric,p_reward_coins numeric) returns jsonb language plpgsql security definer set search_path='' as $$
declare claim_id uuid; clean_code text:=trim(coalesce(p_code,'')); xp numeric:=greatest(coalesce(p_reward_xp,0),0); coins numeric:=case when coalesce(p_reward_coins,0)>0 then 1 else 0 end;
begin
 if p_user_id is null or length(clean_code) not between 1 and 120 or xp>10000 then raise exception 'Recompensa inválida'; end if;
 insert into public.aq_achievement_claims(user_id,code,reward_xp,reward_coins) values(p_user_id,clean_code,xp,coins)
 on conflict(user_id,code) do nothing returning id into claim_id;
 if claim_id is null then return jsonb_build_object('claimed',false,'xp',0,'coins',0); end if;
 if xp>0 then insert into public.xp_transactions(user_id,amount,reason,reference_id) values(p_user_id,xp,'Conquista: '||clean_code,claim_id); end if;
 if coins>0 then insert into public.coin_transactions(user_id,amount,reason,reference_id) values(p_user_id,coins,'Conquista: '||clean_code,claim_id); end if;
 return jsonb_build_object('claimed',true,'id',claim_id,'xp',xp,'coins',coins);
end $$;

revoke execute on function public.equip_item(uuid),public.aq_claim_arena_victory(text),public.aq_finance_save_recurring(text,numeric,text,text,date,text,text,uuid,text),public.aq_finance_generate_recurring(date),public.aq_claim_achievement_reward(uuid,text,numeric,numeric) from public,anon,authenticated;
grant execute on function public.equip_item(uuid),public.aq_claim_arena_victory(text),public.aq_finance_save_recurring(text,numeric,text,text,date,text,text,uuid,text),public.aq_finance_generate_recurring(date) to authenticated;
grant execute on function public.aq_claim_achievement_reward(uuid,text,numeric,numeric) to service_role;



create or replace function public.aq_gpt_task_state(p_token text,p_task_id uuid,p_action text,p_date date default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid;
begin
 uid:=public.aq_gpt_token_user(p_token);
 perform set_config('request.jwt.claim.sub',uid::text,true);
 perform public.aq_task_state(p_task_id,p_action,p_date);
 return jsonb_build_object('status','updated','task_id',p_task_id,'action',p_action,'date',p_date);
end $$;

create or replace function public.aq_gpt_list_shop(p_token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid; coins numeric; items jsonb;
begin
 uid:=public.aq_gpt_token_user(p_token);
 select coalesce(sum(amount),0) into coins from public.coin_transactions where user_id=uid;
 select jsonb_agg(to_jsonb(q) order by q.price) into items from (
  select i.id,i.name,i.icon,i.description,i.price,i.damage_bonus,i.item_type,i.battle_slot,i.pet_ability,ui.item_id is not null as owned,coalesce(ui.equipped,false) as equipped
  from public.items i left join public.user_items ui on ui.item_id=i.id and ui.user_id=uid
 ) q;
 return jsonb_build_object('coins',coins,'items',coalesce(items,'[]'::jsonb));
end $$;

create or replace function public.aq_gpt_purchase_item(p_token text,p_item_id uuid,p_equip boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid;
begin
 uid:=public.aq_gpt_token_user(p_token);
 perform set_config('request.jwt.claim.sub',uid::text,true);
 perform public.purchase_item(p_item_id);
 if coalesce(p_equip,false) then perform public.equip_item(p_item_id); end if;
 return jsonb_build_object('status','purchased','item_id',p_item_id,'equipped',coalesce(p_equip,false));
end $$;

create or replace function public.aq_gpt_equip_item(p_token text,p_item_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid;
begin
 uid:=public.aq_gpt_token_user(p_token);
 perform set_config('request.jwt.claim.sub',uid::text,true);
 perform public.equip_item(p_item_id);
 return jsonb_build_object('status','updated','item_id',p_item_id);
end $$;

create or replace function public.aq_gpt_save_finance_recurring(p_token text,p_title text,p_amount numeric,p_kind text,p_category text,p_start_on date,p_frequency text,p_payment_method text,p_notes text default '') returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid; rid uuid;
begin
 uid:=public.aq_gpt_token_user(p_token);
 perform set_config('request.jwt.claim.sub',uid::text,true);
 rid:=public.aq_finance_save_recurring(p_title,p_amount,coalesce(p_kind,'expense'),coalesce(p_category,'Outros'),p_start_on,coalesce(p_frequency,'monthly'),coalesce(p_payment_method,'pix'),null,coalesce(p_notes,''));
 return jsonb_build_object('id',rid,'status','created');
end $$;

revoke execute on function public.aq_gpt_task_state(text,uuid,text,date),public.aq_gpt_list_shop(text),public.aq_gpt_purchase_item(text,uuid,boolean),public.aq_gpt_equip_item(text,uuid),public.aq_gpt_save_finance_recurring(text,text,numeric,text,text,date,text,text,text) from public,anon,authenticated;
grant execute on function public.aq_gpt_task_state(text,uuid,text,date),public.aq_gpt_list_shop(text),public.aq_gpt_purchase_item(text,uuid,boolean),public.aq_gpt_equip_item(text,uuid),public.aq_gpt_save_finance_recurring(text,text,numeric,text,text,date,text,text,text) to anon,authenticated;

notify pgrst,'reload schema';
commit;
