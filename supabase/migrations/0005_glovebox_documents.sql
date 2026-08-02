-- Glovebox: uploaded receipts/documents per vehicle, foldered.
create table if not exists public.documents (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  folder text not null,
  name text not null,
  storage_path text not null unique,
  mime text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);
create index if not exists documents_vehicle_folder_idx on public.documents(vehicle_id, folder, created_at desc);

alter table public.documents enable row level security;

drop policy if exists "documents_all_own" on public.documents;
create policy "documents_all_own" on public.documents
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "documents_admin_select" on public.documents;
create policy "documents_admin_select" on public.documents
  for select using ((auth.jwt() ->> 'email') = 'elias.gomez@live.com');

-- Private storage bucket; paths are <user_id>/<vehicle_id>/<folder>/<file>.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('glovebox', 'glovebox', false, 10485760,
        array['image/jpeg','image/png','image/webp','image/heic','application/pdf'])
on conflict (id) do nothing;

drop policy if exists "glovebox_objects_own" on storage.objects;
create policy "glovebox_objects_own" on storage.objects
  for all using (
    bucket_id = 'glovebox' and (storage.foldername(name))[1] = auth.uid()::text
  ) with check (
    bucket_id = 'glovebox' and (storage.foldername(name))[1] = auth.uid()::text
  );
