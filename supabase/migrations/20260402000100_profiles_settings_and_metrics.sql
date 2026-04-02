-- Align soupz_profiles with dashboard/runtime writes.
alter table public.soupz_profiles
  add column if not exists settings jsonb default '{}'::jsonb,
  add column if not exists message_count integer default 0,
  add column if not exists agent_count integer default 0,
  add column if not exists created_at timestamp with time zone default now();

create index if not exists idx_soupz_profiles_xp_desc on public.soupz_profiles (xp desc);
