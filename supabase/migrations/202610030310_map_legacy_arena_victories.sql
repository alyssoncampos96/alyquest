begin;

with mapped as (
  select distinct on (user_id, new_monster_id)
    user_id,
    new_monster_id as monster_id,
    victory_day,
    0::numeric as reward_xp,
    0::numeric as reward_coins,
    coalesce(defeated_at, created_at, now()) as defeated_at
  from (
    select
      user_id,
      case monster_id
        when 'training-slime' then 'level-1-wolf'
        when 'habit-goblin' then 'level-1-goblin'
        when 'chaos-ogre' then 'level-2-ogre'
        when 'deadline-dragon' then 'level-3-dragon'
      end as new_monster_id,
      victory_day,
      reward_xp,
      reward_coins,
      defeated_at,
      created_at
    from public.aq_arena_victories
    where monster_id in ('training-slime','habit-goblin','chaos-ogre','deadline-dragon')
  ) legacy
  where new_monster_id is not null
  order by user_id, new_monster_id, defeated_at
)
insert into public.aq_arena_victories(user_id, monster_id, victory_day, reward_xp, reward_coins, defeated_at)
select user_id, monster_id, victory_day, reward_xp, reward_coins, defeated_at
from mapped
on conflict(user_id, monster_id) do nothing;

notify pgrst,'reload schema';
commit;
