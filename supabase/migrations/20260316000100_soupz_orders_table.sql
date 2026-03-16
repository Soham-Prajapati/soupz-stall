-- Soupz orders table for remote-server persistence
create table if not exists public.soupz_orders (
  id text primary key,
  prompt text not null,
  agent text not null,
  run_agent text not null,
  model_policy text,
  status text not null,
  created_at timestamptz not null,
  started_at timestamptz,
  finished_at timestamptz,
  duration_ms bigint,
  exit_code integer,
  stdout text,
  stderr text,
  events jsonb not null default '[]'::jsonb
);

create index if not exists idx_soupz_orders_created_at
  on public.soupz_orders (created_at desc);

create index if not exists idx_soupz_orders_status
  on public.soupz_orders (status);
