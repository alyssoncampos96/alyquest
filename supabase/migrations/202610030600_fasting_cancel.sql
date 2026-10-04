begin;
create or replace function public.aq_fasting_cancel(p_session_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Não autenticado'; end if;
 update public.aq_fasting_sessions set status='cancelled',ended_at=now(),reward_units=0
 where id=p_session_id and user_id=auth.uid() and status='active' and ended_at is null;
 if not found then raise exception 'Jejum ativo não encontrado'; end if;
end $$;
revoke execute on function public.aq_fasting_cancel(uuid) from public,anon;
grant execute on function public.aq_fasting_cancel(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
