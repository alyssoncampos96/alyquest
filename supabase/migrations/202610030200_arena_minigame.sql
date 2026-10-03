begin;

create table if not exists public.aq_arena_victories (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 monster_id text not null check(length(trim(monster_id)) between 1 and 80),
 victory_day date not null default ((now() at time zone 'America/Sao_Paulo')::date),
 reward_xp numeric not null default 0,
 reward_coins numeric not null default 0,
 created_at timestamptz not null default now(),
 unique(user_id,monster_id,victory_day)
);

alter table public.aq_arena_victories enable row level security;
drop policy if exists own_arena_victories on public.aq_arena_victories;
create policy own_arena_victories on public.aq_arena_victories for select to authenticated using(user_id=(select auth.uid()));
revoke all on public.aq_arena_victories from anon,authenticated;
grant select on public.aq_arena_victories to authenticated;

create or replace function public.aq_claim_arena_victory(p_monster_id text) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); today date:=(now() at time zone 'America/Sao_Paulo')::date; victory_id uuid; xp numeric; coins numeric; clean text:=trim(coalesce(p_monster_id,''));
begin
 if uid is null then raise exception 'Não autenticado'; end if;
 case clean
  when 'training-slime' then xp:=2; coins:=2;
  when 'habit-goblin' then xp:=4; coins:=4;
  when 'chaos-ogre' then xp:=8; coins:=8;
  when 'deadline-dragon' then xp:=15; coins:=15;
  else raise exception 'Monstro indisponível';
 end case;
 insert into public.aq_arena_victories(user_id,monster_id,victory_day,reward_xp,reward_coins) values(uid,clean,today,xp,coins)
 on conflict(user_id,monster_id,victory_day) do nothing returning id into victory_id;
 if victory_id is null then return jsonb_build_object('claimed',false,'xp',0,'coins',0,'message','Recompensa diária já resgatada para este monstro.'); end if;
 insert into public.xp_transactions(user_id,amount,reason,reference_id) values(uid,xp,'Arena: '||clean,victory_id);
 insert into public.coin_transactions(user_id,amount,reason,reference_id) values(uid,coins,'Arena: '||clean,victory_id);
 return jsonb_build_object('claimed',true,'id',victory_id,'xp',xp,'coins',coins);
end $$;

revoke execute on function public.aq_claim_arena_victory(text) from public,anon;
grant execute on function public.aq_claim_arena_victory(text) to authenticated;

do $$
begin
 if to_regclass('public.items') is not null then
  insert into public.items(name,icon,description,price,damage_bonus)
  select item.name,item.icon,item.description,item.price,item.damage_bonus
  from (values
   ('Espada de Madeira','🗡️','Arma inicial para a Arena.',10,0.02),
   ('Armadura de Couro','🛡️','Proteção básica para encarar monstros.',22,0.03),
   ('Botas do Viajante','🥾','Ajuda o personagem a aguentar combates longos.',28,0.04),
   ('Capa Noturna','🧥','Capa leve com bônus de batalha.',40,0.06),
   ('Elmo de Bronze','⛑️','Defesa extra contra monstros médios.',52,0.07),
   ('Armadura de Prata','🥋','Equipamento raro para desafios difíceis.',95,0.12),
   ('Espada Solar','⚔️','Arma épica para monstros fortes.',140,0.16)
  ) as item(name,icon,description,price,damage_bonus)
  where not exists(select 1 from public.items i where lower(i.name)=lower(item.name));
 end if;
end $$;

notify pgrst,'reload schema';
commit;
