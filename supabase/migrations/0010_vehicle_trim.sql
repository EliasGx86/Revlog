-- Trim/submodel (LX, EX-L, Lariat…) decoded from the VIN via the free NHTSA
-- vPIC API. Parts stores ask for this ("what trim?") and specs vary by trim,
-- so the initializer uses it to pull trim-correct values.
alter table public.vehicles add column if not exists trim text;
