# Model Selection and Grading

## Goal

Routing must be reasoning-based and transparent, not provider-biased.

This project now uses a deterministic scorecard for agent selection in the daemon:
- method: `reasoning-scorecard-v2`
- per-agent candidate scores
- prompt signal evidence
- confidence margin

## How Routing Is Decided

When `agent=auto` is used:
1. Daemon gathers runtime-ready agents (`installed`, `ready`, `skipped`).
2. Prompt is analyzed into weighted signals:
- `code`
- `architecture`
- `research`
- `github`
- `devops`
- `privacy`
- `product`
- `security`
3. Each agent gets a weighted score from those signals.
4. Highest score wins.
5. Route event includes justification and confidence.

You can inspect this through:
- `POST /api/routing/explain`
- `order.events` item `route.selected` (contains `routeJustification` and `routeConfidence`)

## Why You May See Model Names Inside Outputs

A model can mention another model in generated text (example: "use GPT-4") without the runtime actually executing that model.

Always treat generated architecture text as a proposal, not telemetry.

Use runtime telemetry for truth:
- selected agent from route metadata
- process exit code and duration
- daemon-side routing justification

## User-Visible Benchmark Flow

Use this to compare agents before deciding your default routing preferences.

### Prompt pack
- `benchmarks/model-eval-prompts.json`

### Runner
- `scripts/run-model-benchmark.mjs`

Example:

```bash
node scripts/run-model-benchmark.mjs \
  --agents codex,gemini,copilot,claude-code,kiro,ollama \
  --timeout 120000
```

Outputs are written to `.soupz/benchmarks/<timestamp>/`:
- per-agent per-prompt markdown outputs
- `summary.json`
- `SUMMARY.md`

## Manual Grading Rubric (1-5)

Score each run across:
- correctness and factuality
- implementation feasibility
- reasoning transparency
- completeness and structure
- production readiness

Then pick your defaults based on evidence, not assumptions.

## Suggested Policy for Consumer Reliability

- Keep `auto` enabled for most users.
- Keep explicit override available for power users.
- Re-run benchmark pack after major model updates.
- Do not claim 5x/10x without benchmark evidence from your own prompt set.
