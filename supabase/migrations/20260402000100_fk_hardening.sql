-- Harden foreign-key coverage for relay/order tables without breaking existing rows.
-- Constraints are added as NOT VALID first so legacy orphaned rows do not block deploys.

create index if not exists idx_soupz_orders_user_id
  on public.soupz_orders (user_id);

create index if not exists idx_soupz_orders_machine_id
  on public.soupz_orders (machine_id);

create index if not exists idx_soupz_machines_user_id
  on public.soupz_machines (user_id);

create index if not exists idx_soupz_shadow_manifest_machine_id
  on public.soupz_shadow_manifest (machine_id);

do $$
begin
  if to_regclass('public.soupz_machines') is not null
     and not exists (select 1 from pg_constraint where conname = 'soupz_machines_user_id_fkey') then
    alter table public.soupz_machines
      add constraint soupz_machines_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade not valid;
  end if;
end $$;

do $$
begin
  if to_regclass('public.soupz_orders') is not null
     and not exists (select 1 from pg_constraint where conname = 'soupz_orders_user_id_fkey') then
    alter table public.soupz_orders
      add constraint soupz_orders_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete set null not valid;
  end if;
end $$;

do $$
begin
  if to_regclass('public.soupz_orders') is not null
     and to_regclass('public.soupz_machines') is not null
     and not exists (select 1 from pg_constraint where conname = 'soupz_orders_machine_id_fkey') then
    alter table public.soupz_orders
      add constraint soupz_orders_machine_id_fkey
      foreign key (machine_id) references public.soupz_machines(id) on delete set null not valid;
  end if;
end $$;

do $$
begin
  if to_regclass('public.soupz_shadow_manifest') is not null
     and to_regclass('public.soupz_machines') is not null
     and not exists (select 1 from pg_constraint where conname = 'soupz_shadow_manifest_machine_id_fkey') then
    alter table public.soupz_shadow_manifest
      add constraint soupz_shadow_manifest_machine_id_fkey
      foreign key (machine_id) references public.soupz_machines(id) on delete restrict not valid;
  end if;
end $$;

-- Run these manually after cleaning legacy orphan rows:
-- alter table public.soupz_machines validate constraint soupz_machines_user_id_fkey;
-- alter table public.soupz_orders validate constraint soupz_orders_user_id_fkey;
-- alter table public.soupz_orders validate constraint soupz_orders_machine_id_fkey;
-- alter table public.soupz_shadow_manifest validate constraint soupz_shadow_manifest_machine_id_fkey;
