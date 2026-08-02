-- Per-user API usage events for rate limiting (Supabase-counted sliding
-- window — no external KV needed at beta scale). The chat route counts its
-- existing chat_messages log instead; this table covers routes that don't
-- already log per-request rows (vision OCR).
create table if not exists public.api_events (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  created_at timestamptz not null default now()
);
create index if not exists api_events_user_kind_time_idx
  on public.api_events(user_id, kind, created_at desc);

alter table public.api_events enable row level security;

drop policy if exists "api_events_insert_own" on public.api_events;
create policy "api_events_insert_own" on public.api_events
  for insert with check (auth.uid() = user_id);

drop policy if exists "api_events_select_own" on public.api_events;
create policy "api_events_select_own" on public.api_events
  for select using (auth.uid() = user_id);
