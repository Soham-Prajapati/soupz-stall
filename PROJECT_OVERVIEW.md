# Soupz CLI — Master Project Overview (Updated: April 1, 2026)

## Documentation Routing (Read This First)

Use these files as canonical references for current runtime behavior and operations:

- System architecture (primary): [docs/architecture/SYSTEM_ARCHITECTURE.md](docs/architecture/SYSTEM_ARCHITECTURE.md)
- Runtime behavior: [docs/CURRENT_SYSTEM.md](docs/CURRENT_SYSTEM.md)
- Setup and troubleshooting: [docs/SETUP.md](docs/SETUP.md)
- Runtime deltas by date: [docs/RUNTIME_CHANGELOG.md](docs/RUNTIME_CHANGELOG.md)
- Model grading and routing transparency: [docs/guides/MODEL_SELECTION_AND_GRADING.md](docs/guides/MODEL_SELECTION_AND_GRADING.md)
- Owner launch checklist: [docs/guides/OWNER_ACTION_CHECKLIST.md](docs/guides/OWNER_ACTION_CHECKLIST.md)

For demos and technical reviews, start in this order:
1. [README.md](README.md)
2. [docs/architecture/SYSTEM_ARCHITECTURE.md](docs/architecture/SYSTEM_ARCHITECTURE.md)
3. [docs/SETUP.md](docs/SETUP.md)

This file remains a broad project compendium and includes historical/background sections.

## 0. Recently Shipped (March 2026)

- AI-first deep planning path added to daemon orchestration with fallback policy path retained for reliability.
- Deep planner controls exposed in Core Console:
  - planner toggle
  - planning profile
  - planner notes
- Interactive user-in-the-loop resume flow implemented:
  - orders can enter `waiting_input`
  - question answers can be submitted via `POST /api/orders/:id/input`
  - execution resumes after answers are received
- Core Console question UX behavior refined:
  - interactive question panel renders only when status is `waiting_input`
  - panel is displayed inside the `Output` area
  - keyboard navigation supports option movement plus question switching shortcuts
- Pairing and startup hardening:
  - `scripts/dev-web-stack.js` now continues when token bootstrap fails (local no-token fallback)
  - pairing validation retries support both `/pair/validate` and `/api/pair`
  - consumed active pairing code rotates immediately to avoid stale one-time code display


## 1. What Is This Project?
Soupz is a multi-agent orchestrator CLI plus a local daemon that bridges the AI coding CLIs already installed on your machine to a web dashboard. It has no model of its own: it shells out to `gemini`, `copilot`, `claude`, `codex`, and `kiro`, applies a persona system prompt, and streams their output back. The differentiators that hold up in the code are local PTY bridging, a keyword-scored router with an availability-aware fallback chain, and a run archive that persists prompts, events, and stdout for every order.

> **Accuracy note (2026-07-31).** This document is partly machine-generated and had
> drifted from the code. Corrected in this pass: plan decomposition is a flat
> `Promise.allSettled` fan-out, **not** a DAG (there is no topological ordering
> anywhere in `src/orchestrator/`); §5a previously listed 41 persona handles, 15 of
> which did not exist; token compression is string substitution, not AST-based; and
> the corrupted §5b deep dive was removed. `defaults/agents/` is the only source of
> truth for which personas are real.
>
> ⚠️ **Do not re-run `generate_project_overview.cjs`.** It regenerates this file from
> scratch and will discard every hand-written correction above, including this note.
> It also has two known bugs: it truncates persona descriptions mid-sentence, and it
> drops dependencies on name collision. Fix the generator before using it again.

## 2. The Metaphor System (Glossary)

| Metaphor Term | Real Technical Meaning | Where It Appears in Code |
|---|---|---|
| Stall / Kitchen | The core running CLI orchestrator session | `src/core/stall-monitor.js`, Dashboard UI |
| Chef | An AI Agent / Persona with a specific system prompt | `defaults/agents/*.md`, `src/agents/registry.js` |
| Pantry | The working memory (short-term) context storage | `src/core/context-pantry.js` |
| Stove | A running terminal / child process spawned by node-pty | `packages/mobile-ide/App.js`, `packages/remote-server/src/index.js` |
| Utensil | The specific LLM model used (e.g., gpt-4o-mini, gemini-2.5-pro) | `src/session.js` (Model switch logic) |
| Order / Ticket | A user prompt or decomposed sub-task | Dashboard UI (orders), Session commands |
| Recipe | Pre-built automated workflows or chained sequences | `src/session.js` (`/recipe` command) |
| Fleet | Hidden background CLI workers running in parallel | `src/session.js` (`spawnFleet` method) |
| Spill Mode | Unrestricted YOLO mode without confirmation bounds | `src/session.js` (`/spill` or `/yolo`) |

## 3. Full Tech Stack

| Category | Dependency | Version | Why It's Used Here |
|---|---|---|---|
| Frontend | `react` | 18.3.1 | Mobile IDE scaffold |
| Frontend | `react-dom` | ^18.3.1 | Dashboard UI dependencies |
| Frontend | `framer-motion` | ^11.0.0 | Dashboard UI dependencies |
| Frontend | `lucide-react` | ^0.400.0 | Dashboard UI dependencies |
| Frontend | `recharts` | ^2.12.0 | Dashboard UI dependencies |
| Frontend | `@types/react` | ^18.3.1 | Dashboard UI dependencies |
| Frontend | `@types/react-dom` | ^18.3.1 | Dashboard UI dependencies |
| Frontend | `@vitejs/plugin-react` | ^4.2.1 | Dashboard UI dependencies |
| Frontend | `tailwindcss` | ^3.4.1 | Dashboard UI dependencies |
| Frontend | `vite` | ^5.1.4 | Dashboard UI dependencies |
| Frontend | `@react-native-async-storage/async-storage` | 1.23.1 | Mobile IDE scaffold |
| Frontend | `@react-navigation/bottom-tabs` | ^7.0.0 | Mobile IDE scaffold |
| Frontend | `@react-navigation/native` | ^7.0.0 | Mobile IDE scaffold |
| Frontend | `expo` | ~52.0.0 | Mobile IDE scaffold |
| Frontend | `expo-asset` | ~11.0.5 | Mobile IDE scaffold |
| Frontend | `expo-status-bar` | ~2.0.1 | Mobile IDE scaffold |
| Frontend | `react-native` | 0.76.9 | Mobile IDE scaffold |
| Frontend | `react-native-safe-area-context` | 4.12.0 | Mobile IDE scaffold |
| Frontend | `react-native-screens` | ~4.4.0 | Mobile IDE scaffold |
| Backend | `express` | ^4.21.0 | WebSocket bridge server |
| Backend | `ws` | ^8.18.0 | WebSocket bridge server |
| Terminal | `chalk` | ^5.3.0 | Core CLI dependencies |
| Terminal | `conf` | ^13.0.1 | Core CLI dependencies |
| Terminal | `figlet` | ^1.8.0 | Core CLI dependencies |
| Terminal | `gradient-string` | ^3.0.0 | Core CLI dependencies |
| Terminal | `meow` | ^13.0.0 | Core CLI dependencies |
| Terminal | `node-pty` | ^1.2.0-beta.11 | WebSocket bridge server |
| Database | `@supabase/supabase-js` | ^2.98.0 | WebSocket bridge server |
| AI | `puppeteer-core` | ^24.37.5 | Used for autonomous browser tasks |
| DevTools | `tree-kill` | ^1.2.2 | General tooling |
| DevTools | `yaml` | ^2.6.1 | General tooling |
| DevTools | `clsx` | ^2.1.0 | General tooling |
| DevTools | `tailwind-merge` | ^2.2.0 | General tooling |
| DevTools | `autoprefixer` | ^10.4.17 | General tooling |
| DevTools | `postcss` | ^8.4.35 | General tooling |


## 4. Monorepo Structure

- `/` : Monorepo root.
- `bin/soupz.js` : The global executable entry point for the CLI.
- `src/` : The core CLI runtime engine.
  - `src/orchestrator/` : Handles routing and multi-agent plan decomposition (`router.js`, `semantic-router.js`).
  - `src/agents/` : Manages the child processes (`spawner.js`) and parses output (`parsers.js`).
  - `src/core/` : Contains tracking logic like `context-pantry.js`, `stall-monitor.js`, and `token-compressor.js`.
  - `src/memory/` : The SQLite-style persistent memory pool (`pool.js`).
  - `src/mcp/` : Model Context Protocol client implementation (`client.js`).
  - `src/session.js` : The primary REPL loop and user interaction handler.
- `packages/` : The independent workspaces.
  - `packages/dashboard/` : The React 18 / Vite mission control web UI.
  - `packages/remote-server/` : The Express / node-pty server that bridges the local terminal to the dashboard.
  - `packages/mobile-ide/` : (Scaffold) React Native Expo app for mobile monitoring.
  - `packages/browser-extension/` : (Scaffold) Chrome extension for DOM injection.
- `defaults/agents/` : The Markdown persona definitions. 44 `.md` files ship, of which **34 currently load** (5 CLI lanes + 29 specialists). Two are documentation (`SKILL_TEMPLATE.md`, `SKILL_ANALYSIS.md`) and eight have unterminated YAML frontmatter, so the loader silently skips them — see §5a.
- `docs/` : Documentation and knowledge base.

## 5. The Complete Chef Persona System

Routing policy note:
- Persona handles are dynamic by default: the runtime router picks the best available lane by task type, complexity, readiness, and cost policy.
- Provider personas (`@gemini`, `@codex`, `@copilot`, `@claude-code`, `@ollama`, `@kiro`) remain explicit when directly selected.
- Ollama is treated as a local low-cost lane for basic/reporting/check tasks; complex code generation should escalate to stronger coding lanes.

### 5a. Overview Table

Generated from `defaults/agents/*.md` on 2026-07-31. Only entries the loader actually parses are listed. The previous version of this table had 41 rows, 15 of which named personas that do not exist.

**CLI lanes** (5) — these wrap an installed binary:

| # | Name | Invoke Handle | Icon | Description |
|---|---|---|---|---|
| 1 | Claude Code | `@claude-code` | 🧠 | Claude Code CLI — complex reasoning, code generation, architecture, multi-file editing |
| 2 | Codex | `@codex` | C | Codex provider via GitHub Copilot CLI models (coding + refactoring + architecture) |
| 3 | GitHub Copilot | `@copilot` | 🐙 | GitHub Copilot CLI — coding, shell, GitHub. Models: gpt-5.1-codex-mini (free), gpt-5.4, claude-sonnet-4.6 |
| 4 | Gemini | `@gemini` | 🔮 | Google Gemini CLI — research, code generation, multi-modal analysis |
| 5 | Kiro | `@kiro` | ⚡ | Kiro AI CLI — spec-driven development, autonomous coding agent |

**Specialist personas** (29) — system prompts layered onto whichever CLI lane the router picks:

| # | Name | Invoke Handle | Icon | Core Specialty |
|---|---|---|---|---|
| 1 | Agent Builder (Shubh) | `@agent-builder` | 🔧 | Agent architecture specialist and SOUPZ compliance expert who creates robust, maintainable agents |
| 2 | Tech Architect | `@architect` | 🏗️ | CTO-level technical architect who plans for 50-person teams with production-grade systems |
| 3 | Brand Chef | `@brand-chef` | 🧑‍🍳 | Brand identity specialist — naming, messaging, positioning, voice & tone, visual direction |
| 4 | Content Writer | `@contentwriter` | ✍️ | Senior Content Strategist — marketing copy, blog posts, SEO optimization, social media, email campaigns, landing pages |
| 5 | Cost Optimizer | `@cost-optimizer` | 💰 | AI cost optimizer — token reduction, model tiering, language bridge (Mandarin), caching strategy |
| 6 | Data Scientist | `@datascientist` | 📈 | CRISP-DM, ML pipelines, statistical analysis, experiment design, data storytelling |
| 7 | Design Agency | `@designer` | 🎨 | World-class design agency — 8-phase brand engagement, Awwwards-quality HTML prototypes, 3-second clarity test. |
| 8 | DevOps Engineer | `@devops` | ⚙️ | Senior DevOps/SRE Engineer — Docker, Kubernetes, CI/CD, Terraform, cloud architecture, monitoring, incident response |
| 9 | Domain Scout | `@domain-scout` | 🗺️ | Maps competitive domains — classifies product space, finds direct/adjacent competitors, identifies whitespace |
| 10 | PS Evaluator | `@evaluator` | ⚖️ | Hackathon judging, feasibility scoring, competitive analysis |
| 11 | Finance Analyst | `@finance` | 📊 | CFA-level financial analyst — DCF models, unit economics, fundraising strategy, startup finance |
| 12 | Innovation Strategist | `@innovator` | 🚀 | Innovation Strategist — Blue Ocean Strategy, Jobs-to-be-Done, Business Model Canvas, disruption analysis, market creation |
| 13 | Legal Advisor | `@legal` | ⚖️ | Legal advisor — startup legal, contracts, privacy compliance (GDPR/CCPA), IP protection, SaaS agreements |
| 14 | Orchestrator | `@orchestrator` | 🎯 | Master orchestrator — breaks down complex tasks, delegates to specialist agents, coordinates multi-agent workflows like SOUPZ |
| 15 | Project Planner | `@planner` | 📋 | Senior Project Planner — sprint planning, task breakdown, parallel work coordination, dependency mapping, Gantt charts |
| 16 | Product Manager | `@pm` | 🎯 | Senior Product Manager — PRDs, roadmaps, RICE/MoSCoW prioritization, user research, OKRs, north star metrics, continuous discovery |
| 17 | Problem Solver | `@problemsolver` | 🧩 | TRIZ, 5 Whys, First Principles, Theory of Constraints, Systems Thinking — systematic problem-solving expert |
| 18 | Product Analyst | `@product-analyst` | 🔍 | Product analyst — metrics frameworks, cohort analysis, feature prioritization (RICE/Kano), KPI dashboards |
| 19 | QA Engineer | `@qa` | 🧪 | Principal QA Engineer — test strategies, edge case analysis, quality gates, test automation, accessibility, performance testing |
| 20 | Review Miner | `@review-miner` | ⛏️ | Mines user reviews from Reddit, X, App Store, Play Store — extracts real pain points & feature gaps |
| 21 | Security Engineer | `@security` | 🔒 | Security Engineer — threat modeling, OWASP Top 10, penetration testing, compliance (GDPR, SOC2, HIPAA), incident response |
| 22 | Storyteller | `@storyteller` | 📖 | Hero's Journey, narrative arcs, brand voice, copywriting |
| 23 | SVG Artist | `@svgart` | 🖼️ | SVG & CSS art generator — creates ready-to-import SVG files, icons, logos, illustrations, and UI assets |
| 24 | Teaching Assistant | `@teacher` | 📚 | Patient expert educator — Bloom's Taxonomy, Feynman Technique, scaffolded learning with examples and exercises |
| 25 | Team Lead | `@team-lead` | 👑 | Master coordinator that breaks complex projects into parallel streams and delegates to specialists simultaneously |
| 26 | Tech Writer | `@techwriter` | 📝 | READMEs, API docs, tutorials, changelogs, migration guides |
| 27 | Test Architect | `@tester` | 🔍 | Test strategy, automation frameworks, quality gates, CI/CD |
| 28 | UI Builder | `@ui-builder` | 🏗️ | Builds the actual HTML prototypes — GSAP animations, design systems, SVG assets, Awwwards-quality output |
| 29 | UX Designer (Nidhi) | `@ux-designer` | 🎯 | Senior UX designer specializing in user research, interaction design, and human-centered experience strategy |

**Files that ship but do not load** (8) — their YAML frontmatter is never closed, so `loadAgentDefinition()` returns null and they are skipped in silence: `ai-engineer.md`, `analyst.md`, `dev.md`, `growth-hacker.md`, `mobile-dev.md`, `presenter.md`, `researcher.md`, `strategist.md`. These handles are not invokable until the frontmatter is terminated.

**Not personas** — `SKILL_ANALYSIS.md`, `SKILL_TEMPLATE.md` are documentation that happens to live in this directory.


### 5b. Per-Persona Detail

This section previously held ~330 lines of per-persona "deep dive" emitted by
`generate_project_overview.cjs`. It has been removed rather than corrected, because
essentially none of it was load-bearing and much of it was wrong:

- It documented 41 personas, including 15 that do not exist in `defaults/agents/`.
- The "Specialty" lines were produced by a faulty regex in the generator and were
  truncated mid-sentence (e.g. `**Specialty**: The Stall`, `**Specialty**: Hero`).
- "System Prompt Logic", "Unique Behaviors / Flags" and "How It Differs From Similar
  Personas" were the same boilerplate string for every entry, carrying no information.
- "Example Use Case" was mechanically generated by lowercasing the description and
  appending "for the new auth feature".
- The heading itself ("ALL personas — do not skip any") was an instruction to the
  generating model that leaked into published prose.

**The authoritative description of any persona is its own file:** `defaults/agents/<id>.md`.
Each contains the real `name`, `description`, `routing_keywords`, `capabilities` and the full
`system_prompt`. Run `soupz-cli agents` to list the ones that currently load on your machine.

## 6. Core Systems — Deep Dive

### 6a. Hooks (Lifecycle)
- **Pre-task**: Intercepted in `src/orchestrator/router.js` (`routeAndRun`). Modifies the prompt via `token-compressor.js`, retrieves historical relevant context via `memoryPool.recall()`, and injects persona logic. Side effect: Context expands.
- **In-task**: Handled by `src/agents/spawner.js`. Spawns `child_process`, captures stdout/stderr, and emits real-time events to the REPL and `stall-monitor.js`. Side effect: Local state mutation and websocket broadcasting.
- **Post-task**: In `router.js`, invokes `_assessQualityAI` to grade the response. Updates the agent's grade in `registry.js`, stores the output trajectory in the `MemoryPool`, and records token usage via `cost-tracker.js`.

### 6b. ContextPantry
Defined in `src/core/context-pantry.js`. It operates as short-term working memory stored in `~/.soupz-cli/pantry/` as JSON. When the active context gets too large, old messages are pushed to the pantry. When new prompts arrive, it uses simple keyword matching to `recall(query)` and prepend relevant old chat blocks into the system prompt lifecycle before calling the LLM.

### 6c. MemoryPool
Defined in `src/memory/pool.js`. It provides episodic persistence using local JSON files in `~/.soupz-cli/memory-pool/`. It triggers a write on successful task completion, saving the prompt, agent, tags, and output. It reads automatically on new tasks, utilizing an AI-enhanced recall (via Copilot/Ollama) to extract relevant chunks to inject into the prompt, enabling cross-session learning. Evicts oldest banks automatically based on max limit.

### 6d. TokenCompressor
Defined in `src/core/token-compressor.js`. Employs three levels of compression (light, medium, aggressive). Triggers automatically on prompts over 30 chars. Drops filler words, normalizes whitespace, abbreviates common technical terms (e.g., 'configuration' to 'config'), and structurally restructures prompts into strict `[TASK] / [CTX] / [OUT]` machine-readable blocks. Uncompresses outputs (expanding abbreviations).

### 6e. AgentSpawner
Defined in `src/agents/spawner.js`. It uses standard `child_process.spawn` rather than full PTY internally to easily parse output via pipes, but the `remote-server` uses `node-pty` for dashboard integration. The spawner streams stdout line-by-line, passing it to `parsers.js` to extract clean text. On crash or non-zero exit, it emits an error event and penalizes the agent's grade.

### 6f. Grading System
Defined in `src/grading/scorer.js` and augmented by `router.js` (`_assessQualityAI`). Criteria include code block presence, length, and overlap with prompt vocabulary. Outputs a 1-5 or 0-100 score which adjusts the agent's lifetime grade. Layered grading uses Copilot `gpt-4o-mini` first, falling back to Ollama, and finally pure regex rules. A high failure rate lowers the grade, effectively demoting the agent from future automatic routing.

### 6g. Plan Mode / Task Decomposition
Flow starts in `src/session.js` where `getTaskComplexity()` analyzes the prompt. If complex (level 1 or 2), it calls `orchestrator.decompose(prompt)` in `router.js`.
1. `decompose()` uses Copilot/Ollama to return a JSON array of sub-tasks.
2. In `session.js` (`orchestrateMultiAgent`), it iterates over the sub-tasks, assigns each to the best agent via `pickAgentForTask()`.
3. Dispatches them via `Promise.allSettled` utilizing `orchestrator.runOn()`.
4. Outputs are aggregated and returned. Highly complex tasks spawn hidden background workers via `spawnFleet()`.

### 6h. MCP Client
Defined in `src/mcp/client.js`. Connects to external Model Context Protocol servers. It spawns the server process and establishes JSON-RPC communication via stdio. Features `register`, `connect`, `callTool`, and `allTools`. If an MCP server times out or crashes during initialization, it is safely unregistered and ignored, keeping the core orchestrator alive.

## 7. The 3-Layer Routing System

Defined in `src/orchestrator/semantic-router.js`.
- **Layer 1 (Copilot Claude/GPT AI)**: Triggered first (if enabled). Makes a smart LLM call to pick the optimal agent ID based on a stringified list of agent capabilities. Output is the exact agent ID.
- **Layer 2 (Local Ollama AI)**: Triggered if Copilot fails or mode is 'ollama'. Fast semantic matching using local `qwen2.5:1.5b`. Output is the exact agent ID.
- **Layer 3 (Rule-based Regex Fallback)**: Triggered if AI fails or is offline. Uses `semanticPatterns` matching keywords like 'ui', 'fix', 'deploy' to specific internal categories, adding numeric weights to available agents and picking the highest score.

```text
User Prompt -> [ 1. Copilot AI Routing (Smartest) ] --(Success)--> Execute
                     |
                 (Fail/Timeout)
                     |
                     v
               [ 2. Ollama Local AI (Fast) ] --(Success)--> Execute
                     |
                 (Fail/Timeout)
                     |
                     v
               [ 3. Regex / Keyword Rules ] --(Success)--> Execute
```

## 8. The Dashboard (packages/dashboard/)
A React 18 / Vite frontend representing the 'Kitchen Control Room'.
- **Components**: Timeline (shows events), Queue Panel, Lanes Panel (visualizing waiter, head-chef, dev-chef, design-chef states), Metrics (success rate, latency), Output Panel, and Changes Drawer (file diffs).
- **Connection**: It polls a REST API exposed by the `remote-server` (e.g., `/api/orders`, `/api/changes`) intervally (every 1.5 - 2.5s) to sync state. 
- **User Actions**: Submitting new orders, changing agent policies, toggling diff views, selecting active terminals.

## 9. The Remote Server (packages/remote-server/)
An Express / WebSocket bridge connecting the web dashboard to the local CLI environment.
- **Endpoints**: Exposes REST endpoints for orders and health checks.
- **WebSockets**: Streams terminal `stdout` via websockets and accepts user input to pipe directly into `node-pty` processes.
- **Auth Flow**: Uses a 6-8 digit OTP generated via `/cloud-kitchen`. The user enters the code on the web/mobile client, hitting `/pair/validate`, which returns a session token. Subsequent WS connections authenticate using this token.

## 10. Placeholder Packages — Honest Assessment

### `packages/mobile-ide/`
- **What code actually exists**: A functioning React Native (Expo) `App.js` with fully styled UI themes (Kitchen, Brutal, Skeuo, Neo, Glass). Contains logic for OTP pairing, WebSocket connection, and terminal emulation stripping ANSI codes.
- **What it's intended to do**: Act as a pocket command center to remote-control the desktop terminal and view active agents.
- **Exact gap**: Code is substantial but lacks deep file-system diff viewing and push notifications. It relies entirely on the `remote-server` being active and accessible over the network/tunnel.

### `packages/browser-extension/`
- **What code actually exists**: A Manifest V3 extension with `content.js` that highlights DOM elements, generates CSS selectors, and summarizes page stats. A basic `popup.html`.
- **What it's intended to do**: Allow agents to inspect live DOM, extract context, and modify UI visually.
- **Exact gap**: It is highly scaffolded but not fully integrated into the CLI's main agent execution loop. The bidirectional communication back to the CLI orchestrator to automatically feed DOM context is incomplete.

## 11. End-to-End Data Flow
1. **Input**: User types prompt in CLI (`src/session.js`).
2. **Analysis**: `getTaskComplexity()` determines if it's a simple task or complex plan.
3. **Routing**: `orchestrator.routeAndRun()` calls `semantic-router.js` to select the best persona/tool.
4. **Context Injection**: `context-pantry.js` and `pool.js` append historical memory to the prompt.
5. **Compression**: `token-compressor.js` minimizes the payload.
6. **Execution**: `spawner.js` launches the binary (e.g., `gh copilot`) with the persona's system prompt.
7. **Streaming**: Output is caught, stripped of ANSI (`parsers.js`), logged to the terminal, and broadcast via WS by `remote-server`.
8. **Persistence**: The result is graded (`scorer.js`) and saved to `MemoryPool`.
9. **UI Update**: `stall-monitor.js` updates state; the React Dashboard fetches and renders the new timeline.

## 12. Honest Feature Status

| Feature | Status | Notes |
|---|---|---|
| CLI REPL & Auto-completion | ✅ Working | Custom dropdown and fuzzy matching implemented. |
| Persona Injection | ✅ Working | 34 of the 44 shipped `.md` files load; the other 10 are skipped (see §5a). Prompts load correctly based on routing. |
| Semantic Routing (Rules) | ✅ Working | Keyword scoring plus an availability-aware fallback chain. Ollama is not a live lane. |
| Plan Mode / Task Decomposition | ✅ Working | Flat parallel fan-out via `Promise.allSettled` — no dependency graph, no topological ordering. |
| Context Pantry / Memory Pool | ✅ Working | File-system based short/long-term memory is active. |
| Token Compression | 🔧 Partial | Whitespace normalization and word substitution in `src/core/token-compressor.js`. Not AST-based — there is no parser involved. |
| Cloud Kitchen Bridge (OTP & WS) | ✅ Working | Express server establishes PTY and streams safely. |
| Web Dashboard UI | 🔧 Partial | UI exists, but relies on polling rather than full WS event pushes. |
| Mobile IDE | 🔧 Partial | RN App built, but network discovery relies on manual IP entry or `/tunnel`. |
| Browser Extension DOM Bridge | 📋 Planned | Scaffolded scripts exist, missing orchestrator integration. |
| MCP Integration | ✅ Working | `src/mcp/client.js` successfully connects and parses external tools. |

## 13. Top 5 Next Steps (Prioritized by Impact)
1. **Dashboard WebSocket Refactor**: Convert the polling mechanism in `packages/dashboard/src/App.jsx` to consume the WebSocket event stream from `remote-server` directly to lower latency. (Complexity: Low).
2. **Finish Browser Extension Bridge**: Wire the Chrome extension's `element_selected` message directly into the CLI's active session input buffer via a local HTTP endpoint. (Complexity: Medium).
3. **Enhance Fleet Status Observation**: Update `stall-monitor.js` to track granular stdout of background `/fleet` processes, making them visible in the dashboard timeline. (Complexity: Medium).
4. **Global Supabase Sync**: Connect `src/auth/user-auth.js` directly to the `MemoryPool` to backup/restore learned trajectories across devices. (Complexity: High).
5. **AST/WASM Agent Booster**: Implement a local execution path in `router.js` that completely bypasses LLMs for formatting tasks using local formatters (Prettier/ESLint) before making API calls. (Complexity: Medium).

---
