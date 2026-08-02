-- Where a spec came from: 'user' = stated/confirmed by the user in chat,
-- 'oem' = factory/stock value pulled by AI during vehicle initialization
-- (shown with a "stock" badge; a user statement overwrites it to 'user').
alter table public.vehicle_specs
  add column if not exists source text not null default 'user'
  check (source in ('user', 'oem'));
