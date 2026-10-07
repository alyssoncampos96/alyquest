begin;

-- NULL preserves legacy rows: their display state is inferred from their date.
alter table public.aq_finance_transactions
  add column if not exists settlement_status text
    check (settlement_status in ('planned', 'posted', 'settled')),
  add column if not exists settled_at timestamptz;

create or replace function public.aq_finance_set_transaction_state(p_id uuid, p_status text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Não autenticado'; end if;
  if p_status not in ('planned', 'posted', 'settled') then raise exception 'Estado inválido'; end if;
  update public.aq_finance_transactions
     set settlement_status = p_status,
         settled_at = case when p_status = 'settled' then coalesce(settled_at, now()) else null end
   where id = p_id and user_id = uid;
  if not found then raise exception 'Lançamento indisponível'; end if;
  return p_id;
end $$;

create or replace function public.aq_finance_bulk_category(p_ids uuid[], p_category text)
returns integer language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); changed integer;
begin
  if uid is null then raise exception 'Não autenticado'; end if;
  if p_ids is null or cardinality(p_ids) not between 1 and 500
     or p_category is null or length(trim(p_category)) not between 1 and 80
  then raise exception 'Selecione lançamentos e uma categoria'; end if;
  if (select count(*) from public.aq_finance_transactions
      where id = any(p_ids) and user_id = uid) <> (select count(distinct x) from unnest(p_ids) as x)
  then raise exception 'Seleção contém lançamento indisponível'; end if;
  update public.aq_finance_transactions set category = trim(p_category)
   where id = any(p_ids) and user_id = uid;
  get diagnostics changed = row_count;
  return changed;
end $$;

create or replace function public.aq_finance_update_series(
  p_id uuid, p_title text, p_category text, p_notes text
) returns integer language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); parent uuid; changed integer;
begin
  if uid is null then raise exception 'Não autenticado'; end if;
  if p_title is null or length(trim(p_title)) not between 1 and 180
     or p_category is null or length(trim(p_category)) not between 1 and 80
     or length(coalesce(p_notes,'')) > 1000
  then raise exception 'Confira os dados da compra'; end if;
  select coalesce(installment_parent_id, id) into parent
    from public.aq_finance_transactions where id = p_id and user_id = uid;
  if parent is null then raise exception 'Lançamento indisponível'; end if;
  update public.aq_finance_transactions
     set title = trim(p_title), category = trim(p_category), notes = coalesce(p_notes,'')
   where user_id = uid and (id = parent or installment_parent_id = parent);
  get diagnostics changed = row_count;
  return changed;
end $$;

revoke execute on function public.aq_finance_set_transaction_state(uuid,text),
  public.aq_finance_bulk_category(uuid[],text),
  public.aq_finance_update_series(uuid,text,text,text) from public, anon;
grant execute on function public.aq_finance_set_transaction_state(uuid,text),
  public.aq_finance_bulk_category(uuid[],text),
  public.aq_finance_update_series(uuid,text,text,text) to authenticated;

notify pgrst, 'reload schema';
commit;
