# Soupz Stall — Complete Project Reference

> **Who should read this:** External agents, interview prep, any collaborator who needs full technical context without repo access. This is the single canonical handoff document.

---

## Table of Contents

1. [What Is This Project](#1-what-is-this-project)
2. [Tech Stack](#2-tech-stack)
3. [Repository Structure](#3-repository-structure)
4. [Architecture](#4-architecture)
5. [Orchestration — How It All Works](#5-orchestration--how-it-all-works)
6. [Personas (Agent Specialists)](#6-personas-agent-specialists)
7. [What Is Already Built](#7-what-is-already-built)
8. [What Is Planned Next](#8-what-is-planned-next)
9. [How to Run Locally](#9-how-to-run-locally)
10. [Environment Variables](#10-environment-variables)
11. [API Reference](#11-api-reference)
12. [Database (Supabase)](#12-database-supabase)
13. [Deployment](#13-deployment)
14. [Agent Routing Logic (Deep Dive)](#14-agent-routing-logic-deep-dive)
15. [CLI Commands Reference](#15-cli-commands-reference)
16. [Visual Asset System](#16-visual-asset-system)
17. [Key Design Decisions](#17-key-design-decisions)
18. [Known Issues and Gaps](#18-known-issues-and-gaps)

---

## 1. What Is This Project

**Soupz Stall** is a web-first multi-agent orchestration platform.

It lets you submit a software task via a browser UI, automatically route it to the right specialist AI agent, watch it execute live in a dashboard timeline, and inspect outputs, file diffs, and execution metrics — all from a browser.

### The problem it solves

Most AI coding tools are a black box: you send a prompt and get a response. Soupz Stall makes the full execution pipeline observable:

- what prompt was sent
- which agent handled it, and why
- what model was used and at what cost tier
- what output streamed back
- what files changed
- whether it succeeded or failed

### Core metaphor

The product uses an **open food-stall yard** metaphor. Tasks are "orders", agents are "chefs", the pipeline is the "kitchen", and the dashboard is the "command center". This is intentional product language — it makes the complex workflow intuitive.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + Framer Motion + Tailwind |
| Backend | Node.js + Express + WebSocket (`ws`) |
| Terminal bridge | `node-pty` (PTY spawning) |
| Auth | OTP pairing codes + session tokens (crypto-based) |
| Database | Supabase (PostgreSQL) — optional persistence |
| Routing AI | GitHub Copilot CLI (`gh copilot --model claude-sonnet`) |
| Fallback routing | Ollama (local LLM, `qwen2.5:1.5b`) |
| Package manager | pnpm (preferred) / npm (fallback) |
| Monorepo | Native workspaces (no Turborepo/Nx) |
| Frontend deploy | Vercel |
| Backend deploy | Railway / Render (long-running Node process) |

---

## 3. Repository Structure

```
/
├── bin/
│   └── soupz.js              # CLI entrypoint
├── src/
│   ├── config.js             # Runtime config + persona detection
│   ├── session.js            # Session orchestration
│   ├── skills.js             # Agent skill definitions
│   ├── agents/
│   │   └── spawner.js        # Agent execution spawner
│   ├── auth/
│   │   └── user-auth.js      # Supabase user auth flow
│   ├── context/              # Context management
│   ├── core/
│   │   └── stall-monitor.js  # Live session monitor (HTML dashboard)
│   ├── grading/              # Output quality grading
│   ├── memory/               # Agent memory pool
│   ├── mcp/                  # MCP server integration
│   └── orchestrator/
│       ├── router.js         # Main routing logic
│       └── semantic-router.js # AI-powered semantic routing
├── packages/
│   ├── dashboard/            # Vite + React web dashboard
│   │   └── src/App.jsx       # Main dashboard UI
│   ├── remote-server/        # Node.js backend bridge
│   │   └── src/index.js      # Express + WebSocket + PTY server
│   ├── mobile-ide/           # Mobile IDE package (in progress)
│   └── browser-extension/   # Browser extension (in progress)
├── docs/
│   └── guides/               # All documentation lives here
├── supabase/
│   └── migrations/           # SQL migration files
├── _bmad-output/
│   └── planning-artifacts/   # Prompt packs and design specs
└── .env.example              # Environment variable template
```

---

## 4. Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Browser (Vercel)                    │
│                packages/dashboard                    │
│  - submit prompt                                     │
│  - view order queue + timeline                       │
│  - inspect output, diffs, metrics                    │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP + WebSocket
                       │ (auth: session token)
┌──────────────────────▼──────────────────────────────┐
│           Remote Server (Railway/Render)             │
│           packages/remote-server                     │
│  - OTP pairing + session token auth                  │
│  - order lifecycle management                        │
│  - spawns soupz CLI agents as child processes        │
│  - terminal bridge (node-pty over WebSocket)         │
│  - Supabase persistence (non-blocking)               │
└──────────────────────┬──────────────────────────────┘
                       │ child_process.spawn
┌──────────────────────▼──────────────────────────────┐
│             Soupz CLI Runtime (local)                │
│             bin/soupz.js + src/                      │
│  - semantic routing (Claude Sonnet → Ollama → rules) │
│  - agent execution (Copilot / Gemini / local)        │
│  - memory pool, context management                   │
│  - grading loop                                      │
└──────────────────────┬──────────────────────────────┘
                       │ upsert
┌──────────────────────▼──────────────────────────────┐
│                 Supabase (PostgreSQL)                │
│  - soupz_orders table                                │
│  - user auth (optional)                              │
└─────────────────────────────────────────────────────┘
```

### Auth flow

1. Remote server starts and auto-generates a one-time pairing code.
2. Dashboard (or CLI) calls `POST /pair` to get the code.
3. User (or launcher) calls `POST /pair/validate` with the code to get a session token.
4. All authenticated REST and WebSocket calls include `X-Soupz-Token` header.
5. Tokens expire after 24 hours. Codes expire after 5 minutes.

---

## 5. Orchestration — How It All Works

This is the core of the project. Understanding this explains everything else.

### The two execution paths

There are two distinct ways tasks flow through the system:

#### Path A: Web dashboard → Remote server → CLI agent (production path)

```
User types prompt in browser
        │
        ▼
POST /api/orders  (dashboard → remote-server)
        │
        ▼
Remote server resolves agent:
  - if agent = "auto" → use SOUPZ_WEB_AGENT env var (default: copilot)
  - if agent = named → use that agent directly
        │
        ▼
child_process.spawn(node, [bin/soupz.js, 'ask', agent, prompt])
        │
        ▼
CLI runtime starts, picks up routing
        │
        ├── Layer 1: gh copilot --model claude-sonnet  (AI routing)
        ├── Layer 2: Ollama qwen2.5:1.5b               (local AI fallback)
        └── Layer 3: Keyword regex rules               (offline fallback)
        │
        ▼
AgentSpawner.run(agentId, prompt)
        │
        ▼
spawn(agent.binary, agent.build_args)
  e.g. spawn('gh', ['copilot', '-p', prompt, '--allow-all-tools'])
  e.g. spawn('gemini', ['-p', prompt, '--output-format', 'stream-json'])
        │
        ▼
stdout/stderr streamed as events back to remote server
        │
        ▼
Remote server pushes events to order record
Supabase upsert on every state change (non-blocking)
        │
        ▼
Dashboard polls /api/orders/:id — shows real-time timeline
```

#### Path B: Direct CLI (local / developer path)

```
soupz> some task prompt
        │
        ▼
session.js processes the input
        │
        ▼
orchestrator.routeAndRun(prompt)
        │
        ├── Step 1: routeAI() — picks best headless agent (copilot / gemini)
        ├── Step 2: routePersonaAI() — picks best persona (chef) to inject system prompt
        ├── Step 3: optionally recalls relevant context from memoryPool
        ├── Step 4: optionally compresses prompt
        └── Step 5: spawner.run(agentId, processed_prompt)
        │
        ▼
Live output streamed to terminal via colored-output renderer
Grade updated after task completes (AI quality assessment)
Task stored in memoryPool for future context recall
```

### The orchestrator components

| Component | File | Role |
|---|---|---|
| `Orchestrator` | `src/orchestrator/router.js` | Top-level coordinator — wires all components together |
| `SemanticRouter` | `src/orchestrator/semantic-router.js` | AI-powered routing logic |
| `AgentSpawner` | `src/agents/spawner.js` | Actually spawns agent binaries as child processes |
| `AgentRegistry` | (loaded via `src/config.js`) | Loads and tracks all agent definitions from `~/.soupz-agents/agents/` |
| `ContextPantry` | `src/core/context-pantry.js` | Manages conversation context across tasks |
| `MemoryPool` | `src/memory/` | Stores/recalls task results for future context injection |
| `CostTracker` | `src/core/cost-tracker.js` | Tracks estimated token usage and cost per agent |
| `StallMonitor` | `src/core/stall-monitor.js` | Generates a live-refreshing HTML dashboard for CLI sessions |

### How routing picks the right agent (full detail)

```
prompt comes in
    │
    ▼
[1] Check for user preference override (memory-learned preferences)
    → if user has previously forced a specific agent for similar tasks, use that
    │
    ▼
[2] Check for manual forceAgent option
    → /station copilot or /delegate designer skips routing entirely
    │
    ▼
[3] _getEnginePreference(prompt)
    → asks Claude Sonnet: "is this UI/design or coding/backend?"
    → returns 'gemini' or 'copilot' as a hint
    │
    ▼
[4] _smartRoute(prompt, candidates)
    → Claude Sonnet: picks the single best agent ID from the registered list
    → if Claude Sonnet fails/times out → try Ollama
    → if Ollama fails → fall back to regex keyword scoring
    │
    ▼
[5] Merge engine preference into AI result
    → if AI picked generic copilot but engineHint says gemini → use gemini
    │
    ▼
[6] routePersonaAI(prompt) — separately picks best persona
    → same 3-layer AI pipeline but over the persona list
    → persona provides system_prompt injected before user message
    → only injected for non-headless agents (personas run on top of headless agents)
    │
    ▼
[7] Prompt processing pipeline
    → memoryPool.recall(prompt) — inject up to 3 relevant past task results
    → preprocessor.compress() — shorten prompt if too long
    → compressor.getOutputDirective() — add output format hints
    │
    ▼
[8] spawner.run(agentId, processedPrompt)
    → binary exists check
    → spawn process
    → stream stdout/stderr
    → parse output (agent-specific parser strips ANSI, JSON wrappers, etc.)
    │
    ▼
[9] Post-task
    → _assessQualityAI(result) — AI rates output quality 0-100
    → agent.grade updated (never goes below 0 or above 100)
    → memoryPool.store(task + result) — for future recall
    → costTracker.track(tokens estimated at 4 chars/token)
    → userAuth.recordEvent('task_complete')
```

### Execution modes

| Mode | Command | What it does |
|---|---|---|
| Single agent | `soupz ask copilot "prompt"` | Bypass routing, use specific agent |
| Auto-route | `soupz ask auto "prompt"` | Full AI routing pipeline |
| Chain | `/chain designer→researcher "prompt"` | Sequential agents, output of one feeds next |
| Parallel | `/parallel a b c "prompt"` | Same prompt sent to multiple agents simultaneously |
| Fleet | `/fleet "prompt"` | Hidden background workers (no terminal noise) |
| Hackathon | `/hackathon "prompt"` | Phased multi-agent plan with assignments |
| Party mode | `@bmad party "prompt"` | Fan-out to ALL agents simultaneously |
| Quick-dev | `@bmad quick-dev "prompt"` | Strict pipeline: architect → dev → qa |
| Delegate | `/delegate designer "prompt"` | Force a specific persona |

---

## 6. Personas (Agent Specialists)

Personas are **layered on top of headless agents**. They add a domain-specific system prompt that steers the underlying AI (Copilot, Gemini, etc.) to behave as a specialist.

A persona does not replace the agent binary — it wraps it with expert context.

### How personas work

```
Persona selected (e.g. "designer")
        │
        ▼
persona.system_prompt loaded from defaults/agents/designer.md
        │
        ▼
processed_prompt = persona.system_prompt + "\n\nUser: " + original_prompt
        │
        ▼
sent to the chosen headless agent (copilot or gemini)
```

Personas are defined as markdown files in `defaults/agents/` with YAML frontmatter:
```yaml
type: persona
uses_tool: auto    # 'auto' means pick whichever headless agent is available
headless: false    # personas are not directly spawnable — they wrap an agent
```

### All available personas

| Icon | Name | Invoke | Specialty |
|---|---|---|---|
| 🎨 | Design Agency | `@designer` | Award-worthy UI/UX, HTML prototypes, brand identity, design systems, SVG creation |
| 🖼️ | SVG Art | `@svgart` | SVG logos, icons, illustrations, animated SVG, CSS art |
| 🏗️ | Architect | `@architect` | System design, API design, database schemas, microservices, scalable patterns |
| 🔬 | Researcher | `@researcher` | Competitive intelligence, API/SDK evaluation, market analysis, technical research |
| 📋 | Planner | `@planner` | Roadmaps, sprint planning, epic/story breakdown, milestones |
| 🧠 | Strategist | `@strategist` | Business positioning, go-to-market, competitive advantage, investor narrative |
| 🎯 | Product Manager | `@pm` | PRDs, user personas, RICE/MoSCoW prioritization, MVP scope, OKRs |
| 🧪 | Tester | `@tester` | Test strategies, unit/e2e tests, edge cases, test automation |
| 🔧 | DevOps | `@devops` | Docker, CI/CD, Kubernetes, cloud infra, deployment pipelines |
| 🛡️ | Security | `@security` | Vulnerability analysis, auth flows, OWASP review |
| 📊 | Analyst | `@analyst` | Metrics, dashboards, SQL, product analytics |
| 🎤 | Presenter | `@presenter` | Hackathon pitches, investor decks, demo scripts |
| ✍️ | Content Writer | `@contentwriter` | Landing page copy, marketing content, brand voice |
| 📝 | Tech Writer | `@techwriter` | READMEs, API docs, developer guides |
| 💡 | Innovator | `@innovator` | Blue-sky thinking, novel approaches, creative problem-solving |
| 🌪️ | Brainstorm | `@brainstorm` | Rapid ideation, mind mapping, divergent thinking |
| 🏃 | Scrum | `@scrum` | Sprint planning, standups, retros, velocity tracking |
| 🎯 | Orchestrator | `@orchestrator` | BMAD-style task breakdown, agent coordination |
| 🏆 | Hackathon | `@hackathon` | Parallel multi-agent coordination, visual-impact-first mindset |
| ⚡ | BMAD | `@bmad` | Party mode (fan-out all) or quick-dev pipeline (architect→dev→qa) |
| ⚖️ | Evaluator | `@evaluator` | Hackathon problem analysis, feasibility scoring, judge criteria mapping |
| 👑 | Master | `@master` | Team lead — breaks complex projects into parallel streams |

### Headless execution agents (the actual binaries)

These are the real AI tools that get invoked. Personas wrap these.

| Icon | Name | Binary | Best at |
|---|---|---|---|
| 🐙 | GitHub Copilot | `gh copilot` | Coding, DevOps, shell, GitHub workflows |
| 🔮 | Google Gemini | `gemini` | Research, analysis, multi-modal, large context |
| 🤖 | Ollama | `ollama` | Local/offline routing only (not used for task execution) |

### Agent definition file format

Every agent/persona is a `.md` file with YAML frontmatter in `defaults/agents/` (shipped) or `~/.soupz-agents/agents/` (runtime copy):

```yaml
---
name: Researcher
id: researcher
icon: 🔬
type: persona        # 'persona' = specialist wrapper | omit = headless tool
uses_tool: auto      # which binary to wrap (auto = best available)
headless: false
capabilities:
  - research
  - competitive-intelligence
routing_keywords:
  - research
  - compare
  - API
  - market
grade: 82            # quality score 0-100, updated after each task
usage_count: 0
system_prompt: |
  You are a world-class research specialist...
---
Extended description or additional instructions here.
```

---

## 7. What Is Already Built

### Core CLI
- `bin/soupz.js` — fully working CLI entrypoint
- `ask [agent] [prompt]` — sends task to a named agent
- Agent routing via `src/orchestrator/router.js`
- Semantic routing via `gh copilot --model claude-sonnet`
- Fallback routing via Ollama (local LLM)
- Last-resort regex rule-based routing

### Remote Server (`packages/remote-server`)
- Express HTTP server on port 7533
- OTP pairing system with crypto-secure codes
- Session token auth middleware
- `POST /api/orders` — submit task, spawn CLI agent as child process
- `GET /api/orders` — list recent orders (in-memory, 100 max)
- `GET /api/orders/:id` — full order detail with event timeline and output
- `GET /api/changes` — git status of repo
- `GET /api/changes/diff?file=` — unified diff for a file
- WebSocket server with auth handshake
- PTY terminal bridge (create terminal, read/write via WebSocket)
- Supabase persistence adapter (non-blocking upsert on every order state change)
- System health endpoint (CPU, RAM, disk, swap)

### Web Dashboard (`packages/dashboard`)
- Prompt composer with agent selector + model policy picker
- Order submission via `POST /api/orders`
- Live order queue with polling
- Order detail timeline (event-by-event execution log)
- Output viewer (stdout/stderr)
- File changes drawer (git diff viewer)
- Remote URL + token connection panel (supports `?remote=&token=` query params)
- Env-configurable backend URL (`VITE_SOUPZ_REMOTE_URL`)
- Deployed to Vercel at: `https://dashboard-mu-two-44.vercel.app`

### Database
- Migration file: `supabase/migrations/20260316000100_soupz_orders_table.sql`
- `soupz_orders` table schema with all order fields
- Supabase CLI workflow documented

### Tooling
- `pnpm run setup` — installs all dependencies, creates `.env` from template
- `pnpm run dev:web:pnpm` — starts remote server + dashboard in one command
- Session monitor (`src/core/stall-monitor.js`) — auto-refreshing HTML dashboard for CLI sessions

---

## 8. What Is Planned Next

### High priority
- [ ] Deploy remote server to Railway (currently only runs locally)
- [ ] Set `VITE_SOUPZ_REMOTE_URL` in Vercel env once backend is hosted
- [ ] Make `GET /api/orders` DB-first (read from Supabase, fall back to memory)
- [ ] Upgrade dashboard timeline to WebSocket push instead of polling
- [ ] Add cost/token tracking panel to dashboard

### Medium priority
- [ ] Link Supabase project and run `supabase db push` to activate migration
- [ ] Add per-order token/cost/latency telemetry
- [ ] Model policy fallback chain (complexity routing: cheap model first, escalate on failure)
- [ ] Agent output grading loop

### Longer term
- [ ] Mobile IDE (`packages/mobile-ide`) — React Native app to control soupz from phone
- [ ] Browser extension (`packages/browser-extension`) — trigger agents from any browser tab
- [ ] Real-time event streaming to dashboard (Server-Sent Events or WebSocket order channel)
- [ ] Multi-user auth and session management

---

## 9. How to Run Locally

### First-time setup
```bash
pnpm run setup
```

This installs dependencies in root and all packages, and creates `.env` from `.env.example`.

### Start the full web stack
```bash
pnpm run dev:web:pnpm
```

What happens:
1. Remote server starts on `http://localhost:7533`
2. Waits for health check to pass
3. Generates a pairing code and exchanges it for a session token
4. Starts dashboard on `http://localhost:5173`
5. Opens browser with `?remote=http://localhost:7533&token=<token>` pre-filled

### Start just the backend
```bash
cd packages/remote-server && npm start
```

### Start just the frontend
```bash
cd packages/dashboard && npm run dev
```

---

## 10. Environment Variables

Copy `.env.example` to `.env` and fill in values.

### Core app user auth (optional)
```
SOUPZ_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SOUPZ_SUPABASE_KEY=YOUR_ANON_OR_PUBLISHABLE_KEY
```

### Remote server order persistence (optional)
```
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_SECRET_KEY
SOUPZ_SUPABASE_ORDERS_TABLE=soupz_orders
```

### Frontend (Vercel env)
```
VITE_SOUPZ_REMOTE_URL=https://YOUR_BACKEND_HOST
```

### Where to get Supabase keys
Supabase Dashboard → your project → **Settings → API**
- `SOUPZ_SUPABASE_KEY` = "Project API keys" → **anon / public** key
- `SUPABASE_SERVICE_ROLE_KEY` = "Project API keys" → **service_role** key ← keep this private, never expose in browser

---

## 11. API Reference

All authenticated endpoints require `X-Soupz-Token: <token>` header.

### Public endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/health` | System health (CPU, RAM, disk) |
| POST | `/pair` | Generate OTP pairing code |
| POST | `/pair/validate` | Exchange pairing code for session token |

### Authenticated endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/health/full` | Full health + session info |
| POST | `/api/orders` | Submit a task — spawns CLI agent |
| GET | `/api/orders` | List recent orders (latest 100) |
| GET | `/api/orders/:id` | Order detail: timeline events, stdout, stderr |
| GET | `/api/changes` | Git status (changed files) |
| GET | `/api/changes/diff?file=` | Unified diff for one file |
| GET | `/terminals` | List active PTY terminals |
| POST | `/terminal` | Create new PTY terminal |
| POST | `/logout` | Revoke current session |

### Order lifecycle events (event timeline)
```
order.created      → task submitted
route.selected     → agent and model chosen
chef.started       → CLI process spawned
chef.output.delta  → stdout/stderr chunk received
order.completed    → process exited with code 0
order.failed       → process exited with non-zero code or error
```

### POST /api/orders request body
```json
{
  "prompt": "Build a REST endpoint for user registration",
  "agent": "auto",
  "modelPolicy": "balanced"
}
```

`agent` options: `auto`, `copilot`, `gemini`, any named persona (e.g. `soupz-dev`)  
`modelPolicy` options: `fast`, `balanced`, `quality`

---

## 12. Database (Supabase)

### soupz_orders table schema
```sql
id              TEXT PRIMARY KEY
prompt          TEXT
agent           TEXT
run_agent       TEXT
model_policy    TEXT
status          TEXT  -- queued | running | completed | failed
created_at      TIMESTAMPTZ
started_at      TIMESTAMPTZ
finished_at     TIMESTAMPTZ
duration_ms     INTEGER
exit_code       INTEGER
stdout          TEXT
stderr          TEXT
events          JSONB
```

### Migration
```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

Migration file: `supabase/migrations/20260316000100_soupz_orders_table.sql`

---

## 13. Deployment

### Frontend (currently live)
- Platform: Vercel
- Config: `packages/dashboard/vercel.json`
- Live URL: `https://dashboard-mu-two-44.vercel.app`
- Deploy command: `cd packages/dashboard && vercel --prod`
- Required env: `VITE_SOUPZ_REMOTE_URL` (set in Vercel project settings once backend is hosted)

### Backend (not yet cloud-hosted)
- Platform: Railway or Render (recommended — supports long-running Node + WebSockets + PTY)
- Why not Vercel: backend uses `node-pty` terminal spawning, persistent WebSocket connections, and in-memory state — not compatible with serverless functions
- Dockerfile: `packages/remote-server/Dockerfile` (available for Railway deployment)
- Required env on Railway: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SOUPZ_SUPABASE_ORDERS_TABLE`

---

## 14. Agent Routing Logic (Deep Dive)

### Three-layer routing pipeline

```
User prompt
    │
    ▼
Layer 1: Copilot AI (gh copilot --model claude-sonnet)
    │ (if available and responds within 30s)
    ▼
Layer 2: Ollama (local LLM, qwen2.5:1.5b)
    │ (if running locally and model loaded)
    ▼
Layer 3: Regex rules
    (design/styling → gemini, coding/debug → copilot, etc.)
```

### Routing mode (set via env)
```
SOUPZ_ROUTER=copilot   # default — Claude Sonnet first
SOUPZ_ROUTER=ollama    # Ollama first
SOUPZ_ROUTER=auto      # try both layers
```

### Available agent types
- `soupz-dev` — code implementation, bug fixes
- `soupz-designer` — UI/UX, CSS, visual design
- `soupz-architect` — system design, API design
- `soupz-researcher` — analysis, comparisons, research
- `soupz-planner` — roadmaps, sprint plans
- `soupz-bmad` — orchestration (fan-out to all agents, or architect→dev→qa pipeline)
- `copilot` — default GitHub Copilot
- `gemini` — Google Gemini for design/visual tasks

---

## 15. CLI Commands Reference

The CLI session (`soupz>` REPL) uses food-stall metaphor for all commands.

### Cooking (core actions)
| Command | Description |
|---|---|
| `/kitchen` | List all AI agents (cooking stations) |
| `/chefs` | List all personas (specialist chefs) |
| `/station copilot` | Switch to a specific agent |
| `/utensil <model>` | Switch AI model |
| `/auto` | Full auto — AI picks best agent + persona |
| `/delegate designer "prompt"` | Force a specific persona |
| `/chain designer→researcher "prompt"` | Sequential agent pipeline |
| `/parallel a b c "prompt"` | Same prompt to multiple agents in parallel |
| `/fleet "prompt"` | Background parallel workers |
| `/hackathon "prompt"` | Phased multi-agent hackathon plan |

### Tasks and tracking
| Command | Description |
|---|---|
| `/todo` | Show task list |
| `/do 1` | Execute todo item #1 |
| `/tokens` | Token usage stats |
| `/costs` | Cost tracking per agent |
| `/grades` | Quality scores per agent |

### Session
| Command | Description |
|---|---|
| `/rename` | Name current session |
| `/sessions` | List saved sessions |
| `/load` | Reload a previous session |
| `/clear` | Reset context |

### Remote and monitoring
| Command | Description |
|---|---|
| `/cloud-kitchen` | Start the remote access server |
| `/tunnel` | Expose server publicly (ngrok-style) |
| `/dashboard` | Open live stall monitor in browser |

### Memory and storage
| Command | Description |
|---|---|
| `/memory` | Memory stats |
| `/stock` | Store/recall items |
| `/compress` | Token compression stats |

---

## 16. Visual Asset System

A pixel-art visual UI system is being developed to replace standard dashboard components with a food-stall yard aesthetic.

### Asset themes
- **Theme A (production):** strict top-down pixel art, solid `#00FF00` chroma background for extraction
- **Theme B (experimental):** isometric perspective, isolated under `images/experimental/`

### Naming convention
```
[mode]-[family]-[asset]-[variant]-v[major].[minor].png

Examples:
  td-stall-burger-shell-day-v1.0.png
  td-workspace-fry-main-v1.1.png
  td-sprite-fry-cook-peak-v1.0.png
```

### Asset tracking
- Human checklist: `dashpad.md`
- Machine manifest: `images/manifest.json`

### Prompt pack
All image generation prompts: `_bmad-output/planning-artifacts/kitchen-ui-component-prompt-pack.md`

---

## 17. Key Design Decisions

### Why local-first
The runtime executes on the developer's machine so it can read/write the actual codebase. A cloud-only model would need repo access via APIs, adding latency and security surface. Local-first is safer and faster for the current use case.

### Why OTP pairing
Avoids static API keys for local→browser auth. Codes expire in 5 minutes. Tokens expire in 24 hours. Simple and secure for the single-developer use case.

### Why in-memory + Supabase (not just DB)
In-memory state means zero latency reads and the runtime works without any database. Supabase is layered on top as an optional persistence store. Writes are non-blocking so a DB outage never fails an order.

### Why node-pty
Gives real terminal emulation (not just process output). Needed for interactive CLI tools, full ANSI escape sequences, and terminal-aware programs that detect TTY.

### Naming: Stall vs Kitchen
- **Stall** = user-facing product language
- **Kitchen** = internal implementation shorthand
Both coexist, but UI labels and user docs should use stall-first language.

---

## 18. Known Issues and Gaps

| Issue | Status |
|---|---|
| Backend not cloud-hosted | Pending Railway deploy |
| Frontend deployed but points to localhost by default | Fixed once backend is hosted |
| Orders GET is in-memory only (resets on server restart) | Planned: DB-first read |
| Dashboard uses polling not push | Planned: WebSocket order channel |
| Supabase migration not yet pushed to cloud | Needs `supabase link` + `supabase db push` |
| Mobile IDE package is a scaffold only | In progress |
| Browser extension package is a scaffold only | In progress |

---

*Last updated: 2026-03-16*
