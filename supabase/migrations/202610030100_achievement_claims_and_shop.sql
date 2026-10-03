begin;

alter table public.aq_achievement_claims add column if not exists id uuid default gen_random_uuid();
update public.aq_achievement_claims set id=gen_random_uuid() where id is null;
alter table public.aq_achievement_claims alter column id set not null;
create unique index if not exists aq_achievement_claims_id_key on public.aq_achievement_claims(id);

create or replace function public.aq_claim_achievement_reward(p_user_id uuid,p_code text,p_reward_xp numeric,p_reward_coins numeric) returns jsonb language plpgsql security definer set search_path='' as $$
declare claim_id uuid; clean_code text:=trim(coalesce(p_code,'')); xp numeric:=greatest(coalesce(p_reward_xp,0),0); coins numeric:=greatest(coalesce(p_reward_coins,0),0);
begin
 if p_user_id is null or length(clean_code) not between 1 and 120 or xp>10000 or coins>10000 then raise exception 'Recompensa inválida'; end if;
 insert into public.aq_achievement_claims(user_id,code,reward_xp,reward_coins) values(p_user_id,clean_code,xp,coins)
 on conflict(user_id,code) do nothing returning id into claim_id;
 if claim_id is null then return jsonb_build_object('claimed',false,'xp',0,'coins',0); end if;
 if xp>0 then insert into public.xp_transactions(user_id,amount,reason,reference_id) values(p_user_id,xp,'Conquista: '||clean_code,claim_id); end if;
 if coins>0 then insert into public.coin_transactions(user_id,amount,reason,reference_id) values(p_user_id,coins,'Conquista: '||clean_code,claim_id); end if;
 return jsonb_build_object('claimed',true,'id',claim_id,'xp',xp,'coins',coins);
end $$;

revoke execute on function public.aq_claim_achievement_reward(uuid,text,numeric,numeric) from public,anon,authenticated;
grant execute on function public.aq_claim_achievement_reward(uuid,text,numeric,numeric) to service_role;

do $$
begin
 if to_regclass('public.items') is not null then
  insert into public.items(name,icon,description,price,damage_bonus)
  select item.name,item.icon,item.description,item.price,item.damage_bonus
  from (values
   ('Luvas de Couro','🥊','Ataques leves contra chefes. Bom para começar.',12,0.02),
   ('Botas de Ritmo','🥾','Passos firmes para manter a sequência.',18,0.03),
   ('Caderno Arcano','📓','Organização vira poder nas missões.',24,0.04),
   ('Garrafa do Foco','💧','Energia extra para sessões longas.',30,0.05),
   ('Faixa de Treino','🎽','Um empurrão nos desafios de saúde.',38,0.06),
   ('Anel da Disciplina','💍','Pequeno bônus constante de dano.',45,0.07),
   ('Óculos Estratégicos','🥽','Enxerga melhor o próximo passo.',55,0.08),
   ('Capa do Herói','🦸','Mais presença em batalhas importantes.',70,0.1),
   ('Martelo de Hábitos','🔨','Dano alto para quebrar metas difíceis.',90,0.12),
   ('Coroa de Consistência','👑','Item raro para jornadas longas.',120,0.15),
   ('Mascote Slime','🟢','Companhia decorativa para a aventura.',20,0),
   ('Cristal de Sorte','🔮','Brilho decorativo para o inventário.',35,0)
  ) as item(name,icon,description,price,damage_bonus)
  where not exists(select 1 from public.items i where lower(i.name)=lower(item.name));
 end if;
end $$;

notify pgrst,'reload schema';
commit;
