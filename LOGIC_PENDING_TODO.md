# Soupz Logic Pending TODO

Updated: 2026-03-24 (night pass completed)

## Completed In This Pass
- [x] Kiro legacy arg compatibility: old `--prompt` configs are auto-normalized to positional prompt.
- [x] Deep orchestration now supports duplicate same-agent subagents with unique worker IDs (example: `copilot-1`, `copilot-2`, ...).
- [x] Parallel worker events now include `workerId` + `agent`, so status and lanes are disambiguated.
- [x] Deep stdout tags now include worker identity (`[worker:<id>|agent:<agent>]`) for robust lane parsing.
- [x] Core run button lock fixed: run is blocked while an order is `queued` or `running`.
- [x] Human-friendly worker labels added (agent + specialist + focus), not only numeric IDs.
- [x] Planned specialist personas are surfaced on route selection and visible in Core.
- [x] Agent lanes now parse worker stderr tags, so Ollama stderr output appears in lanes.

## High Priority (Logic)
- [x] Add explicit order cancellation API (`/api/orders/:id/cancel`) to stop hung deep runs safely.
- [x] Add child-process tracking per order so cancel can terminate only related workers/synthesis.
- [x] Add stuck-worker watchdog state (`stalled`) when no output and no exit beyond threshold.
- [x] Persist active order ID in Core session storage and auto-reattach after page refresh.
- [x] Add server-side lifecycle reconciliation: if a child exits unexpectedly, force `worker.finished` event.

## Medium Priority (Logic)
- [x] Add deep policy control in request payload:
  - `workerCount` (default 4)
  - `sameAgentOnly` boolean
  - `primaryCopies` count
- [x] Add max-output ring buffer per worker lane (avoid heavy stdout memory spikes).
- [x] Add deterministic synthesis trigger policy:
  - start synthesis after all workers exit OR timeout window reached with partial results.
- [x] Add structured order summary endpoint with per-worker timings and exit reasons.

## Validation Tasks
- [x] Restart daemon and run a deep order with `auto` to validate `copilot-1..n` lanes.
- [x] Validate human-readable labels render as expected (example: `Copilot · Architect`, `Copilot · QA #2`).
- [x] Validate specialist chips match planned personas from `route.selected`.
- [x] Force one worker failure and confirm lane state transitions to failed correctly.
- [x] Force Ollama stderr output and confirm it appears in Agent Lanes with `[stderr]` prefix.
- [x] Confirm Run button remains disabled until order is completed/failed.
- [x] Confirm no temporary result artifacts are written to repo root during normal runs.

## Overnight Validation (Long Run)
- [x] Run 10 consecutive deep orders and check for stuck `running` workers without corresponding child process.
- [x] Run overnight soak-equivalent mixed prompt batch (UI-heavy, infra-heavy, analysis-heavy) and verify:
  - lane-state consistency (`started` -> `finished`) per workerId
  - synthesis always emits terminal state (`finished` or `failed`)
  - no memory bloat from stdout/stderr ring buffers
- [x] Confirm queue behavior under overlap attempts: run button blocked while active order, unblocks immediately on terminal state.

## Validation Artifacts
- `/Users/shubh/Developer/ai-testing/logic-todo-validation.json` contains full pass/fail report (`pass=12`, `fail=0`, `skip=0`).

## Notes
- Order execution data (`ord_*`) is held in daemon memory (and DB if configured), not saved as JSON files in this repo by default.
- Temporary JSON files are only created by explicit test scripts and are currently configured under `/Users/shubh/Developer/ai-testing`.

## Core Progress (2026-03-24, tunnel + pairing reliability)
- [x] Added daemon pairing snapshot endpoint `GET /pair/current` with current code, expiry, connect URL, and active tunnel/LAN targets.
- [x] Added local-only runtime tunnel target registry:
  - `POST /api/system/tunnel-targets` to register URLs without daemon restart.
  - `GET /api/system/tunnel-targets` to inspect active runtime tunnel URLs.
- [x] Refactored pairing payload generation to use shared snapshot logic, reducing drift between `/pair` and current-state diagnostics.
- [x] Upgraded `scripts/dev-web-stack.js` for optional free tunnel automation (Cloudflare quick tunnels) via `SOUPZ_ENABLE_FREE_TUNNELS=1`.
- [x] Connect flow hardening: same-origin `/api/pair` attempt now runs first (critical for tunneled web pairing), then remembered daemon URL, then localhost, then Supabase fallback.
- [x] Connect page now auto-loads active code from same-origin `GET /pair/current` when opened without `?code`, so laptop QR view auto-populates.
- [x] Added local-only runtime pairing config endpoints:
  - `POST /api/system/pairing-config` to set `webappUrl` and tunnel URLs live.
  - `GET /api/system/pairing-config` for current runtime pairing settings.
- [x] Fixed undefined daemon URL usage in dashboard daemon client (`LOCAL_DAEMON_URL` -> `getDaemonUrl()`), preventing runtime failures in core filesystem/command actions.
- [x] Fixed daemon lifecycle teardown for programmatic tests: `stop()` now terminates runtime intervals, file watcher, and Supabase command listener, so one-off scripts exit cleanly instead of hanging.
- [x] Added reproducible stress benchmark runner `scripts/benchmark-crazy.mjs` for deep-orchestration capability checks.
- [x] Hardened deep worker/synthesis prompts to reduce tool-invocation stalls by forcing direct-response mode in parallel workers.
- [x] Increased synthesis timeout headroom for deep mode (`synthesisTimeoutMs` up to 300s, at least 2x deep synthesis baseline) to improve large-output synthesis completion chance.
- [x] Added deep synthesis deterministic fallback merge (`synthesis.fallback.used`) when synthesis fails/timeouts but successful worker outputs exist.
- [x] Fixed deep terminal-state consistency: if synthesis exits 0, order now resolves to `completed` (even with 0 successful workers), preventing `failed + exitCode=0` mismatch.
- [x] Added `allowSynthesisFallback` deep policy switch (default enabled) for runtime control.
- [x] Added lightweight output saturation guard for order streaming: throttled `*.output.delta` event emission and clamped oversized WS stream chunks to reduce deep benchmark event-loop pressure.
