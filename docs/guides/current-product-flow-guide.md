# Soupz Current Product Flow Guide (Detailed Markdown)

Date: 2026-03-16
Audience: human operators and external agents without repository access.
Purpose: complete runtime, UX, architecture, naming, and execution context in one markdown document.

## Which File To Share
- Share this file when someone needs the runtime flow quickly.
- Share `PROJECT_AGENT_CONTEXT_FULL.md` when someone needs full implementation context.
- This file is the shorter operational view, not the canonical full handoff.

## 1) Current One-Command Paths

### Setup (first run or dependency refresh)
```bash
pnpm run setup
```

What this command does:
1. Detects package manager (`SOUPZ_PM` override, then auto-detect).
2. Creates `.env` from `.env.example` if missing.
3. Installs dependencies in:
   - repo root
   - `packages/remote-server`
   - `packages/dashboard`
   - `packages/mobile-ide`

### Start web stack
Preferred:
```bash
pnpm run dev:web:pnpm
```

Fallback:
```bash
npm run dev:web
```

What start does automatically:
1. Starts remote server.
2. Waits for `GET /health` success.
3. Creates pairing code + validates into token.
4. Starts dashboard dev server.
5. Opens browser with prefilled `remote` + `token` query params.

## 2) End-to-End Product Runtime Flow

```text
dashboard prompt submit
  -> POST /api/orders (remote server)
  -> order created + lifecycle events initialized
  -> runtime route selected
  -> CLI/agent process spawned
  -> stdout/stderr captured and appended as deltas
  -> dashboard polls/reads order summary + details
  -> final status: completed or failed
```

## 3) Component Layers

### Frontend dashboard
- Prompt composer
- Queue/history panel
- Timeline events panel
- Output stream panel
- Diff/changes drawer

Primary files:
- `packages/dashboard/src/App.jsx`
- `packages/dashboard/src/index.css`

### Remote server
- OTP pairing
- session token validation
- order APIs
- terminal bridge
- optional Supabase persistence

Primary file:
- `packages/remote-server/src/index.js`

### Core runtime
- route and agent selection
- session orchestration
- process management
- memory/grading hooks

Primary files:
- `src/session.js`
- `src/orchestrator/router.js`
- `src/orchestrator/semantic-router.js`
- `src/agents/spawner.js`
- `src/core/stall-monitor.js`

## 4) Agent Naming and Role Clarification

### `soupz-orchestrator`
- task-level conductor
- decomposes one request into specialist subflows
- strong planning + synthesis fit

### `soupz-workflow`
- workflow-mode wrapper for structured pipeline execution
- broader automation surface
- supports multi-step orchestrated patterns

## 5) Metaphor and Visual Language Rules

### Kitchen vs Stall
- Keep both terms, but apply them intentionally.
- Use "stall" in user-facing language.
- Use "kitchen" only as internal workflow shorthand where already established.

### Workspace-change rule (important)
- Tools/utensils are mostly shared and stable.
- Workspaces switch by stall role.
- Visual differentiation should come from workspace modules more than global tool changes.

## 6) Visual Asset Production Rules

### Production theme
- strict top-down only
- chroma background `#00FF00`
- no fake transparency

### Experimental theme
- isometric only
- isolated in `images/experimental/isometric/`
- do not mix with production top-down assets

## 7) Image Naming and Storage System

### Root folder
- `images/`

### Folder map
- `images/stalls/`
- `images/workspaces/`
- `images/props/`
- `images/tiles/`
- `images/characters/`
- `images/ui/`
- `images/reference/`
- `images/experimental/isometric/`

### Filename format
`[mode]-[family]-[asset]-[variant]-v[major].[minor].png`

Examples:
- `td-stall-burger-shell-day-v1.0.png`
- `td-workspace-fry-main-v1.0.png`
- `td-prop-queue-barriers-set-a-v1.0.png`
- `td-sheet-utensils-core-main-v1.0.png`
- `td-sprite-manager-day-v1.0.png`
- `iso-stall-dessert-shell-main-v0.1.png`

## 8) Tracking Files for Assets

Human tracker:
- `dashpad.md`

Machine tracker:
- `images/manifest.json`

Rule:
Every generated image must be reflected in both files.

## 9) Supabase Keys and What Goes Where

### Core user-auth variables
Used by `src/auth/user-auth.js`:
- `SOUPZ_SUPABASE_URL`
- `SOUPZ_SUPABASE_KEY`

### Remote server persistence variables
Used by `packages/remote-server/src/index.js`:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SOUPZ_SUPABASE_ORDERS_TABLE` (optional)

### Correct key type guidance
- `SOUPZ_SUPABASE_KEY`: publishable/anon is acceptable.
- `SUPABASE_SERVICE_ROLE_KEY`: must be service-role/secret key.

If you put publishable in `SUPABASE_SERVICE_ROLE_KEY`, server-side persistence behavior will be limited or fail.

## 10) Supabase SQL and CLI Flow

Use Supabase CLI for SQL migration flow:

```bash
supabase link --project-ref <PROJECT_REF>
supabase migration list
supabase db push
```

Migration file currently present:
- `supabase/migrations/20260316000100_soupz_orders_table.sql`

## 11) Known Current Limits
- Orders are tracked in memory and persisted best-effort to Supabase when configured.
- Dashboard still relies on polling for parts of update flow.
- Full event push streaming can still be improved.

## 12) Competitive Direction (ruflo-style efficiency)

Target approach:
1. complexity-aware route selection
2. cheap model default path
3. premium escalation only on confidence/complexity gates
4. strict output compaction and summarization
5. observable token/cost metrics per route

## 13) Practical Next Steps
1. Confirm service-role key type is correct in `.env`.
2. Link Supabase project and run `supabase db push`.
3. Add push-style order timeline updates.
4. Keep visual generation in top-down production theme.
5. Use isometric only in experimental track.