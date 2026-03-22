-- ─── SOCIAL GRAPH ARCHITECTURE (Friends & Followers) ──────────────────────────
-- This table handles the relationship between developers.

create table if not exists public.soupz_relationships (
    id          uuid primary key default gen_random_uuid(),
    follower_id uuid references auth.users(id) on delete cascade,
    followed_id uuid references auth.users(id) on delete cascade,
    status      text default 'following', -- 'following' | 'friend'
    created_at  timestamptz default now(),
    unique(follower_id, followed_id)
);

-- Enable RLS
alter table public.soupz_relationships enable row level security;

-- Policies
create policy "users can see their own relationships" on public.soupz_relationships
    for select using (auth.uid() = follower_id or auth.uid() = followed_id);

create policy "users can follow others" on public.soupz_relationships
    for insert with check (auth.uid() = follower_id);

create policy "users can unfollow" on public.soupz_relationships
    for delete using (auth.uid() = follower_id);

-- Add to Realtime
alter publication supabase_realtime add table public.soupz_relationships;
