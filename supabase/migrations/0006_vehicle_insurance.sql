-- Insurance details gathered via chat, one record per vehicle.
create table if not exists public.vehicle_insurance (
  vehicle_id uuid primary key references public.vehicles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  carrier text,
  policy_number text,
  monthly_premium numeric(10,2),
  coverage text,
  renewal_date date,
  notes text,
  updated_at timestamptz not null default now()
);

alter table public.vehicle_insurance enable row level security;

drop policy if exists "vehicle_insurance_all_own" on public.vehicle_insurance;
create policy "vehicle_insurance_all_own" on public.vehicle_insurance
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "vehicle_insurance_admin_select" on public.vehicle_insurance;
create policy "vehicle_insurance_admin_select" on public.vehicle_insurance
  for select using ((auth.jwt() ->> 'email') = 'elias.gomez@live.com');
