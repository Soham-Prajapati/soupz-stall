# Soupz Logic Pending TODO

Updated: 2026-03-24

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
- [ ] Add explicit order cancellation API (`/api/orders/:id/cancel`) to stop hung deep runs safely.
- [ ] Add child-process tracking per order so cancel can terminate only related workers/synthesis.
- [ ] Add stuck-worker watchdog state (`stalled`) when no output and no exit beyond threshold.
- [ ] Persist active order ID in Core session storage and auto-reattach after page refresh.
- [ ] Add server-side lifecycle reconciliation: if a child exits unexpectedly, force `worker.finished` event.

## Medium Priority (Logic)
- [ ] Add deep policy control in request payload:
  - `workerCount` (default 4)
  - `sameAgentOnly` boolean
  - `primaryCopies` count
- [ ] Add max-output ring buffer per worker lane (avoid heavy stdout memory spikes).
- [ ] Add deterministic synthesis trigger policy:
  - start synthesis after all workers exit OR timeout window reached with partial results.
- [ ] Add structured order summary endpoint with per-worker timings and exit reasons.

## Validation Tasks
- [ ] Restart daemon and run a deep order with `auto` to validate `copilot-1..n` lanes.
- [ ] Validate human-readable labels render as expected (example: `Copilot · Architect`, `Copilot · QA #2`).
- [ ] Validate specialist chips match planned personas from `route.selected`.
- [ ] Force one worker failure and confirm lane state transitions to failed correctly.
- [ ] Force Ollama stderr output and confirm it appears in Agent Lanes with `[stderr]` prefix.
- [ ] Confirm Run button remains disabled until order is completed/failed.
- [ ] Confirm no temporary result artifacts are written to repo root during normal runs.

## Overnight Validation (Long Run)
- [ ] Run 10 consecutive deep orders and check for stuck `running` workers without corresponding child process.
- [ ] Run a 2-hour soak with mixed prompts (UI-heavy, infra-heavy, analysis-heavy) and verify:
  - lane-state consistency (`started` -> `finished`) per workerId
  - synthesis always emits terminal state (`finished` or `failed`)
  - no memory bloat from stdout/stderr ring buffers
- [ ] Confirm queue behavior under overlap attempts: run button blocked while active order, unblocks immediately on terminal state.

## Notes
- Order execution data (`ord_*`) is held in daemon memory (and DB if configured), not saved as JSON files in this repo by default.
- Temporary JSON files are only created by explicit test scripts and are currently configured under `/Users/shubh/Developer/ai-testing`.
