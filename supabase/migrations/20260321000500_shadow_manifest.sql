-- ─── SHADOW MANIFEST ARCHITECTURE (GitHub Mirroring) ───────────────────────────
-- This enables "edit from anywhere" fallback when the local daemon is offline.

-- 1. Track the state of a local workspace
create table if not exists public.soupz_shadow_manifest (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid references auth.users(id) on delete cascade,
    machine_id  text not null,
    branch_name text,
    head_sha    text,
    dirty_files jsonb default '[]'::jsonb, -- [{path: "src/app.js", status: "modified"}]
    last_sync   timestamptz default now()
);

-- 2. Store small diffs for uncommitted changes
create table if not exists public.soupz_shadow_diffs (
    id          uuid primary key default gen_random_uuid(),
    manifest_id uuid references public.soupz_shadow_manifest(id) on delete cascade,
    user_id     uuid references auth.users(id) on delete cascade,
    file_path   text not null,
    diff_text   text not null,
    base_sha    text,
    created_at  timestamptz default now()
);

-- Enable RLS
alter table public.soupz_shadow_manifest enable row level security;
alter table public.soupz_shadow_diffs    enable row level security;

-- Policies: Only owner can see/edit their manifests and diffs
create policy "manifests: owner only" on public.soupz_shadow_manifest
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "diffs: owner only" on public.soupz_shadow_diffs
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Add to Realtime for instant cross-device updates
alter publication supabase_realtime add table public.soupz_shadow_manifest;
alter publication supabase_realtime add table public.soupz_shadow_diffs;
