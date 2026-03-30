# Soupz Setup Guide

Get Soupz running on your machine and connected to the web dashboard.

## Prerequisites

- Node.js 18+
- npm (or pnpm)
- At least one CLI agent installed:
  - **Gemini** (free): `npm install -g @google/gemini-cli`
  - **Copilot**: `npm install -g @copilot/cli`
  - **Kiro**: Local LLM alternative
- Supabase project (credentials below)

## 1. Local Development

### Start the dev stack

```bash
cd /path/to/soupz-agents
npm run dev:web
```

This starts both:
- **Daemon** on port 7533 (handles agent spawning, file operations, git, terminal)
- **Vite dev server** on port 7534 (web app)

The daemon generates a 9-character pairing code. Enter this code at `soupz.vercel.app/connect` to pair your browser.

Notes:
- `npm run dev:web` now has resilient startup behavior. If bootstrap token creation fails, it continues in local no-token mode instead of exiting.
- Pair validation compatibility checks include both `/pair/validate` and `/api/pair`.

### Individual processes

```bash
# Terminal 1: Daemon only
npx soupz

# Terminal 2: Web app dev server
cd packages/dashboard && npm run dev
```

## 2. Supabase Configuration

### Create OAuth credentials

#### Google OAuth

1. Go to [Supabase Dashboard](https://supabase.com/dashboard) > select your project
2. Navigate to **Authentication** > **Providers** > **Google**
3. Toggle **Enabled**
4. Go to [Google Cloud Console](https://console.cloud.google.com)
5. Navigate to **APIs & Services** > **Credentials**
6. Click **+ Create Credentials** > **OAuth 2.0 Client ID**
7. Application type: **Web application**
8. Add **Authorized JavaScript origins**:
   - `https://soupz.vercel.app`
   - `http://localhost:7534`
9. Add **Authorized redirect URIs**:
   - `https://<your-supabase-project>.supabase.co/auth/v1/callback`
10. Copy **Client ID** and **Client Secret**
11. Paste both into Supabase Google provider settings
12. Click **Save**

#### GitHub OAuth

1. Go to [GitHub Developer Settings](https://github.com/settings/developers) > **OAuth Apps** > **New OAuth App**
2. Fill in:
   - **Application name**: `Soupz`
   - **Homepage URL**: `https://soupz.vercel.app`
   - **Authorization callback URL**: `https://<your-supabase-project>.supabase.co/auth/v1/callback`
3. Click **Register application**
4. Copy **Client ID**
5. Click **Generate a new client secret** and copy it
6. Go to Supabase Dashboard > **Authentication** > **Providers** > **GitHub**
7. Toggle **Enabled**, paste Client ID and Secret
8. Click **Save**

### Initialize database tables

Run this SQL in your Supabase SQL Editor:

```sql
-- ─── Commands (web → daemon) ──────────────────────────────────────────────────
create table if not exists soupz_commands (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references auth.users(id) on delete cascade,
    type        text not null,
    payload     jsonb default '{}',
    status      text not null default 'pending',
    created_at  timestamptz default now()
);

-- ─── Responses (daemon → web) ─────────────────────────────────────────────────
create table if not exists soupz_responses (
    id          uuid primary key default gen_random_uuid(),
    command_id  uuid references soupz_commands(id) on delete cascade,
    user_id     uuid not null references auth.users(id) on delete cascade,
    type        text not null,
    result      jsonb default '{}',
    status      text not null default 'success',
    created_at  timestamptz default now()
);

-- ─── Pairing (anonymous link) ────────────────────────────────────────────────
create table if not exists soupz_pairing (
    code        text primary key,
    token       text not null,
    hostname    text,
    lan_ips     jsonb default '[]',
    public_ip   text,
    port        integer default 7533,
    created_at  timestamptz default now(),
    expires_at  timestamptz not null
);

-- ─── Row Level Security ───────────────────────────────────────────────────────
alter table soupz_commands  enable row level security;
alter table soupz_responses enable row level security;
alter table soupz_pairing   enable row level security;

create policy "commands: user owns rows" on soupz_commands
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "responses: user owns rows" on soupz_responses
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "pairing: public read" on soupz_pairing
    for select using (true);

-- ─── Realtime ─────────────────────────────────────────────────────────────────
alter publication supabase_realtime add table soupz_commands;
alter publication supabase_realtime add table soupz_responses;
alter publication supabase_realtime add table soupz_pairing;
```

## 3. Environment Variables

Create a `.env` file in the project root:

```env
# Supabase
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>

# Daemon port (optional, defaults to 7533)
SOUPZ_REMOTE_PORT=7533

# Optional: Speech-to-text API
SARVAM_API_KEY=<your-sarvam-key>

# Optional: Custom agent paths
PATH_COPILOT_CLI=/path/to/copilot
PATH_GEMINI_CLI=/path/to/gemini-cli
```

## 4. First Run

1. Start the daemon:
   ```bash
   npm run dev:web
   ```

2. Open your browser to `http://localhost:7534`

3. Sign in with Google or GitHub

4. Note the 9-character pairing code displayed in the terminal

5. From another device or browser, visit `soupz.vercel.app/connect` and enter the code

6. You're paired! Start chatting with AI agents

### Restarting Cleanly

If UI/runtime behavior appears stale after changes:

1. Stop the active dev process (`Ctrl+C` in terminal)
2. Restart full stack:
    ```bash
    npm run dev:web
    ```
3. Hard refresh browser (`Cmd+Shift+R`)

## 5. Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+1` | Chat mode |
| `Cmd+2` | IDE mode |
| `Cmd+O` | Open folder |
| `Cmd+K` | Command palette |
| `Cmd+Shift+P` | Command palette (alternate) |
| `Cmd+Shift+F` | Search files |
| `Cmd+S` | Save file |

## 6. Deployment

### Vercel

The dashboard is deployed on Vercel:

1. Push to GitHub
2. Connect your repo to Vercel at [vercel.com](https://vercel.com)
3. Set environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) in project settings
4. Vercel auto-deploys on push to `main`

The daemon always runs locally on the user's machine (`npx soupz` or `npm run dev:web`).

## Troubleshooting

### "Cannot find module" on startup
```bash
npm install
cd packages/remote-server && npm install
```

### Daemon won't start
- Check port 7533 is available: `lsof -i :7533`
- Change port: `SOUPZ_REMOTE_PORT=8000 npx soupz`

### Pairing code not showing
- Ensure daemon is running: `npm run dev:web`
- Check browser console for errors
- Verify Supabase credentials in `.env`

### Pairing code was accepted but now appears invalid
- This can happen if a one-time code was consumed already.
- Generate/refresh pairing state by restarting `npm run dev:web`.
- Re-open `soupz.vercel.app/connect` and use the latest code shown in terminal.

### OAuth login fails
- Verify redirect URIs match exactly in Google Cloud Console / GitHub settings
- Check Supabase project URL matches in `.env`
- Clear browser cookies and try again

### No agents available
- Install at least one CLI agent: `npm install -g @google/gemini-cli`
- Verify agent is in PATH: `which gemini-cli`
- Restart daemon after installing agents
