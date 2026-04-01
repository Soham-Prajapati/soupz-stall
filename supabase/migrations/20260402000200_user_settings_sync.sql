-- User settings sync table with strict ownership and FK integrity.

create table if not exists public.soupz_user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme text,
  preferred_agent text,
  compact_mode boolean default false,
  preferences jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create or replace function public.soupz_touch_user_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_soupz_user_settings_updated_at on public.soupz_user_settings;
create trigger trg_soupz_user_settings_updated_at
before update on public.soupz_user_settings
for each row execute function public.soupz_touch_user_settings_updated_at();

alter table public.soupz_user_settings enable row level security;

create policy "Users can read own settings"
  on public.soupz_user_settings
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own settings"
  on public.soupz_user_settings
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own settings"
  on public.soupz_user_settings
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own settings"
  on public.soupz_user_settings
  for delete
  using (auth.uid() = user_id);
