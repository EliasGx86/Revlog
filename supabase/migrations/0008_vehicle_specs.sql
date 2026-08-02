-- Vehicle hardware facts ("specs"): oil type, drain plug size, tire size,
-- wiper lengths… — things that are TRUE about the vehicle rather than events
-- that happened to it (those are maintenance_logs). Saved from chat when the
-- user states a fact or confirms the assistant's guidance ("log it").
create table if not exists public.vehicle_specs (
  id uuid primary key default uuid_generate_v4(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  -- normalized key, e.g. 'oil_type', 'oil_drain_plug_size', 'tire_size'
  name text not null,
  -- display label, e.g. 'Oil type'
  label text not null,
  value text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (vehicle_id, name)
);
create index if not exists vehicle_specs_vehicle_id_idx on public.vehicle_specs(vehicle_id);

drop trigger if exists vehicle_specs_set_updated_at on public.vehicle_specs;
create trigger vehicle_specs_set_updated_at before update on public.vehicle_specs
  for each row execute function public.set_updated_at();

alter table public.vehicle_specs enable row level security;

drop policy if exists "vehicle_specs_all_own" on public.vehicle_specs;
create policy "vehicle_specs_all_own" on public.vehicle_specs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
