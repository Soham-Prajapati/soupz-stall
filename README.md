# Soupz Stall

[![Deploy with Vercel](https://vercel.com/button)](https://dashboard-mu-two-44.vercel.app)

Local-first multi-agent orchestration for coding workflows.

Soupz runs a local daemon on your machine and provides a web UI for orchestrating agent work, deep parallel runs, and interactive resume flows.

## What You Get

- Dashboard UI for running and observing agents
- Local daemon for command execution, orchestration, file and git operations
- Deep orchestration with parallel workers and synthesis
- Optional AI planner controls for deep mode
- Interactive clarification and resume flow for long-running tasks

## Current Runtime Highlights (March 2026)

- Deep planner controls:
  - `useAiPlanner`
  - `plannerStyle`
  - `plannerNotes`
- Interactive deep-run pause and resume:
  - order can enter `waiting_input`
  - answers submitted via `POST /api/orders/:id/input`
  - order resumes after input
- Core Console behavior:
  - planner options are collapsible
  - interactive question panel appears only when required
  - interactive question panel is rendered in the Output section
- Startup and pairing resilience:
  - `npm run dev:web` continues in local mode when bootstrap token creation fails
  - pairing compatibility checks include `/pair/validate` and `/api/pair`
  - consumed active pairing code rotates immediately

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Start full stack (daemon + dashboard):

```bash
npm run dev:web
```

3. If runtime or UI appears stale:

```bash
# stop current process with Ctrl+C
npm run dev:web
# hard refresh browser: Cmd+Shift+R
```

## Common Commands

```bash
# Full stack dev
npm run dev:web

# Dashboard only
cd packages/dashboard && npm run dev

# Dashboard production build
cd packages/dashboard && npm run build

# Daemon only
npx soupz
```

## Canonical Documentation

Use these files as source of truth:

1. Current runtime behavior: [docs/CURRENT_SYSTEM.md](docs/CURRENT_SYSTEM.md)
2. Setup and troubleshooting: [docs/SETUP.md](docs/SETUP.md)
3. Runtime changelog: [docs/RUNTIME_CHANGELOG.md](docs/RUNTIME_CHANGELOG.md)
4. Docs index: [docs/README.md](docs/README.md)
5. Team runtime reference: [CLAUDE.md](CLAUDE.md)

## Repository Structure (Key Paths)

```text
packages/dashboard/          Web UI
packages/remote-server/      Local daemon
scripts/dev-web-stack.js     Dev stack launcher
defaults/agents/             Agent definitions
src/                         Core runtime modules
```

## Historical and Deep Reference

The previous long-form persona and architecture deep dive has been intentionally moved out of the front page.

Use:

- [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md)
- [docs/guides](docs/guides)
- [defaults/agents](defaults/agents)
