# Soupz Architecture

## 1) Runtime Topology

Soupz is a local-first system with a hosted control UI:

- Dashboard: React + Vite web client (browser/phone)
- Daemon: Express + WebSocket server (runs on user machine)
- Relay: Supabase Realtime bridge (for remote transport)
- Providers: Gemini, Codex/Copilot, Claude Code, Kiro

```text
Dashboard UI -> Daemon API
Dashboard UI -> Supabase Realtime -> Daemon API
Daemon API -> Order Router -> CLI Agent Process
Daemon API -> Filesystem/Git/Terminal APIs -> Workspace Root
CLI Agent Process -> Order Events -> WebSocket Stream -> Dashboard UI
```

## 2) Prompt Lifecycle

1. User submits prompt in dashboard.
2. Dashboard calls `POST /api/orders`.
3. Daemon selects run agent and spawns provider process.
4. Provider output is streamed through WebSocket chunk events.
5. Dashboard renders live chunks, status updates, and final state.

## 3) Pairing and Session Bootstrapping

- Daemon generates one-time 9-character pairing code.
- QR/deep-link points to hosted connect route: `/code?code=...&remote=...`.
- Browser validates code (`/api/pair` or `/pair/validate`) and stores token.
- Token is reused for daemon REST + WS auth.

## 4) Reliability Layers

- provider readiness checks (installed + runtime ready)
- fallback chain for provider errors/crashes
- queueing + concurrency control for orders
- websocket heartbeat and connection controls
- startup-time model discovery deferral to avoid starvation

## 5) API Surface (Core)

| Group | Endpoints |
|---|---|
| Health | `/health`, `/health/full` |
| Pairing | `/pair`, `/pair/current`, `/pair/validate`, `/api/pair` |
| Orders | `/api/orders`, `/api/orders/:id`, `/api/orders/:id/cancel`, `/api/orders/:id/input` |
| Routing | `/api/classify`, `/api/routing/explain` |
| Filesystem | `/api/fs/tree`, `/api/fs/file`, `/api/fs/dirs`, `/api/fs/roots` |
| Git | `/api/changes`, `/api/changes/diff`, `/api/git/*` |
| Runtime | `/api/dev-server`, `/terminals` |

## 6) Context-Hub Pattern (Planned v1)

Use `.soupz/CONTEXT.md` as a shared context artifact for long-running complex tasks.

```text
Worker Agent -> Context Queue: submit focused question
Context Queue -> Gemini Context Lane: dispatch unresolved question
Gemini Context Lane -> .soupz/CONTEXT.md: append answer + citation
Coordinator -> .soupz/CONTEXT.md: read stabilized context snapshot
Coordinator -> Worker Agent: send execution update
```

Guardrails for v1:
- single owner per question
- dedupe keys + retry limits
- stale-answer expiry
- hard timeout for unresolved context
