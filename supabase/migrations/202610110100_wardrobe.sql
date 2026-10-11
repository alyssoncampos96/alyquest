-- Fotos são privadas; a primeira pasta de cada objeto é o ID do usuário.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('aq-wardrobe', 'aq-wardrobe', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 8388608,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

create table if not exists public.aq_wardrobe_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 100),
  category text not null check (category in ('top','bottom','one_piece','shoes','outerwear','accessory')),
  color text not null check (length(trim(color)) between 1 and 30),
  condition text not null default 'good' check (condition in ('new','good','worn')),
  occasions text[] not null default '{}',
  photo_path text not null,
  processed_path text,
  processed_at timestamptz,
  prefer_original boolean not null default false,
  purchased_on date,
  last_worn_on date,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint aq_wardrobe_paths_owned check (
    split_part(photo_path, '/', 1) = user_id::text and
    (processed_path is null or split_part(processed_path, '/', 1) = user_id::text)
  ),
  constraint aq_wardrobe_occasions_valid check (
    occasions <@ array['work','gym','social','errands','home']::text[]
  )
);
create index if not exists aq_wardrobe_items_owner on public.aq_wardrobe_items(user_id, archived_at, created_at desc);
alter table public.aq_wardrobe_items enable row level security;
create policy aq_wardrobe_items_owner on public.aq_wardrobe_items
  for all to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
grant select, insert, update, delete on public.aq_wardrobe_items to authenticated;

create policy aq_wardrobe_objects_read on storage.objects for select to authenticated
  using (bucket_id = 'aq-wardrobe' and split_part(name, '/', 1) = (select auth.uid()::text));
create policy aq_wardrobe_objects_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'aq-wardrobe' and split_part(name, '/', 1) = (select auth.uid()::text));
create policy aq_wardrobe_objects_update on storage.objects for update to authenticated
  using (bucket_id = 'aq-wardrobe' and split_part(name, '/', 1) = (select auth.uid()::text))
  with check (bucket_id = 'aq-wardrobe' and split_part(name, '/', 1) = (select auth.uid()::text));
create policy aq_wardrobe_objects_delete on storage.objects for delete to authenticated
  using (bucket_id = 'aq-wardrobe' and split_part(name, '/', 1) = (select auth.uid()::text));
