-- ─── SOCIAL ARCHITECTURE (Followers/Following) ─────────────────────────────────
-- This table tracks user relationships without bloating the database.

create table if not exists public.soupz_follows (
    follower_id  uuid references auth.users(id) on delete cascade,
    following_id uuid references auth.users(id) on delete cascade,
    created_at   timestamptz default now(),
    primary key (follower_id, following_id)
);

-- Enable RLS
alter table public.soupz_follows enable row level security;

-- Policies
drop policy if exists "follows: public read" on public.soupz_follows;
create policy "follows: public read" on public.soupz_follows
    for select using (true);

drop policy if exists "follows: user can follow" on public.soupz_follows;
create policy "follows: user can follow" on public.soupz_follows
    for insert with check (auth.uid() = follower_id);

drop policy if exists "follows: user can unfollow" on public.soupz_follows;
create policy "follows: user can unfollow" on public.soupz_follows
    for delete using (auth.uid() = follower_id);

-- Add to Realtime
alter publication supabase_realtime add table public.soupz_follows;
