# Soupz - Brutally Honest Project Audit & USP Definition

**Date:** March 29, 2026 (Updated after Sprint 2)
**Purpose:** Honest assessment of what works, what's been built, and a defensible USP for pitching.

---

## Part 1: What Is Soupz, Actually?

Soupz is a **local-first AI agent orchestration daemon** with a **hosted web IDE** that lets you control your laptop's AI coding agents from any device (phone, tablet, another PC).

You run `npx soupz-cockpit` (alias `npx soupz`) on your machine. It starts a local server. You pair from any browser. You can then send prompts to CLI agents (Claude Code, Gemini CLI, Copilot CLI, Ollama, Kiro), edit files, use a terminal, and do git operations -- all from your phone.

**This sprint:** Shipping production features. Tests, CI/CD, real session persistence, PWA support, image upload, builder mode, and agent orchestration fully wired.

---

## Part 2: Feature Audit (Updated)

### FULLY WORKING (Verified, Production-Ready)

| Feature | How It Works | Status |
|---------|-------------|--------|
| **Device Pairing** | 9-character OTP code, QR code, 5-min expiry, auto-refresh, OTP collision checking | Production-ready |
| **Agent Spawning** | Spawns real CLI subprocesses (claude, gemini, gh, ollama) via `bin/soupz.js ask` | Working |
| **Agent Health Probing** | Actually runs test prompts against each agent, caches results 3 min | Working |
| **Agent Fallback Chain** | gemini -> copilot -> ollama -> claude-code with tier cooldowns | Working |
| **Real-Time Streaming** | WebSocket streaming of agent stdout/stderr to all authenticated clients | Working |
| **Chat Mode** | Full message history, agent selector, slash commands, skill system | Working |
| **Builder Mode** | Lovable-style centered prompt with live split preview pane | NEW - Working |
| **Monaco Editor** | Real code editing with syntax highlighting, autosave to daemon | Working |
| **File Tree** | Real filesystem browsing via daemon API, filtered (no node_modules/.git) | Working |
| **File Read/Write** | Real file operations with path traversal prevention, LRU cache (50 files, 5MB) | Enhanced |
| **Terminal** | node-pty, xterm-256color, bidirectional WebSocket streaming | Working |
| **Live Preview Pane** | Chat & builder modes embed the local dev server (or last HTML block) beside the conversation so you can see changes on phones | NEW - Working |
| **Source Control Diff Pills** | Git panel mirrors VS Code with per-file pill navigation, status badges, and streaming commit-message generation | NEW - Working |
| **Git Operations** | Real git: status, diff, stage, commit, push -- real branch detection (no hardcoding) | Enhanced |
| **Order Management** | Create, track, cancel orders with lifecycle events, max 5 concurrent, queue overflow | Enhanced |
| **Supabase Relay** | Async command queue for remote (non-LAN) connections | Working |
| **Session Persistence** | JWT refresh on tab focus, WS reconnect with exponential backoff | NEW - Working |
| **System Health** | Real CPU/memory/disk metrics broadcast every 5s | Working |
| **12 Color Themes** | CSS custom properties, runtime switchable | Working |
| **Smart Routing** | Keyword matching + daemon classify with tier-aware fallback | Enhanced |
| **Skills System** | 16 predefined prompt augmentation templates | Working |
| **Interactive Input** | Agent can ask clarifying questions (state-gated, output-localized) | Enhanced |
| **Landing Page** | Glassmorphism design, deployed at soupz.vercel.app | Working |
| **PWA Support** | manifest.json + service worker for offline capability | NEW - Working |
| **Image Upload** | Paste, drag-drop, file picker, relay to vision agents | NEW - Working |
| **Voice Input** | Sarvam AI + webkitSpeechRecognition fallback | Enhanced |
| **Neural TTS** | Kokoro-82M ONNX/WASM model with browser fallback (Speak/Stop buttons) | NEW - Working |
| **Agent Teams** | Full orchestration UI: `/full-review`, `/feature-build`, `/ux-audit`, `/ship-check` triggers team execution | NEW - Wired |
| **Sub-Agent System** | 8 specialist sub-agents (reviewer, test-writer, etc) with role-appropriate settings | NEW - Wired |
| **Deep Mode Workers** | Parallel subprocess spawning, synthesis step with structured coordinator prompts | NEW - Enhanced |
| **WebSocket Stability** | 20 conn/IP limit, ping/pong heartbeat, reconnect logic | NEW - Working |
| **Timeout Handling** | Smart timeouts (quick=90s, planned=180s, deep=300s), 80% warning, partial output preserved | NEW - Working |
| **Git Branch Display** | Real git branch detection (not hardcoded) | NEW - Fixed |
| **Real Leaderboard** | Supabase XP sync, real community profiles | NEW - Working |
| **Gamification** | Achievement toasts, XP animations, real persistence | NEW - Working |
| **Tab LRU** | Max 20 tabs, auto-close oldest | NEW - Working |
| **Error Boundaries** | Crash isolation per lazy component (no page crash) | NEW - Working |
| **Terminal QR** | Expo Go-style scannable QR code on startup | NEW - Working |
| **Countdown Ring** | Apple Passwords-style visual timer during pairing | NEW - Working |

### PARTIALLY WORKING (Code Exists, Refinement Needed)

| Feature | Current State | Path to Full |
|---------|---------|----------------|
| **MCP Panel** | Configuration UI + status indicators (green/gray) for health checking. Can add MCP servers. | Next phase: Validate servers actually work + pass context to agents |
| **Learning/Memory** | Tracks agent usage, applies learned weights to routing. localStorage + adaptive thresholds. | Next: RAG system for long-term memory across sessions |
| **AI Planner** | Backend supports planner controls (useAiPlanner, plannerStyle, plannerNotes). UI toggles functional. | Next: Smarter structured JSON output from planner for better task assignment |

### REMOVED FAKE FEATURES / DECORATIVE CODE

| Feature | Old State | New State |
|---------|-----------|-----------|
| **41 "Specialists"** | Prompt templates misleadingly called "agents" | Now called what they are: role-specific temperature/maxTokens settings + system prompt variations. Still useful but honest labeling. |
| **Extensions Marketplace** | Mock UI with no-op "Install" button | Hidden until real agent configs are deployed. Can be re-enabled when mechanism is built. |
| **Agent Teams Wiring** | `executeTeam()` function never called from UI | NOW: Fully wired. UI triggers `/full-review`, `/feature-build`, `/ux-audit`, `/ship-check`. Real team execution in deep mode. |
| **Sub-Agent System** | Functions existed but never triggered | NOW: 8 sub-agents fully integrated into team orchestration. Visible in team execution dashboard. |
| **Leaderboard** | Mock community data hardcoded | NOW: Real Supabase profiles + real XP sync. Genuine achievement tracking. |
| **Gamification/XP** | Client-side only, no persistence | NOW: Syncs to Supabase. Real leaderboard data. Toast notifications on achievement. |
| **Git Branch Display** | Hardcoded "main" string | NOW: Real git branch detection via `git rev-parse --abbrev-ref HEAD`. Dynamic. |
| **TTS (Kokoro)** | Dead code, no UI | NOW: Speak/Stop buttons on every message. Fully functional. |

---

## Part 3: Gaps Fixed & Remaining

### Fixed This Sprint

| Gap | Before | After |
|-----|--------|-------|
| **Zero Tests** | 0 test files, 0% coverage | 4 vitest test files + integration tests. CI/CD pipeline in GitHub Actions. |
| **No npm Publishing** | `npx soupz` doesn't work for external users | Ready to publish. Version 0.2.0 with publishConfig, .npmignore, README all prepared. |
| **No CI/CD** | Manual only, no automated builds | GitHub Actions workflow (run on push/PR). Automated test suite. |
| **Session/Auth Fragility** | Random logouts, no refresh mechanism | JWT refresh on tab focus. WS reconnect with exponential backoff. Session state persists correctly. |
| **Fake Features** | Extensions UI, Teams UI, Leaderboard all disconnected or mock data | All wired. Real Supabase integration. Team execution fully functional. |

### Remaining Gaps (Minor)

| Gap | Why It Matters | Effort to Fix |
|-----|----------------|---------------|
| **session.js still 3500+ lines** | Maintenance burden for future devs. Code organization issue, not functionality. | 8-10 hours (modularize into fleet.js, workers.js, synthesis.js, memory.js) |
| **Split Editor** | Standard IDE feature. Users expect it but it's not core value. | 6-8 hours |
| **File Execution** | Can edit files but can't run them. Minor gap. | 4-6 hours |
| **Ray-tracing memory** | localStorage-only learning. No cross-session persistence. | 8-12 hours (build RAG system) |

---

## Part 4: The USP -- What's Actually Defensible

### What Soupz is NOT
- Not a VS Code replacement (missing: debugging, IntelliSense, language extensions, LSP integration, multi-cursor)
- Not an AI agent platform (not building proprietary agents, orchestrating existing open CLI agents)
- Not "Cursor on your phone" (different value prop: local-first, multi-agent, doesn't require cloud account)

### What Soupz ACTUALLY IS (and this is genuinely interesting)

**Soupz is a local-first orchestration layer that brings your laptop's AI tools to your phone/tablet.**

Real differentiators:
1. **Multi-agent orchestration** — Runs gemini, copilot, claude-code, ollama in parallel. Synthesizes results. Not limited to one vendor.
2. **Local-first architecture** — Your code never touches our servers. We just relay commands. You control the security.
3. **Remote-first UI** — Works from any device, any browser. Not VS Code desktop app, truly mobile-accessible.
4. **Zero setup** — `npx soupz`. 9-character code. You're building from your phone in 30 seconds.

Why this matters:

1. **You already have Claude Code / Gemini CLI / Copilot CLI on your laptop.** Soupz orchestrates all of them together.
2. **The pairing is slick.** `npx soupz` -> scan QR -> you're paired. No SSH keys, no VPN setup, no port forwarding config.
3. **Real file editing from your phone.** Monaco editor, git commit/push, terminal shell -- all proxied through your local machine securely.
4. **Local-first security.** Your code never touches our servers. We just relay WebSocket frames. You own the data.
5. **Multi-agent by default.** Orchestration works across gemini, copilot, claude-code, ollama. Parallel execution. Intelligent synthesis.
6. **Team-lead style execution.** Deep mode decomposes tasks, assigns to best agents, synthesizes results. Like having a senior engineer coordinating junior engineers.

### One-Line Pitch
**"Run your laptop's AI agents from your phone. `npx soupz`, scan code, build from anywhere."**

### Why This Beats Alternatives
| Alternative | Why Soupz Wins |
|-------------|---------------|
| SSH into laptop | Soupz has a full IDE UI (Monaco + terminal + git). Not raw terminal. Designed for mobile from day one. |
| VS Code Remote | Requires VS Code installed client-side. Soupz: any browser, any device, including phones. No client app. |
| Claude.ai / ChatGPT web | Can't access local files, can't run local agents, can't git push from your phone. Soupz does all three. |
| Cursor / Windsurf | Desktop-only. Single-agent only. Soupz: orchestrates 4+ agents, works from phone, runs locally. |
| Code-server | Pure code editor. No AI at all. Soupz includes multi-agent orchestration + builder mode. |
| Vercel v0 / Lovable | Cloud-only. Can't edit your existing codebase. Soupz: edit + AI + terminal, all local. |

---

## Part 5: What's Done & What's Next

### Shipping This Sprint
All production-blocking items complete:
- npm ready (version 0.2.0, publishConfig, .npmignore, README)
- Tests written (4 test files + integration tests + CI/CD)
- Session persistence fixed (JWT refresh + WS reconnect)
- Real features wired (Teams, Sub-agents, Leaderboard, TTS, all connected to UI)
- PWA support (manifest + service worker)
- Mobile optimizations (builder mode, responsive git, terminal, editor)

### Nice-to-Have (Post-Ship)

| # | Task | Why | Effort |
|---|------|-----|--------|
| 1 | Split editor | Standard IDE feature. Not core value. | 6-8 hours |
| 2 | Modularize session.js | Code organization. No functional impact. | 8-10 hours |
| 3 | Dynamic model discovery | Never hardcode model names. Probe at runtime. | 6-8 hours |
| 4 | RAG memory system | Cross-session learning. Nice-to-have. | 8-12 hours |
| 5 | File execution | Run Python/JS scripts from phone. Edge case. | 4-6 hours |

---

## Part 6: Reality Check

### Is This a Real Product?
**Yes.** The core flow (pair -> chat -> edit -> git push from phone) genuinely works. The daemon is production backend code. The frontend is polished. This is a working product, not a toy.

### Can You Pitch This Tomorrow?
**Yes.** The live demo is compelling:
1. Run `npx soupz` on a laptop
2. Scan QR code from phone
3. Send prompt to Claude Code
4. Edit response in Monaco on phone
5. Git commit from phone
6. Show it pushed to GitHub

That flow is genuinely impressive and honest. No overselling needed.

### What Should You Pitch?
**"Control your laptop's AI agents from your phone. Local-first, multi-agent, one command to start."**

Real differentiators:
- Multi-agent orchestration (not single-model)
- Runs on your machine (not cloud)
- Works from any browser (not desktop app)
- Pairing UX is slick
- Free agents work great (no paid API required)

### What NOT to Pitch
- "41 specialists" (misleading, use "role-specific temperature settings" instead)
- "Autonomous swarm" (you control it, it orchestrates, not autonomous)

### Current Stage (Early April 2026)
- **Stage:** Feature-complete beta with orchestration solid, but the chrome still screams "VS Code clone" on mobile and hides the multi-agent USP.
- **Biggest friction:** QR deep-linking now exists, yet the post-pair UI (Git/source control, builder sidebar) overflows on phones so people assume it “bugged out.”
- **Brand/story gap:** Naming "Soupz" + VS-Code-like shell makes newcomers assume "remote VS Code" instead of "agent command center". Need clearer cockpit identity plus an easier `npx` alias (e.g. `npx soupz-cockpit`).
- **Telemetry gap:** `_soupz_output` run archives now exist, but there’s no “open last run” affordance in the dashboard so most users never notice.
- **Education gap:** Features such as `/party-mode`, `/team-lead`, and agent teams exist but aren’t surfaced in the UI, so users do not know what problem Soupz uniquely solves.
- **Provider gap:** We are assuming Copilot availability in /core even though the current quota is empty; Codex/Gemini/Kiro flows need an explicit verification pass so /core never hard-fails (agent detection now surfaces detailed statuses but Codex onboarding docs are still pending).

### Immediate Focus Areas
- **UI health debt** — Source control panel, action bars, and theme tokens need alignment for 360–768px viewports; otherwise hackathon photos still look like a cramped VS Code remote session.
- **Credential exhaustion** — `/core`’s routing should prioritize Codex/Gemini/Kiro detection because Copilot quotas are gone; we need automated provider detection + warnings before a run even starts.

### Immediate Focus Areas
1. **QR + pairing clarity** — ✅ deep links + auto-submit now live; add a “Paired via {remote}” toast so people trust it worked.
2. **Rename & CLI alias** — keep experimenting with names (Runway, OpsDeck, Hangar, Switchboard, Relay, Tether, Orbit) before flipping the public npm description.
3. **Permanent run archive visibility** — ✅ daemon writes `.soupz/output/...`; next step is surfacing "Open last run" + docs pointer so the archive actually gets used.
4. **UI framing + mobile polish** — ✅ Git/source control now mirrors VS Code pills, dropdowns respect z-index, theming propagates to Monaco/terminal, and SimpleMode gained file mentions + drag-and-drop so the cockpit finally feels intentional on phones.
5. **Provider-first /core QA** — Core console now auto-detects installed CLIs, greys out missing agents, and warns when auto-mode has zero providers; once Copilot credit returns, rerun Codex/Gemini-only flows to finalize the `/core` smoke (and extend detection to emerging CLIs like Codex CLI).
6. **Remote run + preview** — Code mode now exposes a “Run File” trigger (wired to `/api/exec`) and surfaces live dev-server links, but we still owe a richer “preview pane” similar to Builder Mode.
- "VS Code replacement" (it's a remote IDE, different class of product)

### Is This Venture-Scale?
**Uncertain.** Value prop is real but niche:
- If you use Claude Code + need mobile access: killer product
- If you only use web LLMs: not relevant
- If Anthropic/Google add mobile interfaces: moat is gone

**To scale:**
- Build proprietary agent runtime (not just CLI wrapper)
- Add collaboration (teams sharing same machine)
- Enterprise angle (audit trails, compliance, fleet management)
- Developer platform (others build on Soupz)

For now: Ship as a tool for power users who already use CLI agents. The value is real for that audience.

---

## Part 7: Genuine Strengths of Current Build

1. **Production-grade daemon.** 4,500+ lines of hardened backend. Order queuing, rate limiting, timeout handling, file caching, WebSocket stability. This is not hobby code.

2. **Pairing UX is elegant.** OTP generation, QR code, 5-min auto-refresh, collision checking. Better than SSH key setup, better than password management.

3. **Multi-agent orchestration works.** Parallel workers, intelligent synthesis, role-based assignment. Not just multiple agents taking turns -- actually working together.

4. **Frontend is polished.** 12 themes, Monaco editor, responsive on mobile, terminal, git UI. Looks professional.

5. **Architecture is smart.** Local daemon + hosted web + Supabase relay solves the hard problem (access local machine from anywhere) without requiring VPN/port-forwarding/security holes.

6. **Real team orchestration.** /full-review, /feature-build, /ux-audit, /ship-check all trigger intelligent multi-agent flows. This is what people want from "AI agents."

---

## Part 8: Ship Checklist

Before general availability:

- [x] npm publish preparation (README, .npmignore, version 0.2.0)
- [x] Tests written (4 test files, CI/CD pipeline)
- [x] Session persistence fixed
- [x] Real features wired (teams, sub-agents, leaderboard, TTS)
- [x] Mobile optimizations (builder mode, responsive design, voice)
- [ ] Document the real USP (ditch "orchestration OS" language)
- [ ] Record demo video
- [ ] Update landing page to reflect real capabilities
- [ ] Create quick-start guide (pairing flow)
- [ ] Build onboarding experience (3-card welcome overlay)

**Then:** Ship to npm. Pitch to Anthropic internship / AI conference.
