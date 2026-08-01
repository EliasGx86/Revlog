-- VIN + license plate at-a-glance fields; motorcycle body type
alter table public.vehicles add column if not exists vin text;
alter table public.vehicles add column if not exists license_plate text;

alter table public.vehicles drop constraint if exists vehicles_body_type_check;
alter table public.vehicles add constraint vehicles_body_type_check
  check (body_type in ('sedan','truck','suv','motorcycle'));
