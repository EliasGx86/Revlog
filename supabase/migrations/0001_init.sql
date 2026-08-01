-- RevLog initial schema
-- Run via: supabase db push  (after `supabase link`)
-- Or paste into Supabase SQL editor.

create extension if not exists "uuid-ossp";

-- ============================================================
-- profiles: app-level user data (auth.users handles credentials)
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  stripe_customer_id text unique,
  subscription_status text not null default 'incomplete'
    check (subscription_status in ('incomplete','active','past_due','canceled','trialing')),
  subscription_plan text check (subscription_plan in ('monthly','yearly')),
  subscription_current_period_end timestamptz,
  onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- vehicles
-- ============================================================
create table if not exists public.vehicles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  make text not null,
  model text not null,
  year int not null check (year between 1900 and 2100),
  color text not null,                         -- hex like "#cc0000"
  body_type text not null check (body_type in ('sedan','truck','suv')),
  current_mileage int not null default 0 check (current_mileage >= 0),
  mileage_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists vehicles_user_id_idx on public.vehicles(user_id);

-- ============================================================
-- maintenance_logs
-- ============================================================
create table if not exists public.maintenance_logs (
  id uuid primary key default uuid_generate_v4(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  service_type text not null,                  -- e.g. 'oil_change','tire_rotation','brake_pads'
  zone text check (zone in ('hood','wheels','windshield','other')),
  service_date date not null default current_date,
  mileage int check (mileage >= 0),
  product_brand text,
  product_name text,
  product_details jsonb not null default '{}'::jsonb,
  notes text,
  raw_input text,                              -- the original user utterance
  created_at timestamptz not null default now()
);
create index if not exists logs_vehicle_id_idx on public.maintenance_logs(vehicle_id);
create index if not exists logs_user_id_idx on public.maintenance_logs(user_id);
create index if not exists logs_service_type_idx on public.maintenance_logs(service_type);
create index if not exists logs_service_date_idx on public.maintenance_logs(service_date desc);

-- ============================================================
-- alerts
-- ============================================================
create table if not exists public.alerts (
  id uuid primary key default uuid_generate_v4(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  service_type text not null,
  due_date date,
  due_mileage int,
  status text not null default 'pending'
    check (status in ('pending','dismissed','completed')),
  triggered_by_log_id uuid references public.maintenance_logs(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists alerts_vehicle_id_idx on public.alerts(vehicle_id);
create index if not exists alerts_status_idx on public.alerts(status);

-- ============================================================
-- updated_at trigger
-- ============================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists vehicles_set_updated_at on public.vehicles;
create trigger vehicles_set_updated_at before update on public.vehicles
  for each row execute function public.set_updated_at();

drop trigger if exists alerts_set_updated_at on public.alerts;
create trigger alerts_set_updated_at before update on public.alerts
  for each row execute function public.set_updated_at();

-- ============================================================
-- Auto-create profile on signup
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.profiles enable row level security;
alter table public.vehicles enable row level security;
alter table public.maintenance_logs enable row level security;
alter table public.alerts enable row level security;

-- profiles: users can read/update their own row only
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- vehicles: full CRUD on rows you own
drop policy if exists "vehicles_all_own" on public.vehicles;
create policy "vehicles_all_own" on public.vehicles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- logs: full CRUD on rows you own
drop policy if exists "logs_all_own" on public.maintenance_logs;
create policy "logs_all_own" on public.maintenance_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- alerts: read/update own; inserts happen via service role or trigger
drop policy if exists "alerts_select_own" on public.alerts;
create policy "alerts_select_own" on public.alerts
  for select using (auth.uid() = user_id);

drop policy if exists "alerts_update_own" on public.alerts;
create policy "alerts_update_own" on public.alerts
  for update using (auth.uid() = user_id);
