-- Users can request a make/model be added to the 3D catalog.
create table if not exists public.vehicle_requests (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  make text not null,
  model text not null,
  created_at timestamptz not null default now()
);
create index if not exists vehicle_requests_user_id_idx on public.vehicle_requests(user_id);

alter table public.vehicle_requests enable row level security;

drop policy if exists "vehicle_requests_insert_own" on public.vehicle_requests;
create policy "vehicle_requests_insert_own" on public.vehicle_requests
  for insert with check (auth.uid() = user_id);

drop policy if exists "vehicle_requests_select_own" on public.vehicle_requests;
create policy "vehicle_requests_select_own" on public.vehicle_requests
  for select using (auth.uid() = user_id);
