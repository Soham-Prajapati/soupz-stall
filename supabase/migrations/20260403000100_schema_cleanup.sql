-- ─── DROP REDUNDANT TABLES ─────────────────────────────────────────────────────
-- Replaced by public.soupz_relationships
drop table if exists public.soupz_follows cascade;
drop table if exists public.soupz_followers cascade;

-- ─── ENFORCE FOREIGN KEYS FOR COMMANDS & RESPONSES ────────────────────────────
-- Clean up invalid uuid formats to prevent casting errors
update public.soupz_commands
set user_id = null
where user_id is not null and user_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

update public.soupz_responses
set user_id = null
where user_id is not null and user_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

update public.soupz_responses
set command_id = null
where command_id is not null and command_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- Cast user_id to UUID in case it was stored as text
alter table public.soupz_commands
  alter column user_id type uuid using user_id::uuid;

alter table public.soupz_responses
  alter column user_id type uuid using user_id::uuid,
  alter column command_id type uuid using command_id::uuid;

-- Add or recreate foreign keys (using IF NOT EXISTS logic via DO block)
do $$
begin
  if to_regclass('public.soupz_commands') is not null
     and not exists (select 1 from pg_constraint where conname = 'soupz_commands_user_id_fkey') then
    alter table public.soupz_commands
      add constraint soupz_commands_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
end $$;

do $$
begin
  if to_regclass('public.soupz_responses') is not null
     and not exists (select 1 from pg_constraint where conname = 'soupz_responses_user_id_fkey') then
    alter table public.soupz_responses
      add constraint soupz_responses_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
end $$;

do $$
begin
  if to_regclass('public.soupz_responses') is not null
     and not exists (select 1 from pg_constraint where conname = 'soupz_responses_command_id_fkey') then
    alter table public.soupz_responses
      add constraint soupz_responses_command_id_fkey
      foreign key (command_id) references public.soupz_commands(id) on delete cascade;
  end if;
end $$;
