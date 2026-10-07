begin;

create or replace function public.aq_finance_update_transaction(
  p_id uuid,
  p_title text,
  p_amount numeric,
  p_kind text,
  p_category text,
  p_occurred_on date,
  p_payment_method text,
  p_card_id uuid,
  p_notes text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Não autenticado'; end if;
  if p_id is null or p_title is null or length(trim(p_title)) not between 1 and 180
    or p_amount is null or p_amount <= 0 or p_amount > 100000000
    or p_kind not in ('expense', 'income')
    or p_category is null or length(trim(p_category)) not between 1 and 80
    or p_occurred_on is null
    or p_payment_method not in ('cash', 'pix', 'debit', 'credit', 'bank_transfer', 'other')
    or length(coalesce(p_notes, '')) > 1000
  then raise exception 'Confira os dados do lançamento'; end if;
  if p_card_id is not null and not exists (
    select 1 from public.aq_finance_cards where id = p_card_id and user_id = uid
  ) then raise exception 'Cartão indisponível'; end if;
  update public.aq_finance_transactions
  set title = trim(p_title), amount = p_amount, kind = p_kind,
      category = trim(p_category), occurred_on = p_occurred_on,
      payment_method = p_payment_method, card_id = p_card_id,
      notes = coalesce(p_notes, '')
  where id = p_id and user_id = uid;
  if not found then raise exception 'Lançamento indisponível'; end if;
  return p_id;
end $$;

revoke execute on function public.aq_finance_update_transaction(uuid,text,numeric,text,text,date,text,uuid,text) from public, anon;
grant execute on function public.aq_finance_update_transaction(uuid,text,numeric,text,text,date,text,uuid,text) to authenticated;

notify pgrst, 'reload schema';
commit;
