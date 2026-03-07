# 📺 Kitchen Floor Dashboard\n
## 📺 Kitchen Floor Dashboard — How It Works

The Kitchen Floor is a **per-session HTML dashboard** that shows real-time activity of your Soupz Stall session.

### How It's Generated

When you run `/dashboard` or when a Stall Monitor starts, it creates two files per session in `~/.soupz-agents/dashboard/`:

```
~/.soupz-agents/dashboard/
├── stall-{sessionId}.json    ← State data (updated every 2s)
├── stall-{sessionId}.html    ← Self-contained dashboard (reads the JSON)
└── index.html                ← Multi-stall overview (served via HTTP)
```

- **State JSON**: The `StallMonitor` class (`src/core/stall-monitor.js`) writes session state every 2 seconds. It contains:
  - `stall` — name, status (idle/cooking), uptime
  - `chefs` — all 38 chefs with their grades, call counts, current state
  - `kitchens` — tool engines (Copilot, Gemini) with status
  - `orders` — last 50 tasks with prompts, status (cooking/served/burnt), durations
  - `activeOrders` — currently running tasks
  - `stats` — routing history, persona call counts, tool call counts
  - `tokens` — total input/output/cost, broken down by engine and model

- **Session HTML**: A self-contained HTML file that auto-refreshes by fetching its JSON sibling every 2 seconds. No server needed — just open the HTML file directly.

### How to View

```bash
# Option 1: Via Soupz CLI (starts HTTP server + opens browser)
/dashboard

# Option 2: Open the HTML file directly
open ~/.soupz-agents/dashboard/stall-{sessionId}.html
```

### Customizing the UI

The session HTML is at `~/.soupz-agents/dashboard/stall-{sessionId}.html`. It's a single self-contained file with inline CSS and JS. Key sections:

1. **CSS Variables** (top of `<style>`) — colors, spacing, fonts. Change `--bg`, `--accent`, `--yellow` etc.
2. **Kitchen Floor** (`.floor` div) — the animated area with door + chef characters
3. **Chef Characters** — each `.chef` div has: `.chef-hat`, `.chef-face` (icon), `.chef-apron`, `.bubble` (thought on hover)
4. **Animations** — `@keyframes enter` (door entry), `@keyframes bounce` (cooking), `@keyframes pulse` (status dot)
5. **Token Bar** — `.token-bar` div showing input/output/cost
6. **Orders List** — `.orders` div with status dots (🟡 cooking, 🟢 served, 🔴 burnt)
7. **`refresh()` function** (bottom `<script>`) — fetches JSON state and rebuilds DOM every 2s

To modify: edit the HTML file, save, and the browser auto-picks up changes on next refresh cycle.

### Auto-Cleanup

- On `stop()` (when you exit the session), both the JSON and HTML files are deleted.
- On `start()`, any stale session files **older than 24 hours** with default `stall-` prefix are auto-deleted.
- If you want to **keep** a dashboard permanently, rename it (remove the `stall-` prefix) — e.g., `mv stall-abc123.html my-project-dashboard.html`.

### Multiple Terminals

Each terminal gets its own session ID and files. They don't clash. The main `index.html` (served via `/dashboard` HTTP) shows tabs for all active stalls. Or open individual `stall-{id}.html` files side by side.

### Source Code

- **State emitter**: `src/core/stall-monitor.js` — `StallMonitor` class
- **Dashboard HTML template**: `src/dashboard/index.html` — multi-stall overview
- **Per-session generator**: `StallMonitor.createSessionDashboard()` method
