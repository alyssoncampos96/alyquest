begin;

alter table if exists public.items add column if not exists rarity text not null default 'common' check(rarity in ('common','rare','epic','legendary'));
alter table if exists public.items add column if not exists effect text;
alter table if exists public.items add column if not exists defense_bonus numeric not null default 0;
alter table if exists public.items add column if not exists crit_bonus numeric not null default 0;

update public.items set rarity=case
 when price>=180 then 'legendary'
 when price>=90 then 'epic'
 when price>=35 then 'rare'
 else 'common'
end
where rarity='common';

update public.items set defense_bonus=case
 when coalesce(battle_slot,'') in ('armor','helmet','cloak','boots') then greatest(coalesce(damage_bonus,0)/2,0.02)
 else defense_bonus
end;
update public.items set crit_bonus=case
 when coalesce(battle_slot,'') in ('weapon','accessory','pet') then greatest(coalesce(damage_bonus,0)/5,0.01)
 else crit_bonus
end;
update public.items set effect=coalesce(effect,case
 when item_type='pet' then pet_ability
 when battle_slot='weapon' then 'Aumenta dano na Arena.'
 when battle_slot in ('armor','helmet') then 'Aumenta defesa na Arena.'
 when battle_slot in ('boots','cloak') then 'Ajuda em duelos longos.'
 when battle_slot='accessory' then 'Bônus híbrido de batalha.'
 else 'Item de coleção.'
end);

insert into public.items(name,icon,description,price,damage_bonus,defense_bonus,crit_bonus,item_type,battle_slot,pet_ability,rarity,effect)
select item.name,item.icon,item.description,item.price,item.damage_bonus,item.defense_bonus,item.crit_bonus,item.item_type,item.battle_slot,item.pet_ability,item.rarity,item.effect
from (values
 ('Adaga de Bronze','🗡️','Arma comum para fases iniciais.',25,0.04,0,0.01,'equipment','weapon',null,'common','+dano e leve crítico.'),
 ('Machado Resoluto','🪓','Arma rara para derrubar chefes resistentes.',75,0.11,0,0.02,'equipment','weapon',null,'rare','Dano alto contra inimigos difíceis.'),
 ('Lança da Constância','🔱','Arma épica para fases longas.',150,0.19,0,0.04,'equipment','weapon',null,'epic','Dano e crítico para duelos.'),
 ('Armadura Solar','🌞','Armadura lendária para chefes avançados.',260,0.08,0.26,0,'equipment','armor',null,'legendary','Muita defesa e um pouco de poder.'),
 ('Botas de Titânio','🥾','Botas lendárias para sobreviver a combos.',210,0.09,0.16,0,'equipment','boots',null,'legendary','Defesa contra ataques seguidos.'),
 ('Elmo da Clareza','🪖','Elmo épico contra críticos inimigos.',130,0.05,0.17,0.01,'equipment','helmet',null,'epic','Defesa e foco.'),
 ('Capa do Eclipse','🌘','Capa lendária para duelos contra dois inimigos.',240,0.12,0.20,0.02,'equipment','cloak',null,'legendary','Bônus para batalhas longas.'),
 ('Amuleto de Crítico','📿','Acessório raro que aumenta golpes críticos.',95,0.05,0,0.06,'equipment','accessory',null,'rare','Mais chance de crítico.'),
 ('Poção de Coragem','🧪','Consumível aspiracional para uma futura batalha difícil.',60,0,0,0,'consumable','consumable',null,'rare','Futuro boost temporário de ataque.'),
 ('Pergaminho de Reroll','📜','Consumível para futura troca de missão diária.',90,0,0,0,'consumable','consumable',null,'epic','Futuro reroll de missão.'),
 ('Cristal Protetor de Streak','💎','Consumível lendário para proteger sequência no futuro.',180,0,0,0,'consumable','consumable',null,'legendary','Futura proteção de streak.'),
 ('Gato Cronomante','🐈‍⬛','Pet que gosta de foco e turnos rápidos.',140,0.05,0.03,0.03,'pet','pet','+5% poder, +3% defesa, +3% crítico','epic','Pet equilibrado para Arena.'),
 ('Fênix da Rotina','🔥','Pet lendário para fases avançadas.',260,0.08,0.06,0.05,'pet','pet','+8% poder, +6% defesa, +5% crítico','legendary','Pet forte para duelos finais.'),
 ('Tema Floresta Mística','🌲','Tema visual desbloqueável para o futuro.',120,0,0,0,'theme','theme',null,'epic','Tema visual futuro.'),
 ('Tema Cyber Quest','🟣','Tema visual cyberpunk desbloqueável para o futuro.',180,0,0,0,'theme','theme',null,'legendary','Tema visual futuro.')
) as item(name,icon,description,price,damage_bonus,defense_bonus,crit_bonus,item_type,battle_slot,pet_ability,rarity,effect)
where to_regclass('public.items') is not null and not exists(select 1 from public.items i where lower(i.name)=lower(item.name));


insert into public.aq_arena_victories(user_id,monster_id,reward_xp,reward_coins)
select user_id, mapped_monster_id, max(reward_xp), max(reward_coins)
from (
  select user_id,
    case monster_id
      when 'training-slime' then 'level-1-medium'
      when 'level-1-wolf' then 'level-1-medium'
      when 'habit-goblin' then 'level-1-hard'
      when 'level-1-goblin' then 'level-1-hard'
      when 'chaos-ogre' then 'level-2-medium'
      when 'level-2-ogre' then 'level-2-medium'
      when 'deadline-dragon' then 'level-3-boss'
      when 'level-3-dragon' then 'level-3-boss'
      else monster_id
    end as mapped_monster_id,
    reward_xp,
    reward_coins
  from public.aq_arena_victories
  where monster_id in ('training-slime','level-1-wolf','habit-goblin','level-1-goblin','chaos-ogre','level-2-ogre','deadline-dragon','level-3-dragon')
) mapped
where mapped_monster_id like 'level-%'
group by user_id,mapped_monster_id
on conflict (user_id,monster_id) do nothing;

create or replace function public.aq_claim_arena_victory(p_monster_id text) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); victory_id uuid; xp numeric; coins numeric:=1; clean text:=trim(coalesce(p_monster_id,'')); required int:=0; wins int; lvl int; tier text;
begin
 if uid is null then raise exception 'Não autenticado'; end if;
 if clean in ('training-slime','habit-goblin','chaos-ogre','deadline-dragon') then
  case clean
   when 'training-slime' then clean:='level-1-medium';
   when 'habit-goblin' then clean:='level-1-hard';
   when 'chaos-ogre' then clean:='level-2-medium';
   when 'deadline-dragon' then clean:='level-3-boss';
  end case;
 end if;
 if clean !~ '^level-([1-9][0-9]?|100)-(medium|hard|boss)$' then raise exception 'Monstro indisponível'; end if;
 lvl:=(regexp_match(clean,'^level-([0-9]+)-'))[1]::int;
 tier:=(regexp_match(clean,'-(medium|hard|boss)$'))[1];
 required:=(lvl-1)*3 + case tier when 'boss' then 2 else 0 end;
 xp:=case tier when 'medium' then 3+lvl when 'hard' then 5+lvl*2 else 10+lvl*4 end;
 select count(distinct monster_id) into wins from public.aq_arena_victories where user_id=uid and monster_id ~ '^level-';
 if wins<required then raise exception 'Derrote monstros anteriores antes deste desafio'; end if;
 insert into public.aq_arena_victories(user_id,monster_id,victory_day,reward_xp,reward_coins,defeated_at) values(uid,clean,(now() at time zone 'America/Sao_Paulo')::date,xp,coins,now())
 on conflict(user_id,monster_id) do nothing returning id into victory_id;
 if victory_id is null then return jsonb_build_object('claimed',false,'xp',0,'coins',0,'message','Esse monstro já foi derrotado.'); end if;
 insert into public.xp_transactions(user_id,amount,reason,reference_id) values(uid,xp,'Arena: '||clean,victory_id);
 insert into public.coin_transactions(user_id,amount,reason,reference_id) values(uid,coins,'Arena: '||clean,victory_id);
 return jsonb_build_object('claimed',true,'id',victory_id,'xp',xp,'coins',coins);
end $$;

grant execute on function public.aq_claim_arena_victory(text) to authenticated;
notify pgrst,'reload schema';
commit;
