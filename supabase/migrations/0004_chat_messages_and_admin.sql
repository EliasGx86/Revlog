-- Log every chat exchange (question + reply) for beta feedback and debugging.
create table if not exists public.chat_messages (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  message text not null,
  intent text not null,
  reply text not null,
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_created_at_idx on public.chat_messages(created_at desc);

alter table public.chat_messages enable row level security;

drop policy if exists "chat_messages_insert_own" on public.chat_messages;
create policy "chat_messages_insert_own" on public.chat_messages
  for insert with check (auth.uid() = user_id);

drop policy if exists "chat_messages_select_own" on public.chat_messages;
create policy "chat_messages_select_own" on public.chat_messages
  for select using (auth.uid() = user_id);

-- Admin (beta: single hardcoded email) can read everything needed for the
-- admin dashboard: all chats, all profiles, all vehicles, all requests.
drop policy if exists "chat_messages_admin_select" on public.chat_messages;
create policy "chat_messages_admin_select" on public.chat_messages
  for select using ((auth.jwt() ->> 'email') = 'elias.gomez@live.com');

drop policy if exists "profiles_admin_select" on public.profiles;
create policy "profiles_admin_select" on public.profiles
  for select using ((auth.jwt() ->> 'email') = 'elias.gomez@live.com');

drop policy if exists "vehicles_admin_select" on public.vehicles;
create policy "vehicles_admin_select" on public.vehicles
  for select using ((auth.jwt() ->> 'email') = 'elias.gomez@live.com');

drop policy if exists "vehicle_requests_admin_select" on public.vehicle_requests;
create policy "vehicle_requests_admin_select" on public.vehicle_requests
  for select using ((auth.jwt() ->> 'email') = 'elias.gomez@live.com');
