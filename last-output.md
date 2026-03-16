# Last Task Output

**Task:** Create Relay Tables Migration
**Status:** ✅ Done

## Confirmation
File created at: `supabase/migrations/20260316000200_soupz_relay_tables.sql`

## Full File Contents
```sql
-- Add relay columns to existing orders table
alter table public.soupz_orders 
  add column if not exists user_id text,
  add column if not exists machine_id text,
  add column if not exists source text default 'cli';

-- Real-time output streaming chunks
create table if not exists public.soupz_output_chunks (
  id bigserial primary key,
  order_id text not null references public.soupz_orders(id),
  chunk text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_chunks_order_id
  on public.soupz_output_chunks (order_id, created_at asc);

-- Machine heartbeat (is laptop online?)
create table if not exists public.soupz_machines (
  id text primary key,
  user_id text not null,
  name text not null default 'My Laptop',
  last_seen timestamptz not null default now(),
  status text not null default 'offline',
  version text
);

-- Enable Supabase real-time on these tables
alter publication supabase_realtime 
  add table public.soupz_orders;
alter publication supabase_realtime 
  add table public.soupz_output_chunks;
alter publication supabase_realtime 
  add table public.soupz_machines;
```

## Tables Included
1. `soupz_orders` (altered)
2. `soupz_output_chunks` (new)
3. `soupz_machines` (new)
