-- ─── HARDENED SECURITY MIGRATION (V2 - Type Safety Fix) ───────────────────────────
-- This script ensures all tables have RLS enabled and proper policies applied.

-- 1. Ensure user_id columns are UUID for auth.uid() comparisons
alter table public.soupz_commands 
  alter column user_id type uuid using user_id::uuid;

alter table public.soupz_responses 
  alter column user_id type uuid using user_id::uuid;

alter table public.soupz_machines 
  alter column user_id type uuid using user_id::uuid;

alter table public.soupz_orders 
  alter column user_id type uuid using user_id::uuid;

-- 2. Enable RLS on all tables
alter table public.soupz_commands  enable row level security;
alter table public.soupz_responses enable row level security;
alter table public.soupz_pairing   enable row level security;
alter table public.soupz_machines  enable row level security;
alter table public.soupz_orders    enable row level security;
alter table public.soupz_output_chunks enable row level security;

-- 3. Create strict ownership policies
drop policy if exists "commands: user owns rows" on public.soupz_commands;
create policy "commands: user owns rows" on public.soupz_commands
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "responses: user owns rows" on public.soupz_responses;
create policy "responses: user owns rows" on public.soupz_responses
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "machines: user owns rows" on public.soupz_machines;
create policy "machines: user owns rows" on public.soupz_machines
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "orders: user owns rows" on public.soupz_orders;
create policy "orders: user owns rows" on public.soupz_orders
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "chunks: user owns rows" on public.soupz_output_chunks;
create policy "chunks: user owns rows" on public.soupz_output_chunks
    for select using (
        exists (
            select 1 from public.soupz_orders
            where public.soupz_orders.id = public.soupz_output_chunks.order_id
            and public.soupz_orders.user_id = auth.uid()
        )
    );

drop policy if exists "pairing: public read" on public.soupz_pairing;
create policy "pairing: public read" on public.soupz_pairing
    for select using (true);
