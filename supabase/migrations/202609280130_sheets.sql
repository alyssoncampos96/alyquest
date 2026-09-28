begin;
create table public.aq_sheet_settings(user_id uuid primary key references auth.users(id) on delete cascade,responsible text not null,last_sync timestamptz);
create table public.aq_sheet_links(user_id uuid not null references auth.users(id) on delete cascade,external_id text not null,task_id uuid not null references public.tasks(id) on delete cascade,source_status text not null,project text not null default '',primary key(user_id,external_id),unique(task_id));
alter table public.aq_sheet_settings enable row level security;
alter table public.aq_sheet_links enable row level security;
create policy own_read on public.aq_sheet_settings for select to authenticated using(user_id=auth.uid());
create policy own_read on public.aq_sheet_links for select to authenticated using(user_id=auth.uid());
revoke all on public.aq_sheet_settings,public.aq_sheet_links from anon,authenticated;
grant select on public.aq_sheet_settings,public.aq_sheet_links to authenticated;
create function public.aq_import_sheet(p_responsible text,p_rows jsonb) returns integer language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); row jsonb; tid uuid; imported int:=0;
begin
 if uid is null then raise exception 'Não autenticado';end if;
 if p_responsible is null or length(trim(p_responsible)) not between 1 and 100 or jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows)>1000 then raise exception 'Dados inválidos';end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text||'sheet',0));
 for row in select * from jsonb_array_elements(p_rows) loop
  if coalesce(length(row->>'id'),0) not between 1 and 100 or coalesce(length(trim(row->>'title')),0) not between 1 and 200 or coalesce(length(row->>'status'),0) not between 1 and 100 then raise exception 'Tarefa inválida';end if;
  select task_id into tid from public.aq_sheet_links where user_id=uid and external_id=row->>'id';
  if tid is null and row->>'active'='true' then
   tid:=public.aq_save_task(null,jsonb_build_object('title',row->>'title','category','Trabalho','priority','medium','estimated_hours',1,'due_date',row->>'due','kind','single'),null,'one');
   insert into public.aq_sheet_links(user_id,external_id,task_id,source_status,project) values(uid,row->>'id',tid,row->>'status',left(coalesce(row->>'project',''),500));
   imported:=imported+1;
  elsif tid is not null then
   -- Local status, rewards, hours, boss and edits remain under the user's control.
   update public.aq_sheet_links set source_status=row->>'status',project=left(coalesce(row->>'project',''),500) where user_id=uid and external_id=row->>'id';
  end if;
 end loop;
 insert into public.aq_sheet_settings(user_id,responsible,last_sync) values(uid,trim(p_responsible),now()) on conflict(user_id) do update set responsible=excluded.responsible,last_sync=excluded.last_sync;
 return imported;
end $$;
revoke execute on function public.aq_import_sheet(text,jsonb) from public,anon;
grant execute on function public.aq_import_sheet(text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
