# Soupz Production Sprint -- Terminal Tasks

**How to use:** Open terminals. In each, run Claude Code and say:
- "Read TODO_TERMINALS.md. I am Terminal [N]. Start working on my tasks."

Each terminal has its own non-overlapping set of files. They will NOT clash.
Read `CLAUDE.md` first for project conventions and architecture.

**Model guidance:** Use `sonnet` (default) for tasks requiring understanding large files (3000+ lines). Use `haiku` only for straightforward implementation with clear code snippets provided.

## IMPORTANT RULES FOR ALL AGENTS/TERMINALS
1. **When you complete a task, IMMEDIATELY edit this file** to mark it `[x]` instead of `[ ]`.
2. **Verify your work** before marking done: run `node --check` on modified backend files, run `npx vite build` for frontend changes.
3. **Don't work on tasks marked [x]** -- they're already done.
4. **If you create new tasks** during your work, add them to this file under your terminal's section.
5. **Read this file BEFORE starting** to see what's already been completed by other terminals.

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

## TERMINAL 1 (BATCH 2): Refactoring + Agent Intelligence -- COMPLETED

**You own these files:**
- `packages/remote-server/src/` (the daemon -- splitting into modules)
- `src/session.js`, `src/agents/`, `src/core/`, `src/orchestrator/`
- `packages/dashboard/src/lib/daemon.js`
- `packages/dashboard/src/lib/teams.js`
- `packages/dashboard/src/lib/routing.js`

### [x] T1-10: Break up remote-server/src/index.js into modules
Split into 9 files: index.js (1086), shared.js (1366), deep-mode.js (1331), orders.js (586), filesystem.js (349), pairing.js (287), git-endpoints.js (217), model-discovery.js (120), workspace.js (63). All pass node --check.
- `packages/remote-server/src/index.js` -- entry point, imports everything, Express app + WebSocket setup
- `packages/remote-server/src/pairing.js` -- pairing code generation, validation, QR, auto-refresh
- `packages/remote-server/src/orders.js` -- order lifecycle, spawning, finalize, events
- `packages/remote-server/src/filesystem.js` -- /api/fs/ endpoints, file watcher, LRU cache
- `packages/remote-server/src/git.js` -- /api/git/, /api/changes endpoints
- `packages/remote-server/src/deep-mode.js` -- parallel workers, synthesis, nested sub-agents
- Shared state (app, wss, supabase, authenticatedClients) stays exported from index.js
- Verify: `node --check` on every file, then `npm run dev:web`

### [x] T1-11: Make Soupz work great WITHOUT Claude Code
Claude Code is already last in fallback chain (gemini -> copilot -> ollama -> claude-code). But ensure:
- If only Copilot (free) is available, the system is fully functional. Test all flows with just `gh copilot`.
- If only Ollama is available, the system works for local-only users.
- In routing.js: Don't show "degraded" warnings just because Claude Code isn't installed. It's optional, not required.
- In the agent health UI: show Claude Code as "Premium (optional)" not as a required agent.
- In agents.js: Update the Claude Code entry description to say "Premium agent - enhances Soupz but not required"
- Default model for synthesis/fleet should be Copilot gpt-5-mini (already done, verify).

### [x] T1-12: Claude Code as a provider (not a dependency)
When Claude Code IS available, make it a first-class power mode:
- In routing.js: If user explicitly selects claude-code, respect that choice (don't override with auto-routing).
- In deep mode: If Claude Code is available AND the task is complex (architecture, security, refactoring), prefer it as the synthesis coordinator. Keep workers on free agents.
- Add a "Power Mode" toggle in the order payload: when enabled, use Claude Code as coordinator even if other agents could handle it. Default: off.
- This way: free users get full functionality via Copilot/Gemini/Ollama. Claude Code users get a turbocharged experience.

### [x] T1-13: Team-lead style orchestration for Soupz users (covered by T1-17)
Make the multi-agent orchestration as smart as what Claude Code's team-lead does:
- In the deep mode handler (remote-server or session.js), when a complex prompt comes in:
  1. Planning phase: Use Copilot gpt-5-mini to decompose the task into sub-tasks (already partially done)
  2. Assignment phase: Assign each sub-task to the best available agent based on keywords (already in pickAgentForTask)
  3. Execution phase: Run workers in parallel with progress streaming
  4. Synthesis phase: Coordinator merges results (already fixed in T1-2)
- The gap: Make the planning phase smarter. Instead of keyword matching, have the planner output structured JSON: `{ tasks: [{ title, description, preferredAgent, estimatedComplexity }] }`
- Parse this JSON and use it for worker assignment.

### [x] T1-14: Workspace config endpoint
Terminal 2 added a "Connect Database" UI that needs this backend endpoint:
- Add `POST /api/workspace/config` to remote-server:
  - Reads/writes `.soupz/config.json` in the workspace root
  - Stores: supabase URL/key, preferred agent, build mode, custom instructions
- Add `GET /api/workspace/config` to read current config
- When creating orders, read workspace config and inject into agent prompt context

---

## TERMINAL 2 (NEXT BATCH): COMPLETED

All 5 UI polish + npm tasks done:
- [x] T2-10: npm publish prep (v0.2.0, .npmignore, README, 424KB pack, publishConfig)
- [x] T2-11: AUDIT_AND_USP.md rewrite (23 features moved to FULLY WORKING, pitch-ready)
- [x] T2-12: Landing page update (real feature cards, "Free to use" badge, npx soupz prominent)
- [x] T2-13: Onboarding overlay (3 swipeable cards, framer-motion transitions, dismissible)
- [x] T2-14: Team execution dashboard (TeamExecutionCard.jsx, structured agent status, progress bar, expandable outputs)

---

## TERMINAL 3 (BATCH 1): COMPLETED

All 5 testing + quality tasks done:
- [x] T3-1: Run and fix existing tests (all 9 original tests pass)
- [x] T3-2: Daemon integration tests (17 tests: health, pairing flow, file API, git, orders, system endpoints)
- [x] T3-3: Frontend component smoke tests (61 tests: 21 components, 7 libs, agents/routing/teams/skills/learning/memory exports)
- [x] T3-4: Edge case testing document (60+ manual scenarios across 13 categories)
- [x] T3-5: Verify build and lint (vite build pass, node --check x3 pass, 87 tests all green)

---

## TERMINAL 1 (BATCH 3): Smart Model Selection + Team-Lead Orchestration

**You own these files (same as before):**
- `packages/remote-server/src/` (daemon)
- `src/session.js`, `src/agents/`, `src/core/`, `src/orchestrator/`
- `packages/dashboard/src/lib/daemon.js`, `lib/teams.js`, `lib/routing.js`
- `defaults/agents/*.md` (agent config files)

### [x] T1-15: Dynamic model discovery for ALL agents -- never hardcode
Agent models change frequently across ALL providers. Discover at runtime, cache, auto-refresh.

**Step 1: Universal model discovery system**
Create `packages/remote-server/src/model-discovery.js` (new file):
```javascript
// Model discovery for all CLI agents. Probes each agent for available models.
// Cache results for 24h. Re-probe on demand via /api/models/refresh.

const modelCache = new Map(); // agentId -> { models, probedAt }
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Per-agent probe commands:
const PROBE_COMMANDS = {
  copilot: {
    cmd: 'gh copilot -- -p "list all available models. respond with ONLY a comma-separated list of model IDs, nothing else" --model gpt-5.1-codex-mini --allow-all-tools',
    parse: (output) => {
      const match = output.match(/[\w.-]+(?:,\s*[\w.-]+)+/);
      return match ? match[0].split(',').map(m => m.trim()).filter(Boolean) : [];
    },
    fallback: ['gpt-4.1'], // always exists
  },
  gemini: {
    // Read model list from Gemini CLI's own source (most reliable, no API call needed)
    cmd: `node -e "
      try {
        const p = require('child_process').execSync('which gemini', {encoding:'utf8'}).trim();
        const fs = require('fs');
        // Traverse symlinks to find the actual CLI package
        const real = fs.realpathSync(p);
        const base = real.replace(/\\/bin\\/gemini$/, '').replace(/\\/libexec\\/.*/, '/libexec/lib/node_modules/@google/gemini-cli');
        const modelsPath = base + '/node_modules/@google/gemini-cli-core/dist/src/config/models.js';
        const src = fs.readFileSync(modelsPath, 'utf8');
        const models = [...src.matchAll(/= '(gemini-[\\w.-]+)'/g)].map(m => m[1]);
        console.log([...new Set(models)].join(','));
      } catch(e) { console.log('gemini-2.5-flash'); }
    "`,
    parse: (output) => {
      return output.trim().split(',').filter(m => m.startsWith('gemini-'));
    },
    fallback: ['gemini-2.5-flash', 'gemini-2.5-pro'],
  },
  ollama: {
    cmd: 'ollama list',
    parse: (output) => {
      // ollama list output: NAME ID SIZE MODIFIED per line
      return output.split('\n').slice(1) // skip header
        .map(line => line.split(/\s+/)[0]).filter(Boolean);
    },
    fallback: [],
  },
  'claude-code': {
    cmd: null, // No probe needed -- claude supports 'sonnet' and 'opus' aliases
    parse: () => ['sonnet', 'opus', 'haiku'],
    fallback: ['sonnet'],
  },
};

async function probeAgentModels(agentId) {
  const cached = modelCache.get(agentId);
  if (cached && Date.now() - cached.probedAt < CACHE_TTL) return cached.models;

  const probe = PROBE_COMMANDS[agentId];
  if (!probe) return [];

  let models = probe.fallback;
  if (probe.cmd) {
    try {
      const result = execSync(probe.cmd, { timeout: 30000, encoding: 'utf8' });
      const parsed = probe.parse(result);
      if (parsed.length > 0) models = parsed;
    } catch { /* use fallback */ }
  } else {
    models = probe.parse('');
  }

  modelCache.set(agentId, { models, probedAt: Date.now() });
  return models;
}

async function discoverAllModels() {
  const result = {};
  for (const agentId of Object.keys(PROBE_COMMANDS)) {
    result[agentId] = await probeAgentModels(agentId);
  }
  return result;
}

// Categorize ANY agent's models by naming pattern (works for all providers)
function categorizeModels(models) {
  return {
    reasoning: models.find(m => /claude.*sonnet|claude.*opus|opus/i.test(m))
      || models.find(m => /claude/i.test(m))
      || models.find(m => /gpt-5\.\d+$/.test(m))
      || models[0] || null,
    code: models.find(m => /codex(?!.*mini)/i.test(m))
      || models.find(m => /gpt-5\.\d+$/.test(m))
      || models[0] || null,
    fast: models.find(m => /mini/i.test(m))
      || models.find(m => /flash/i.test(m))
      || models[0] || null,
  };
}

function selectModelForTask(agentId, taskType) {
  const cached = modelCache.get(agentId);
  if (!cached) return null; // agent manages its own model
  const cat = categorizeModels(cached.models);
  return cat[taskType] || cat.fast || null;
}

export { probeAgentModels, discoverAllModels, categorizeModels, selectModelForTask, modelCache };
```

**Step 2: Integrate into daemon**
In `packages/remote-server/src/index.js`:
- Import from model-discovery.js
- Call `discoverAllModels()` on startup (non-blocking, background)
- Add endpoints:
  ```javascript
  app.get('/api/models', requireAuth, async (req, res) => {
    const all = await discoverAllModels();
    const categorized = {};
    for (const [agent, models] of Object.entries(all)) {
      categorized[agent] = { available: models, recommended: categorizeModels(models) };
    }
    res.json({ agents: categorized, lastProbed: Date.now() });
  });

  app.post('/api/models/refresh', requireAuth, async (req, res) => {
    modelCache.clear();
    const all = await discoverAllModels();
    res.json({ refreshed: true, agents: Object.keys(all) });
  });
  ```

**Step 3: Replace ALL hardcoded model references**
Grep for hardcoded model strings across the entire codebase:
- `gpt-5-mini`, `gpt-4.1`, `gpt-5.1-codex`, `gpt-5.1-codex-mini` in:
  - `src/session.js`
  - `packages/remote-server/src/index.js`
  - `src/orchestrator/router.js`
  - `src/orchestrator/semantic-router.js`
  - `src/memory/pool.js`
- Replace each with: `selectModelForTask('copilot', 'fast')` or `'code'` or `'reasoning'`
- When spawning agent with model: `if (model) args.push('--model', model);`

**Step 4: Update defaults/agents/copilot.md**
Remove the hardcoded available_models list. Add: "Models discovered dynamically at runtime. Run /api/models/refresh to update."

**Step 5: Auto-refresh trigger**
- On daemon startup: probe all agents (background, non-blocking)
- Every 24h: re-probe automatically
- When a model-related error occurs in stderr: trigger re-probe for that agent
- Frontend: "Refresh Models" button in agent config panel calls POST /api/models/refresh

### [x] T1-16: Self-verification step in orchestration
Each sub-agent should verify its output before declaring done (like Claude Code's /gate):

1. In `packages/remote-server/src/index.js` (deep mode / worker execution):
   After a worker finishes, spawn a quick verification step:
   ```javascript
   // Verification step (uses free model, fast)
   const verifyPrompt = `Review this output for the task "${task}". Check for:
   1. Does it answer the original question?
   2. Is the code syntactically valid?
   3. Are there obvious errors?
   Reply with PASS or FAIL with brief reason.`;

   const verifyResult = await runChildAgent({
     agent: 'copilot', prompt: verifyPrompt,
     cwd, mcpServers: [], timeoutMs: 30000
   });
   ```
   - If FAIL: retry the worker once with the failure reason appended to prompt
   - If PASS: continue to synthesis
   - Max 1 retry per worker to avoid loops

2. In `packages/dashboard/src/lib/teams.js` `executeTeam()`:
   After each sub-agent completes, add a verification check if the output is too short (< 50 chars) or contains error markers.

### [x] T1-17: Team-lead style coordination protocol
Make Soupz's orchestration work like Claude Code's team-lead -- with task decomposition, assignment, coordination, testing, synthesis:

1. In `packages/remote-server/src/index.js` or `src/session.js`, create a new orchestration mode called "team" (alongside existing "deep"):
   ```
   Order flow for "team" mode:
   a) PLAN: Use claude-sonnet-4.6 via Copilot to decompose task into sub-tasks with JSON output:
      { tasks: [{ id, title, description, preferredAgent, complexity, dependsOn }] }
   b) ASSIGN: Map each task to best available agent. Respect dependsOn for ordering.
   c) EXECUTE: Run independent tasks in parallel, sequential for dependencies.
      Each worker gets: task description + workspace context + shared memory
   d) VERIFY: Quick verification of each output (T1-16)
   e) SYNTHESIZE: Coordinator merges all outputs into coherent response
   f) REPORT: Return structured result with per-task status
   ```

2. In `packages/dashboard/src/lib/teams.js`, update `executeTeam()` to support this richer protocol:
   - Accept custom prompts per sub-agent (pass through from UI)
   - Return structured result: `{ tasks: [{ id, agent, status, output, verified }], synthesis }`

3. In daemon.js `sendAgentPrompt()`: Add `orchestrationMode: 'team'` option that triggers this flow.

### T1-18: Break up src/session.js into modules
Session.js is 3500 lines. Split into:
- `src/session/index.js` -- Session class, main handler
- `src/session/fleet.js` -- fleet/deep mode orchestration
- `src/session/workers.js` -- worker management, spawning
- `src/session/synthesis.js` -- synthesis logic
- `src/session/memory.js` -- shared memory management
- Keep the Session class API identical (same exports)

---

## TERMINAL 2 (BATCH 3): COMPLETED

All 4 team UI + model selection tasks done:
- [x] T2-15: Model tier selector (Fast/Balanced/Premium dropdown in SimpleMode + BuilderMode, useModels hook, localStorage persistence, passed in order payload)
- [x] T2-16: Custom prompt editor (Team Plan preview card before execution, per-agent custom instructions textarea, Run Team/Cancel buttons)
- [x] T2-17: Team execution dashboard (TeamExecutionCard.jsx with structured agent status, progress bar, expandable outputs, synthesis section -- combined with T2-14)
- [x] T2-18: Agent configuration panel (AgentsSettings in ProMode sidebar: enable/disable toggles, temperature slider, Premium badge for claude-code)

---

## TERMINAL 3 (BATCH 2): COMPLETED

All 3 orchestration + stress testing tasks done:
- [x] T3-6: Orchestration e2e tests (40 tests: detectTeamTrigger 9 patterns, createTeamPlan 4 teams, model selection 5 prompt types, cooldowns, detectIntent, scoreAgentForPrompt)
- [x] T3-7: Copilot model tests (24 tests: agent definitions, tiers, freeModel, model selection per task type, fallback chain, specialist validation)
- [x] T3-8: Stress tests (10 tests: order concurrency, file cache 50 reads, WS connection limits 10+22, 20 concurrent tree/health requests, concurrent file writes)

**Total test suite: 9 files, 161 tests, all passing.**

---

## TERMINAL 4 (NEW): Production-Ready Feature Hardening

**Focus:** Not just "working" -- PRODUCTION-READY. Handle edge cases, load, failures.

**You own these files:**
- Can modify `packages/remote-server/src/index.js` (hardening existing endpoints)
- Can modify `packages/remote-server/src/*.js` (if T1-10 has split them)
- Can create new utility files in `packages/remote-server/src/`

### [x] T4-1: Production-ready agent spawning with retry + health
- Before spawning, verify agent is available (run probe, don't rely on stale cache)
- If binary not found, immediately try next fallback (don't wait for timeout)
- If agent exits with non-zero within 2s (instant crash), retry once with different model
- Log every spawn: agent, model, prompt length, start time, outcome
- Find `startSingleAgentOrder` in index.js and add these guards

### [x] T4-2: Production-ready file operations for 100+ files
- Read > 1MB: return first 1MB with `truncated: true` (don't crash browser)
- Write: validate path (no null bytes, double-dots, symlink escapes)
- Tree > 1000 entries: paginate (first 500 + `hasMore: true`)
- Add file size to tree entries for frontend display
- File watcher: debounce 100ms to prevent flood during npm install

### [x] T4-3: Production-ready WebSocket protocol
- Reject unknown message types with error response
- Reject messages > 1MB (prevent memory abuse)
- Rate limit: max 100 messages/second per client
- If broadcast fails for one client, catch error, don't crash loop
- Log connection/disconnection with IP and session duration

### [x] T4-4: Production-ready order lifecycle
- Save last 100 completed orders to `~/.soupz/order-history.json`
- Track metrics: avg response time, success rate, most-used agent
- GET /api/orders/metrics endpoint
- Auto-delete in-memory orders older than 1 hour (prevent memory leak)
- On daemon restart: detect orphaned orders, mark failed

### [x] T4-5: Production-ready git operations
- Verify ALL git operations have timeouts (status=5s, diff=10s, commit=10s, push=30s)
- Sanitize ALL user inputs (branch names, file paths, commit messages) against command injection
- Add git stash: GET /api/git/stash, POST /api/git/stash, POST /api/git/stash/pop
- Add git log: GET /api/git/log?limit=20 (hash, message, author, date)
- Parse git stderr into human-readable error messages

### [x] T4-6: Production-ready terminal
- Verify terminal reconnection on refresh works
- Max 5 terminals per session
- Buffer limit: keep last 10000 lines, not unlimited
- Verify SIGWINCH sent on resize
- Kill orphaned terminals (no client for 5 minutes)

---

## TERMINAL 1 (BATCH 4): Refactoring

### [x] T1-10: Break up remote-server/src/index.js
All agents are done modifying index.js. NOW it's safe to split:
- `index.js` -- entry point, Express + WS setup, imports
- `pairing.js` -- code gen/validation/QR/auto-refresh
- `orders.js` -- order creation, lifecycle, finalize, events
- `filesystem.js` -- /api/fs/ endpoints, file watcher, LRU cache
- `git.js` -- /api/git/, /api/changes endpoints
- `deep-mode.js` -- parallel workers, synthesis, nested sub-agents
- `workspace.js` -- /api/workspace/config
- Shared state exported from index.js
- Verify: node --check every file, npm run dev:web

### [x] T1-18: Break up src/session.js
- `src/session/index.js` -- Session class, main handler
- `src/session/fleet.js` -- fleet/deep mode
- `src/session/synthesis.js` -- synthesis logic
- `src/session/memory.js` -- shared memory
- Keep same API

## TERMINAL 1 (BATCH 5): Branding + Core QoL

### [x] T1-19: Cockpit naming exploration
- Compile 5-7 candidate names that fit the Soupz Stall USP (remote cockpit for local agents).
- Provide tone/tagline guidance + migration notes so docs can stay consistent during rename.
- Update AUDIT_AND_USP.md + TODO_TERMINALS.md with insights so future agents stay aligned.

### [x] T1-20: Source control/mobile layout sanity
- Fix Git/Source Control panel on narrow/mobile widths (overflow, overlapping badges, scroll containers).
- Ensure theme switching hits git panel + core chrome (dropdowns, tabs, buttons) instead of only 2 controls.
- Verify "Add Terminal" CTA and other action buttons remain tappable without duplicates/stuck states.

### [x] T1-21: /core provider QA
- Exercise /core orchestration with Codex + Gemini providers (since Copilot quota is exhausted).
- Document gaps (CLI detection, routing) and add failsafes so core mode never blocks due to provider mix.
- Update TODO + AUDIT with any follow-ups discovered during the run.

### [x] T1-22: Mobile UX + file references
- Fix SimpleMode header overflow, agent dropdown stacking, and add agent filter gating so narrow layouts stop overlapping.
- Add drag-and-drop from the explorer into chat plus `@file` typeahead so prompts can reference files quickly (and reflect folder status colors).
- Wire Monaco + terminal themes to current palette so theme switches no longer leave the editor in dark-default.

### [x] T1-23: Remote run & live preview parity
- Git view mirrors VS Code now (per-file diff rail, badges, and streaming commit-message generation that actually pipes through `daemon.sendPrompt`).
- SimpleMode ships a toggleable preview column that auto-detects the local dev server (via `/api/dev-server`) and falls back to the last HTML block if no server is alive.
- Monaco + xterm themes respect the active palette (no more light editor in dark theme), and the terminal panel finally lets you kill/close tabs from desktop or the dedicated mobile tab.

---

## TERMINAL 2 (BATCH 4): New Features

### T2-19: Keyboard shortcuts overlay
- Cmd+/ or Cmd+Shift+K to show shortcuts panel
- List all shortcuts, searchable
- packages/dashboard/src/components/shared/KeyboardShortcuts.jsx

### T2-20: Toast notification system
- Order completed/failed, rate limit fallback, achievement, daemon disconnect/reconnect
- Auto-dismiss 5s, notification queue
- packages/dashboard/src/components/shared/NotificationToast.jsx

### T2-21: Settings sync to Supabase
- On settings change: debounce 2s, upsert to soupz_profiles.settings JSONB
- On login: fetch from Supabase, merge with local (prefer newer)
- Sync: theme, mode, agent prefs, model tier, enabled agents

### T2-22: QR deep-link + auto-pair experience — ✅ DONE
- Pairing QR + terminal link now include `remote=<daemon>` so mobile cameras open `soupz.vercel.app/connect?code=...` with the daemon URL embedded.
- ConnectPage auto-submits whenever the link originated from a QR (session flag) or when the user is on mobile, and gracefully falls back if the daemon can't be reached.
- `/pair` and `/pair/current` expose the preferred remote base and the CLI prints the deep link so scanning immediately authorizes the phone session.

### [x] T2-23: CLI naming + npm alias rollout
- Added `soupz-cockpit` as the primary npm entry (aliasing `soupz`), refreshed README/AUDIT/CLAUDE copy, and kept the CLI messaging consistent with the cockpit identity.
- Landing-page/banner wording will be updated alongside the broader UI polish (T2-28).

### T2-24: `_soupz_output` run archive — ✅ DONE
- Daemon now writes every completed order into `.soupz/output/<timestamp>_<orderId>/` (summary.json, prompt.md, stdout/stderr, events.ndjson); fallback `_soupz_output/` created if the workspace isn’t writable.
- README + AUDIT updated so teams know where to pull past rationale. Dashboard quick-link still pending separately.

### [x] T2-25: CLI manager endpoint resilience
- Frontend now sends the correct payload and surfaces API errors; daemon returns richer version info so the wizard presents real data without spamming 400s.
- Installer actions still show a "coming soon" message until we wire up real commands for unsupported CLIs.

### [x] T2-26: Voice/STT fallback polish
- Speech recognition errors (network/permission) now disable the mic button and show an inline warning instead of looping "network" errors.

### [x] T2-27: Setup wizard gating
- Completion is tracked per host/workspace signature and dismissals are respected for the current session, so the wizard only reappears when requirements actually fail.

### T2-28: Theme overhaul & layout polish
- Current theme mix shifts unpredictably between dark/light, fonts shift weights, and the UI still looks like VS Code; run a focused pass to make the Cockpit feel like its own experience (hero status for Agent Teams, simplified chrome, consistent colors/spacing).

### [x] T2-29: Terminal panel reliability
- The "New Terminal" button now truly spawns a fresh PTY (killing the previous one if needed) so users can reset the terminal without refreshing the page.

### T2-30: Setup wizard installer actions
- The “Install” buttons currently POST to `/api/system/manage-cli` which responds 400. Add graceful errors, real installer commands (or hide the buttons unless the daemon supports them), and expose meaningful feedback in the wizard.

---

## TERMINAL 3 (BATCH 3): Quality

### T3-9: Run ALL tests and fix failures
- `npx vitest run` -- fix every failing test, don't delete them

### T3-10: Security review
- Every /api/* route has requireAuth
- No command injection in git execSync
- No path traversal in file operations
- Document in tests/SECURITY_REVIEW.md

### T3-11: Build verification
- Dashboard build: 0 errors
- All backend files: node --check passes
- All tests: vitest passes
- Report issues

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

### Claude Code Independence + Dynamic Model Strategy
Claude Code is NOT required. The fallback chain is: gemini -> copilot -> ollama -> claude-code.

**Copilot models change frequently. NEVER hardcode model names.**
As of March 29, 2026, available models via `gh copilot --model`:
```
claude-sonnet-4.5, claude-haiku-4.5, claude-opus-4.5, claude-sonnet-4,
gpt-5.3-codex, gpt-5.2-codex, gpt-5.2, gpt-5.1-codex-max, gpt-5.1-codex,
gpt-5.1, gpt-5.4-mini, gpt-5.1-codex-mini, gpt-5-mini, gpt-4.1
```
These WILL change. T1-15 adds dynamic model discovery at runtime.

**Model selection strategy (categorized by pattern, not by name):**
- Reasoning tasks: pick first `claude-sonnet-*` or `claude-opus-*` available
- Code tasks: pick first `*-codex` (non-mini) available
- Fast/routing: pick first `*-mini` available
- Fallback: gpt-4.1 (always available, free)

This means: even without standalone Claude Code, users get Claude-level reasoning through Copilot's model access. Soupz automatically uses the best models available.
