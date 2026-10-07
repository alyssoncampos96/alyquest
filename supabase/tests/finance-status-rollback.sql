begin;
select set_config('request.jwt.claim.sub','1aef265b-8a27-4b3b-81ba-2942a6edbe98',true);
set local role authenticated;
do $$
declare first_id uuid; second_id uuid; changed int; blocked boolean;
begin
  first_id := public.aq_finance_add_transaction('__AQ_TEST__ parcelas',30,'expense','Outros',current_date,'credit',null,3,'','manual');
  select id into second_id from public.aq_finance_transactions
   where user_id=auth.uid() and installment_parent_id=first_id and installment_number=2;
  if second_id is null then raise exception 'Parcelas não criadas'; end if;
  perform public.aq_finance_set_transaction_state(second_id,'settled');
  if not exists(select 1 from public.aq_finance_transactions where id=second_id and settlement_status='settled' and settled_at is not null)
  then raise exception 'Liquidação não foi salva'; end if;
  perform public.aq_finance_set_transaction_state(second_id,'posted');
  if not exists(select 1 from public.aq_finance_transactions where id=second_id and settlement_status='posted' and settled_at is null)
  then raise exception 'Estorno da liquidação falhou'; end if;
  changed := public.aq_finance_bulk_category(array[first_id,second_id],'Saúde');
  if changed <> 2 then raise exception 'Edição em lote alterou % registros',changed; end if;
  changed := public.aq_finance_update_series(second_id,'__AQ_TEST__ revisada','Casa','anotação');
  if changed <> 3 or (select count(*) from public.aq_finance_transactions
      where (id=first_id or installment_parent_id=first_id) and title='__AQ_TEST__ revisada' and category='Casa') <> 3
  then raise exception 'Edição da série falhou'; end if;
  perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
  blocked := false;
  begin perform public.aq_finance_set_transaction_state(first_id,'settled'); exception when others then blocked := true; end;
  if not blocked then raise exception 'Outro usuário alterou lançamento'; end if;
end $$;
rollback;
