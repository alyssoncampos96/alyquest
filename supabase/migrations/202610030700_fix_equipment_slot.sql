begin;

create or replace function public.equip_item(p_item_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare
  v_uid uuid := auth.uid();
  v_slot text;
  v_kind text;
  v_equipped boolean;
begin
  if v_uid is null then raise exception 'Usuário não autenticado'; end if;
  select equipped into v_equipped from public.user_items
    where user_id=v_uid and item_id=p_item_id for update;
  if not found then raise exception 'Compre o item antes de equipar'; end if;
  select coalesce(i.item_type,'equipment'),
         coalesce(i.battle_slot, case when coalesce(i.damage_bonus,0)>0 then 'accessory' else 'cosmetic' end)
    into v_kind,v_slot from public.items i where i.id=p_item_id;
  if v_kind not in ('equipment','pet') then raise exception 'Este item não é equipável'; end if;
  if not coalesce(v_equipped,false) then
    update public.user_items ui set equipped=false
      from public.items i
      where ui.item_id=i.id and ui.user_id=v_uid and ui.item_id<>p_item_id
        and coalesce(i.battle_slot,'accessory')=v_slot;
  end if;
  update public.user_items set equipped=not coalesce(v_equipped,false)
    where user_id=v_uid and item_id=p_item_id;
end $$;

revoke execute on function public.equip_item(uuid) from public,anon;
grant execute on function public.equip_item(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
