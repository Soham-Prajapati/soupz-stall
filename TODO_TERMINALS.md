# Soupz Production Sprint -- Terminal Tasks

**How to use:** Open terminals. In each, run Claude Code and say:
- "Read TODO_TERMINALS.md. I am Terminal [N]. Start working on my tasks."

Each terminal has its own non-overlapping set of files. They will NOT clash.
Read `CLAUDE.md` first for project conventions and architecture.

**Model guidance:** Use `sonnet` (default) for tasks requiring understanding large files (3000+ lines). Use `haiku` only for straightforward implementation with clear code snippets provided.

---

## TERMINAL 1: COMPLETED

All 8 backend tasks done:
- [x] T1-2: Fleet synthesis fix in session.js (structured prompts, direct child process)
- [x] T1-3: LRU file cache (50 files, 5MB cap, invalidation)
- [x] T1-4: Order concurrency limits (max 5 concurrent, queuing)
- [x] T1-5: Smart routing with tier cooldowns (5-min cooldown on rate limit)
- [x] T1-6: Timeout fixes (partial output preserved, 80% warning, defaults: quick=90s/planned=180s/deep=300s)
- [x] T1-7: WebSocket stability (20 conn/IP limit, heartbeat ping/pong)
- [x] T1-8: Integration tests (vitest, 4 test files)
- [x] T1-9: CI/CD (GitHub Actions workflow)

## TERMINAL 2: COMPLETED

All 9 frontend/UX tasks done:
- [x] T2-1: Builder mode polish (mobile responsive, framer transitions)
- [x] T2-2: File loading skeleton (no empty flash, LRU tab cap at 20)
- [x] T2-3: STT fix (webkitSpeechRecognition fallback for Chrome)
- [x] T2-4: Status bar fully functional (real branch, WS state, agent status)
- [x] T2-5: Error boundaries (crash isolation for lazy panels)
- [x] T2-6: Supabase project linking UI (Connect Database in MCP panel)
- [x] T2-7: Mobile optimization (ConnectPage responsive, touch targets)
- [x] T2-8: Leaderboard/gamification polish (achievement toasts, XP animations)
- [x] T2-9: PWA support (manifest.json, service worker)

---

## TERMINAL 1 (NEXT BATCH): Refactoring + Agent Intelligence

**You own these files:**
- `packages/remote-server/src/` (the daemon -- splitting into modules)
- `src/session.js`, `src/agents/`, `src/core/`, `src/orchestrator/`
- `packages/dashboard/src/lib/daemon.js`
- `packages/dashboard/src/lib/teams.js`
- `packages/dashboard/src/lib/routing.js`

### T1-10: Break up remote-server/src/index.js into modules
The file is 4500+ lines. Split into logical modules:
- `packages/remote-server/src/index.js` -- entry point, imports everything, Express app + WebSocket setup
- `packages/remote-server/src/pairing.js` -- pairing code generation, validation, QR, auto-refresh
- `packages/remote-server/src/orders.js` -- order lifecycle, spawning, finalize, events
- `packages/remote-server/src/filesystem.js` -- /api/fs/ endpoints, file watcher, LRU cache
- `packages/remote-server/src/git.js` -- /api/git/, /api/changes endpoints
- `packages/remote-server/src/deep-mode.js` -- parallel workers, synthesis, nested sub-agents
- Shared state (app, wss, supabase, authenticatedClients) stays exported from index.js
- Verify: `node --check` on every file, then `npm run dev:web`

### T1-11: Make Soupz work great WITHOUT Claude Code
Claude Code is already last in fallback chain (gemini -> copilot -> ollama -> claude-code). But ensure:
- If only Copilot (free) is available, the system is fully functional. Test all flows with just `gh copilot`.
- If only Ollama is available, the system works for local-only users.
- In routing.js: Don't show "degraded" warnings just because Claude Code isn't installed. It's optional, not required.
- In the agent health UI: show Claude Code as "Premium (optional)" not as a required agent.
- In agents.js: Update the Claude Code entry description to say "Premium agent - enhances Soupz but not required"
- Default model for synthesis/fleet should be Copilot gpt-5-mini (already done, verify).

### T1-12: Claude Code as a provider (not a dependency)
When Claude Code IS available, make it a first-class power mode:
- In routing.js: If user explicitly selects claude-code, respect that choice (don't override with auto-routing).
- In deep mode: If Claude Code is available AND the task is complex (architecture, security, refactoring), prefer it as the synthesis coordinator. Keep workers on free agents.
- Add a "Power Mode" toggle in the order payload: when enabled, use Claude Code as coordinator even if other agents could handle it. Default: off.
- This way: free users get full functionality via Copilot/Gemini/Ollama. Claude Code users get a turbocharged experience.

### T1-13: Team-lead style orchestration for Soupz users
Make the multi-agent orchestration as smart as what Claude Code's team-lead does:
- In the deep mode handler (remote-server or session.js), when a complex prompt comes in:
  1. Planning phase: Use Copilot gpt-5-mini to decompose the task into sub-tasks (already partially done)
  2. Assignment phase: Assign each sub-task to the best available agent based on keywords (already in pickAgentForTask)
  3. Execution phase: Run workers in parallel with progress streaming
  4. Synthesis phase: Coordinator merges results (already fixed in T1-2)
- The gap: Make the planning phase smarter. Instead of keyword matching, have the planner output structured JSON: `{ tasks: [{ title, description, preferredAgent, estimatedComplexity }] }`
- Parse this JSON and use it for worker assignment.

### T1-14: Workspace config endpoint
Terminal 2 added a "Connect Database" UI that needs this backend endpoint:
- Add `POST /api/workspace/config` to remote-server:
  - Reads/writes `.soupz/config.json` in the workspace root
  - Stores: supabase URL/key, preferred agent, build mode, custom instructions
- Add `GET /api/workspace/config` to read current config
- When creating orders, read workspace config and inject into agent prompt context

---

## TERMINAL 2 (NEXT BATCH): Final UI Polish + npm Publish

**You own these files:**
- `packages/dashboard/src/components/` (ALL components)
- `packages/dashboard/src/App.jsx`
- `packages/dashboard/src/lib/agents.js`, `lib/skills.js`, `lib/learning.js`, `lib/memory.js`
- `packages/dashboard/src/hooks/`
- `packages/dashboard/src/index.css`
- `package.json` (for npm publish fields)
- `README.md`
- `.npmignore`

### T2-10: npm publish preparation
- Update version in root package.json to `0.2.0`
- Verify `.npmignore` excludes: node_modules, .env, docs, tests, .git, .github, .claude, .soupz-runs
- Verify `"files"` or `.npmignore` includes: src/, bin/, packages/remote-server/, scripts/
- Run `npm pack --dry-run` to check what would be published
- Add `"publishConfig": { "access": "public" }` to package.json
- Create a minimal README.md with: install command, 3-step quickstart, feature list
- DO NOT actually run `npm publish` -- just prepare everything. Tell user when ready.

### T2-11: Update AUDIT_AND_USP.md with current state
Rewrite the audit to reflect what's been fixed. Update all three tables:
- Move fixed items from "FAKE/DECORATIVE" to "FULLY WORKING"
- Move improved items from "PARTIALLY WORKING" to "FULLY WORKING"
- Update "Critical Gaps" to reflect: tests added, session persistence fixed, CI/CD added
- Keep the USP section but update the "What Soupz is NOT" to reflect new capabilities
- This file is used for pitching -- it must be accurate and impressive

### T2-12: Landing page update for new features
- In LandingPage.jsx: Update feature cards to highlight real capabilities:
  - Multi-agent orchestration (team-lead style)
  - Builder mode (Lovable-style)
  - Image upload + vision
  - Real-time collaboration via Supabase relay
  - Works with free agents (no paid subscription required)
- Add a "Free to use" badge or mention prominently
- Make sure the "npx soupz" install command is prominent

### T2-13: Onboarding experience
When a user first opens the dashboard after pairing:
- If `localStorage.getItem('soupz_onboarded')` is falsy, show a brief welcome overlay:
  - "Welcome to Soupz" with 3 quick tips (swipeable cards):
    1. "Chat with AI agents" -- point to chat input
    2. "Edit code from anywhere" -- point to IDE mode toggle
    3. "Build with Builder Mode" -- point to builder mode
  - "Got it" button that sets `soupz_onboarded = true`
- Keep it short (3 cards max), dismissible, not a wizard.
- Use framer-motion for slide transitions if available.

### T2-14: Deep mode progress UI in chat
When deep/team mode runs, the chat currently shows raw sub-agent output. Polish it:
- Show a collapsible "Team Execution" card with:
  - List of sub-agents with status indicators (running/done/failed/timed-out)
  - Progress bar showing how many sub-agents completed
  - Expandable sections for each sub-agent's output
  - Final synthesis clearly labeled as "Synthesized Result"
- Use existing Lucide icons: Users (team), CheckCircle (done), XCircle (failed), Loader2 (running), Clock (timed-out)

---

## TERMINAL 3 (NEW): Testing + Quality + Edge Cases

**You own these files:**
- `tests/` (all test files)
- `supabase/migrations/` (if needed)
- Can READ any file but only WRITE to tests/ and new config files

### T3-1: Run and fix existing tests
- Run `npx vitest run` from root. Fix any failing tests.
- The devops agent created basic tests -- verify they actually pass.
- If vitest isn't installed yet, install it: `npm install -D vitest`

### T3-2: Add real integration tests for the daemon
Create `tests/daemon-integration.test.js`:
- Start the remote server programmatically (import startRemoteServer)
- Test pairing flow: generate code -> validate -> get token
- Test file read/write via API endpoints
- Test git status endpoint
- Test order creation endpoint
- Shut down server after tests
- Use `vitest` with `beforeAll`/`afterAll` for server lifecycle

### T3-3: Add frontend component smoke tests
Create `tests/frontend-smoke.test.js`:
- Verify all key component files exist and are valid JSX (import them)
- Verify all lib files export expected functions
- Test routing.js: selectAgentLocally returns valid agent IDs
- Test teams.js: createTeamPlan returns valid plan structure
- Test agents.js: CLI_AGENTS and SPECIALISTS arrays are non-empty

### T3-4: Edge case testing document
Create `tests/EDGE_CASES.md` documenting manual test scenarios:
- Open 20+ files in IDE, verify tab LRU works
- Disconnect daemon mid-stream, verify WS reconnect
- Send 6 orders simultaneously, verify queuing
- Use only Copilot (no other agents), verify full functionality
- Pair from mobile, test all views
- Test builder mode on 360px width
- Test with slow network (Chrome DevTools throttling)
- Rate limit an agent, verify cooldown and fallback

### T3-5: Verify build and lint
- Run `cd packages/dashboard && npx vite build` -- must pass with 0 errors
- Run `node --check packages/remote-server/src/index.js` -- must pass
- Run `node --check bin/soupz.js` -- must pass
- Run `node --check src/session.js` -- must pass
- Run `npx vitest run` -- all tests must pass
- Report any issues found

---

## SHARED REFERENCE: What Was Fixed This Sprint

### Previously FAKE -> Now REAL
| Feature | Old State | New State |
|---------|-----------|-----------|
| Agent Teams | Never called from UI | Wired via detectTeamTrigger in SimpleMode |
| TTS | Dead code | Speak/Stop buttons on messages |
| Extensions | localStorage flag | Hidden until real |
| Leaderboard | Mock data | Real Supabase XP sync |
| Admin Dashboard | Fake charts | Real counts from Supabase |
| Git Branches | Hardcoded "main" | Real branch from git rev-parse |
| Specialists | Just prompt templates | Role-appropriate temperature/maxTokens |
| MCP Panel | No validation | Status indicators (green/gray) |
| Synthesis | Text concatenation | Structured coordinator prompt |

### Previously MISSING -> Now ADDED
| Feature | Description |
|---------|-------------|
| Builder Mode | Lovable-style centered prompt -> chat+preview split |
| Image Upload | Paste, drag-drop, file picker, vision agent relay |
| Terminal QR | Expo Go-style scannable QR |
| Countdown Ring | Apple Passwords-style visual timer |
| WS Reconnect | Exponential backoff auto-reconnect |
| Session Refresh | Supabase JWT refresh on tab focus |
| Rate Limit Retry | Detects 429, auto-switches agent |
| OTP Collision Fix | Supabase check before registering code |
| File Cache | LRU, 50 files, 5MB cap |
| Concurrency Limits | Max 5 orders, queue overflow |
| WS Heartbeat | Ping/pong, connection limits |
| Integration Tests | Vitest, 4 test files |
| CI/CD | GitHub Actions on push/PR |
| File Loading Skeleton | No empty flash in editor |
| Tab LRU | Max 20 tabs, auto-close oldest |
| Error Boundaries | Crash isolation per panel |
| PWA | manifest.json + service worker |
| STT | webkitSpeechRecognition fallback |
| Smart Timeouts | quick=90s, planned=180s, deep=300s |
| Tier Cooldowns | 5-min cooldown on rate-limited agents |

### Claude Code Independence
Claude Code is NOT required. The fallback chain is: gemini -> copilot -> ollama -> claude-code.
If only Copilot (free) is installed, the system is fully functional.
Claude Code is a "Power Mode" enhancer, not a dependency.
