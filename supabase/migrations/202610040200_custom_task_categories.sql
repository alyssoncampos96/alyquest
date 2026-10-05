-- Preserve existing category values and permit user-defined task categories.
begin;
do $$
declare category_att smallint; category_type "char"; constraint_row record;
begin
 select a.attnum,t.typtype into category_att,category_type
 from pg_attribute a join pg_type t on t.oid=a.atttypid
 where a.attrelid='public.tasks'::regclass and a.attname='category' and not a.attisdropped;
 if category_att is null then raise exception 'tasks.category is missing'; end if;
 -- Remove only legacy category whitelists, not unrelated constraints.
 for constraint_row in select conname from pg_constraint
 where conrelid='public.tasks'::regclass and contype='c'
 and conkey=array[category_att]::smallint[]
 and pg_get_constraintdef(oid) like '%Pessoal%'
 and pg_get_constraintdef(oid) like '%Trabalho%'
 loop
  execute format('alter table public.tasks drop constraint %I',constraint_row.conname);
 end loop;
 if category_type='e' then
  alter table public.tasks alter column category drop default;
  alter table public.tasks alter column category type text using category::text;
  alter table public.tasks alter column category set default 'Pessoal';
 end if;
 if not exists(select 1 from pg_constraint where conrelid='public.tasks'::regclass and conname='aq_task_category_length') then
  -- NOT VALID preserves legacy rows; all future writes must meet this limit.
  alter table public.tasks add constraint aq_task_category_length check(length(trim(category)) between 1 and 80) not valid;
 end if;
end $$;
notify pgrst,'reload schema';
commit;
