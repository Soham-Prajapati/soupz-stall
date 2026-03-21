-- Create soupz_profiles table
create table if not exists public.soupz_profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text,
  avatar_url text,
  xp integer default 0,
  level integer default 1,
  streak integer default 0,
  updated_at timestamp with time zone default now()
);

-- Enable RLS
alter table public.soupz_profiles enable row level security;

-- Policies
create policy "Public profiles are viewable by everyone."
  on public.soupz_profiles for select
  using ( true );

create policy "Users can insert their own profile."
  on public.soupz_profiles for insert
  with check ( auth.uid() = id );

create policy "Users can update own profile."
  on public.soupz_profiles for update
  using ( auth.uid() = id );
