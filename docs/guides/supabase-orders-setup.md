# Supabase Orders Setup (CLI First)

Use this after creating your Supabase project.

## 1) Add API Keys (Where to Put Them)

For this repo, keys are read from environment variables.

Create values in your terminal session (or secret manager) before running the stack:

```bash
export SUPABASE_URL="https://YOUR_PROJECT_REF.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY"
export SOUPZ_SUPABASE_ORDERS_TABLE="soupz_orders"
```

Optional auth keys used by `src/auth/user-auth.js`:

```bash
export SOUPZ_SUPABASE_URL="https://YOUR_PROJECT_REF.supabase.co"
export SOUPZ_SUPABASE_KEY="YOUR_ANON_OR_PUBLIC_KEY"
```

Key correctness:
- `SOUPZ_SUPABASE_KEY` can be publishable/anon.
- `SUPABASE_SERVICE_ROLE_KEY` must be service-role/secret (not publishable).
- If publishable key is used for `SUPABASE_SERVICE_ROLE_KEY`, remote server DB persistence is not correctly privileged.

Where to get them in Supabase:
- Go to Supabase Dashboard -> your project -> Settings -> API.
- `SOUPZ_SUPABASE_URL` and `SUPABASE_URL` are your project URL.
- `SOUPZ_SUPABASE_KEY` should use the publishable or anon key from that page.
- `SUPABASE_SERVICE_ROLE_KEY` should use the `service_role` secret key from that page.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` in browser code or public repos.

Reference template file:

`/.env.example`

## 2) Supabase CLI Project Link

```bash
supabase link --project-ref YOUR_PROJECT_REF
```

If this step is skipped, `supabase migration list` and `supabase db push` fail with:
"Cannot find project ref. Have you run supabase link?"

## 3) Migration File (Already Added)

Migration path:

`supabase/migrations/20260316000100_soupz_orders_table.sql`

SQL contents:

```sql
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
```

## 4) Apply Migration via CLI

```bash
supabase migration list
supabase db push
```

If you need local-only verification first:

```bash
supabase start
supabase db reset
```

## 5) Install Remote Server Dependency
From repo root:

```bash
npm install --prefix packages/remote-server
```

Or with pnpm:

```bash
pnpm --dir packages/remote-server install
```

## 6) Run Web Stack

```bash
pnpm run dev:web:pnpm
```

## Notes
- Persistence is optional and non-blocking.
- If Supabase is unreachable, local in-memory order flow still works.
- Current implementation writes order snapshots at key lifecycle events:
  - created
  - started
  - failed
  - completed
- If `supabase db push` says project ref is missing, run `supabase link --project-ref ...` first.
- Verify the table exists in Supabase SQL editor after push:

```sql
select * from public.soupz_orders order by created_at desc limit 20;
```
