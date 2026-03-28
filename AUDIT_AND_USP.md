# Soupz - Brutally Honest Project Audit & USP Definition

**Date:** March 29, 2026
**Purpose:** Honest assessment of what works, what doesn't, what's real vs fake, and a defensible USP for pitching.

---

## Part 1: What Is Soupz, Actually?

Soupz is a **local-first AI agent orchestration daemon** with a **hosted web IDE** that lets you control your laptop's AI coding agents from any device (phone, tablet, another PC).

You run `npx soupz` on your machine. It starts a local server. You pair from any browser. You can then send prompts to CLI agents (Claude Code, Gemini CLI, Copilot CLI, Ollama, Kiro), edit files, use a terminal, and do git operations -- all from your phone.

---

## Part 2: Honest Feature Audit

### FULLY WORKING (Verified, Real Code)

| Feature | How It Works | Status |
|---------|-------------|--------|
| **Device Pairing** | 8-digit OTP code, QR code, 5-min expiry, auto-refresh | Production-ready |
| **Agent Spawning** | Spawns real CLI subprocesses (claude, gemini, gh, ollama) via `bin/soupz.js ask` | Working |
| **Agent Health Probing** | Actually runs test prompts against each agent, caches results 3 min | Working |
| **Agent Fallback Chain** | gemini -> copilot -> ollama -> claude-code | Working |
| **Real-Time Streaming** | WebSocket streaming of agent stdout/stderr to all authenticated clients | Working |
| **Chat Mode** | Full message history, agent selector, slash commands, skill system | Working |
| **Monaco Editor** | Real code editing with syntax highlighting, autosave to daemon | Working |
| **File Tree** | Real filesystem browsing via daemon API, filtered (no node_modules/.git) | Working |
| **File Read/Write** | Real file operations with path traversal prevention | Working |
| **Terminal** | node-pty, xterm-256color, bidirectional WebSocket streaming | Working |
| **Git Operations** | Real execSync: status, diff, stage, commit, push | Working |
| **Order Management** | Create, track, cancel orders with lifecycle events | Working |
| **Supabase Relay** | Async command queue for remote (non-LAN) connections | Working |
| **System Health** | Real CPU/memory/disk metrics broadcast every 5s | Working |
| **12 Color Themes** | CSS custom properties, runtime switchable | Working |
| **Smart Routing** | Keyword matching + daemon classify + Ollama fallback | Working |
| **Skills System** | 16 predefined prompt augmentation templates | Working |
| **Interactive Input** | Agent can ask clarifying questions, user responds, agent resumes | Working |
| **Landing Page** | Glassmorphism design, deployed at soupz.vercel.app | Working |

### PARTIALLY WORKING (Code Exists, Not Fully Integrated)

| Feature | Reality | What's Missing |
|---------|---------|----------------|
| **Parallel Workers (Deep Mode)** | Backend spawns multiple agent subprocesses in parallel with worker IDs | Works on backend. Frontend CoreConsole triggers it but UX is rough. No polished UI for viewing worker lanes. |
| **Nested Sub-Agents** | Backend can spawn 2-4 nested agents per worker | Synthesis step exists but tasks.md explicitly says "sub-agent synthesis does NOT feed back into main agent" |
| **AI Planner** | Backend supports planner controls (useAiPlanner, plannerStyle, plannerNotes) | UI exposes toggles but planner quality depends on agent used. Sometimes falls back to heuristics. |
| **TTS (Kokoro)** | 80MB WASM neural TTS model, lazy-loaded | Hook exists (`useKokoroTTS`) but NO UI buttons to trigger it. Dead code. |
| **STT (Speech-to-Text)** | Sarvam AI integration exists | Partially wired. Toggle exists but unreliable. |
| **Learning/Memory** | Tracks agent usage, applies learned weights to routing | Basic. localStorage only. Not sophisticated enough to matter. |

### FAKE / DECORATIVE / HARDCODED

| Feature | Reality |
|---------|---------|
| **41 "Specialists"** | NOT separate tools or agents. They are prompt templates injected before sending to the same CLI agent. "AI Engineer" specialist = gemini with a system prompt saying "you are an AI engineer." This is prompt engineering, not a real agent system. |
| **Extensions Marketplace** | Reads from Supabase table. "Installing" an extension just sets a localStorage flag. No real agent or tool is actually added. Pure UI theater. |
| **MCP Panel** | Configuration interface only. You can add MCP servers but there's no validation, no health checking, no proof they're running or being used. |
| **Agent Teams** | `lib/teams.js` defines 4 team templates (full-review, feature-build, ux-audit, ship-check). `executeTeam()` function exists. But it's NEVER CALLED from the UI. Completely disconnected. |
| **Sub-Agent UI** | `lib/teams.js` defines 8 sub-agents (code-reviewer, test-writer, etc). `executeSubAgent()` exists. Also never triggered from the main chat UI. |
| **Leaderboard** | Uses mock community data. Not connected to real Supabase profiles. |
| **Gamification/XP** | UI exists (StatsPanel) but XP/achievements are client-side only. No real persistence. |
| **Git Branch Display** | Hardcoded to "main". Cannot switch branches. |
| **File Execution** | `/api/exec` endpoint exists but the "Run" button integration is incomplete. |
| **Split Editor** | Not implemented despite being in FUTURE_PROMPTS.md. |

---

## Part 3: Critical Gaps

### Zero Tests
There are **0 test files** in the entire project. No jest, no vitest, no mocha. Nothing. A 193KB session.js file with zero test coverage is a liability, not an asset.

### Not Published to npm
`npx soupz` does not work for anyone outside your machine. The package has never been published. This means the entire "install with one command" pitch is currently fiction.

### No CI/CD
No GitHub Actions, no automated builds, no automated deploys (beyond Vercel auto-deploy for the dashboard). Manual `npm publish` only.

### Session/Auth Fragility
tasks.md explicitly marks "frequent logouts" as in-progress investigation. Session auto-refresh and daemon token persistence are not done. This means users will get randomly disconnected.

### 193KB session.js
One file with 3,572 lines of logic. This is a maintenance nightmare. Any bug in orchestration, agent spawning, or order management requires reading through a single massive file.

### Specialists Are Marketing, Not Engineering
Calling prompt templates "41 specialists" is misleading. If someone asks "how many agents can it orchestrate?", the honest answer is: **however many CLI agents the user has installed** (typically 2-3). The "specialists" just change the system prompt. This is table stakes for any LLM wrapper, not a differentiator.

---

## Part 4: The USP -- What's Actually Defensible

### What Soupz is NOT
- Not a VS Code replacement (missing: debugging, IntelliSense, extensions ecosystem, LSP, multi-cursor, Git branch management)
- Not an AI agent platform (not building agents, just wrapping existing CLIs)
- Not "swarm intelligence" (parallel workers exist but synthesis is broken)
- Not an "orchestration OS" (orchestration = prompt routing + subprocess management)

### What Soupz ACTUALLY IS (and this is genuinely interesting)

**Soupz is a remote bridge that lets you use your laptop's AI coding agents from your phone.**

That's the real USP. Nobody else does this well. Here's why it matters:

1. **You already have Claude Code / Gemini CLI / Copilot CLI on your laptop.** Soupz doesn't replace them. It makes them accessible from anywhere.
2. **The pairing flow is genuinely slick.** Run `npx soupz`, scan QR, you're connected. 30 seconds.
3. **Real file editing from your phone.** Monaco editor, git operations, terminal -- all proxied through your local machine.
4. **Local-first = private.** Your code never leaves your machine. The web app is just a remote control.
5. **Agent-agnostic.** Works with whatever CLI agents you have installed. Not locked to one vendor.

### One-Line Pitch
**"Control your laptop's AI coding tools from any device. Run `npx soupz`, scan a code, and you're in."**

### Why This Beats Alternatives
| Alternative | Why Soupz Wins |
|-------------|---------------|
| SSH into laptop | Soupz has a real IDE UI, not a raw terminal |
| VS Code Remote | Requires VS Code installed on client device. Soupz works from any browser, including phones |
| Claude.ai / ChatGPT web | Can't access your local filesystem, can't run your local agents, can't use your terminal |
| Cursor / Windsurf | Desktop-only. Can't use from phone. Single-agent. |
| Code-server | No AI agent integration. Just an editor. |

---

## Part 5: Pending Tasks -- Prioritized by Impact

### Must-Do Before Pitching (Showstoppers)

| # | Task | Why It's Blocking | Effort |
|---|------|-------------------|--------|
| 1 | **Publish to npm** | "npx soupz" doesn't work for anyone else. Your entire pitch relies on this. | 1 hour |
| 2 | **Fix session persistence** | Users get randomly logged out. Kills first impression. | 3-5 hours |
| 3 | **Remove fake features from UI** | If someone clicks "Extensions" or "Teams" and nothing works, trust is destroyed. Either make them work or hide them. | 2-4 hours |

### Should-Do for a Credible Demo

| # | Task | Why It Matters | Effort |
|---|------|---------------|--------|
| 4 | **Wire up agent teams in UI** | The backend orchestration code is real and impressive. It's just disconnected from the frontend. Connect `executeTeam()` to a UI trigger. | 4-6 hours |
| 5 | **Sub-agent synthesis** | The /fleet command runs parallel agents but doesn't synthesize results. This is the difference between "runs things in parallel" and "actually orchestrates." | 6-10 hours |
| 6 | **Mobile git panel** | If the pitch is "commit from your phone", the git UI needs to work well on mobile. | 4-6 hours |
| 7 | **Smart tier routing** | Respect free tier limits. Auto-fallback when Gemini/Copilot rate limits hit. | 4-6 hours |

### Nice-to-Have (Post-Pitch)

| # | Task | Notes |
|---|------|-------|
| 8 | Real leaderboard (Supabase profiles) | Only matters if building community |
| 9 | Split editor | Standard IDE feature, not urgent |
| 10 | TTS/STT integration in UI | Cool demo but not core value |
| 11 | Tests | Should happen but won't block a pitch |
| 12 | CI/CD pipeline | Important for reliability, not for pitching |

---

## Part 6: What's Realistic?

### Is This a Real Product?
**Yes, but it's a prototype.** The core flow (pair -> chat -> edit -> commit from phone) genuinely works. The daemon is solid engineering (4,575 lines of real backend code). The frontend is polished enough for demos.

### Can You Pitch This Today?
**Only as a live demo, not with claims about "41 specialists" or "agent swarms."** The moment someone asks "show me the swarm working" and you can't, credibility is gone.

### What Should You Pitch?
Pitch the **remote bridge** angle:
- "I built a tool that lets you use your laptop's AI coding agents from your phone"
- Live demo: run npx soupz on stage, scan QR from phone, send a prompt, watch Claude Code execute on laptop, commit from phone
- That demo alone is impressive and honest

### What Should You NOT Pitch?
- "41 AI specialists" (they're prompt templates)
- "Autonomous swarm intelligence" (parallel subprocess spawning != swarm intelligence)
- "Replaces VS Code" (missing 90% of VS Code features)
- "Agent orchestration OS" (it's a subprocess manager with a nice UI)

### Is This Venture-Scale?
**Probably not in current form.** The core value (remote bridge to local CLI agents) is useful but niche. The agents themselves (Claude Code, Gemini, Copilot) are owned by other companies and could add their own mobile interfaces at any time. The moat is thin.

**To make it venture-scale, you'd need one of:**
- A proprietary agent runtime (not just wrapping other CLIs)
- A collaboration layer (multiple people controlling the same machine)
- An enterprise story (fleet management, audit trails, compliance)
- A developer platform (other people building on Soupz)

---

## Part 7: Honest Strengths

Despite the harsh assessment above, here's what's genuinely impressive:

1. **The daemon is real engineering.** 4,575 lines of production backend code with WebSocket auth, order lifecycle management, PTY emulation, file operations, git integration, health monitoring, and Supabase relay. This is not a toy.

2. **The pairing flow is elegant.** OTP code generation, QR code, session management, auto-refresh -- this is a well-thought-out UX for device pairing.

3. **Deep mode parallel workers actually work.** The backend genuinely spawns multiple agent subprocesses in parallel, assigns specialist roles, and collects outputs. The infrastructure is there even if synthesis isn't complete.

4. **The frontend is polished.** 12 themes, Monaco editor, file tree, terminal, git panel, command palette, status bar -- it looks like a real IDE. For a project at this stage, the UI quality is high.

5. **The architecture is sound.** Local daemon + hosted web app + Supabase relay is a smart architecture for this use case. It correctly solves the "access local machine from anywhere" problem without requiring port forwarding or VPN setup.

---

## Part 8: Recommended Next Steps (In Order)

1. **npm publish** -- Takes 1 hour. Makes the product actually usable by others.
2. **Fix session persistence** -- Takes 3-5 hours. Prevents embarrassing disconnections during demos.
3. **Hide or disable unfinished features** -- Takes 2-4 hours. Don't show Extensions/Teams/Leaderboard unless they work.
4. **Record a 90-second demo video** -- The pairing flow + editing from phone is visually compelling.
5. **Wire up team orchestration to UI** -- Takes 4-6 hours. The backend code is done; this is mostly frontend wiring.
6. **Write 5 integration tests** -- Cover the critical paths: pairing, order creation, agent spawning, file read/write, WebSocket streaming.
7. **Pitch as "remote bridge for AI coding" not "AI orchestration OS"** -- Honest positioning that's still compelling.
