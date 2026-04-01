# Soupz System Architecture

Last updated: April 1, 2026
Status: Runtime-accurate reference for demos, debugging, and production hardening.

## 1. Purpose

This document explains how Soupz works in production terms:
- how requests move from browser to local daemon and back
- where pairing/auth happens
- where orchestration decisions are made
- where failures happen and how they are handled

Use this file as the primary architecture reference.

## 2. High-level Topology

```text
Browser UI (Dashboard)
    -> Pair code + token -> Local Daemon (Express + WS)
    -> Realtime relay path -> Supabase Realtime -> Local Daemon

Local Daemon
    -> Order Router + Orchestration -> CLI Agents (Gemini/Codex/Copilot/Claude/Ollama/Kiro)
    -> Workspace APIs (FS/Git/Terminal) -> Local Project Files
```

## 3. Runtime Components

| Layer | Component | Responsibility | Primary Path |
|---|---|---|---|
| UI | Dashboard (React + Vite) | Chat, IDE, setup, docs, pairing, status | packages/dashboard/src |
| Daemon API | Express server | Pairing, order lifecycle, file/git/terminal APIs | packages/remote-server/src/index.js |
| Daemon transport | WebSocket server | Agent stream chunks + order updates | packages/remote-server/src/index.js |
| Orchestration | Routing + deep/team logic | Agent selection, fallback, synthesis | packages/remote-server/src/shared.js, packages/remote-server/src/orders.js |
| Providers | Local CLIs | Execute actual model/tool work | gemini, gh copilot, claude, ollama, kiro-cli |
| Relay | Supabase Realtime | Remote command transport and pairing storage | packages/dashboard/src/lib/daemon.js, packages/remote-server/src/shared.js |

## 4. Request Lifecycle (Prompt -> Output)

```text
User -> Dashboard UI: submit prompt
Dashboard UI -> Daemon API: POST /api/orders
Daemon API -> Order Engine: create order + select run agent
Order Engine -> Provider CLI: spawn process
Provider CLI -> Order Engine: stdout/stderr chunks
Order Engine -> Dashboard UI: websocket chunks + order updates
Dashboard UI -> User: streamed output + final status
```

## 5. Pairing and Auth Flow

1. User runs `npx soupz-cockpit` (alias `npx soupz`).
2. Daemon creates one-time pairing code and a connect URL.
3. QR/deep-link opens hosted app at `/code?code=...&remote=...`.
4. Browser validates the code via daemon (`/api/pair` or `/pair/validate`).
5. Session token is stored and reused for API + WS auth.

Key files:
- packages/remote-server/src/pairing.js
- packages/dashboard/src/components/connect/ConnectPage.jsx
- packages/dashboard/src/lib/daemon.js

## 6. Agent Selection and Fallback

Routing order is availability-aware and prompt-aware. Codex is first-class in code-heavy lanes.

Default free-first fallback chain:
- gemini -> codex -> copilot -> ollama -> claude-code

Guardrails:
- runtime readiness checks before execution
- binary missing fallback
- instant-crash fallback
- cooldown behavior on provider limits

Key files:
- packages/dashboard/src/lib/routing.js
- packages/remote-server/src/shared.js
- packages/remote-server/src/orders.js

## 7. Data Boundaries and Security

Principles:
- local-first execution for workspace access and CLI runs
- auth token required for protected daemon routes (except local dev and selected pairing endpoints)
- path traversal protections in filesystem APIs
- command input sanitization for git/exec-sensitive endpoints

Known boundary:
- dashboard can relay via Supabase for remote reachability, but execution still occurs on user machine.

## 8. Operational Reliability

Implemented hardening:
- WebSocket connection limits + heartbeat
- order queue and concurrency limits
- per-order runtime tracking and cleanup
- startup discovery deferral for test/silent contexts
- daemon status notifications in UI

Still required for market-ready posture:
- browser E2E coverage for pairing + prompt roundtrip + provider readiness
- structured error taxonomy for UI-readable remediation
- stronger mobile visual regression tests

## 9. Production Release Gates

Minimum gate before deploy:
1. `cd packages/dashboard && npm run build`
2. `npm test`
3. `node --check packages/remote-server/src/index.js`
4. verify pairing on hosted `/code` path from real mobile camera scan
5. smoke test: prompt -> stream -> file edit -> git action

## 10. Canonical API Groups

| Group | Representative Endpoints |
|---|---|
| Health/system | /health, /health/full, /api/system/check-clis |
| Pairing | /pair, /pair/current, /pair/validate, /api/pair |
| Routing | /api/classify, /api/routing/explain |
| Models | /api/models, /api/models/refresh |
| Orders | /api/orders, /api/orders/:id, /api/orders/:id/cancel, /api/orders/:id/input |
| Filesystem | /api/fs/tree, /api/fs/file, /api/fs/dirs, /api/fs/roots |
| Git | /api/changes, /api/changes/diff, /api/git/* |
| Runtime helpers | /api/dev-server, /terminals |

## 11. File Ownership Map (Practical)

| Domain | Primary Files |
|---|---|
| Pairing/deep links | packages/remote-server/src/pairing.js, packages/dashboard/src/components/connect/ConnectPage.jsx |
| App routing | packages/dashboard/src/App.jsx |
| Agent definitions | packages/dashboard/src/lib/agents.js, defaults/agents/*.md |
| Routing logic | packages/dashboard/src/lib/routing.js, packages/remote-server/src/shared.js |
| Order execution | packages/remote-server/src/orders.js |
| Setup UX | packages/dashboard/src/components/shared/SetupWizard.jsx |
| Docs site | packages/dashboard/src/components/docs/DocsPage.jsx, packages/dashboard/public/docs/*.md |

## 12. Decision: VS Code-like or Custom Cockpit?

Recommended direction:
- keep VS Code familiarity for power operations (editor, git, terminal)
- differentiate with clear "Cockpit" shell in Chat/Builder/Orchestration surfaces
- prioritize mobile-first command center behavior over desktop mimicry

Practical split:
- Code mode: VS Code-like
- Chat/Builder/Teams: product-distinct cockpit UI

This hybrid path keeps usability while creating a defensible product identity.
