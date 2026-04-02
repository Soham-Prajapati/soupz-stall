# 🍜 Soupz Output - April 3, 2026

## 🚀 Accomplishments

### 1. Documentation and Demo Readiness
- **Consolidated Documentation Index**: Created `docs/INDEX.md` as the single canonical source of truth.
- **Improved Troubleshooting**: Added `docs/guides/TROUBLESHOOTING_MATRIX.md` covering specific issues for Gemini, Codex, Copilot, Claude, Ollama, and Kiro.
- **Enhanced Demo Script**: Updated `docs/CORE_DEMO_SCRIPT.md` with deterministic steps and fallback plans for live demonstrations.

### 2. CI/CD and Safe Release Workflow
- **Pre-Deploy Smoke Test**: Created `scripts/pre-deploy-smoke.sh` to verify builds, daemon syntax, and critical tests before release.
- **Release Process Documentation**: Added `docs/guides/RELEASE_PROCESS.md` defining PR-only deploys, `release/*` branch conventions, and rollback procedures.

### 3. Product UX/Value Validation
- **Usage Instrumentation**: Built a client-side telemetry library `packages/dashboard/src/lib/instrumentation.js` and integrated it into setup, pairing, and orchestration flows.
- **Onboarding Checklist**: Replaced the static onboarding carousel with an outcome-focused `OnboardingChecklist.jsx` component that tracks user progress (Pairing, Deep Run, Commits, Live Preview).
- **Feedback Loop Plan**: Developed `docs/guides/FEEDBACK_LOOP_PLAN.md` for community engagement, Discord support, and competitive review mining.

### 4. Hackathon PS Throughput Benchmark
- **Standardized Pipeline**: Created `scripts/normalize-ps.cjs` to parse hackathon problem statements into a structured JSON format.
- **Benchmark Flow**: Developed `scripts/run-hackathon-benchmark.mjs` to simulate and measure orchestrator throughput across multiple categories (Web, App, AI/ML, Blockchain).
- **Claim Policy**: Published `docs/guides/CLAIM_POLICY.md` defining evidence requirements for 5x and 10x speedup claims.

### 5. Deep Orchestration Hardening
- **Structured Shared-Memory**: Updated `SHARED_MEMORY.md` to use a structured schema for Claims, Assumptions, and Sources, with automated extraction from worker outputs.
- **Event Preservation**: Improved `pushOrderEvent` in `packages/remote-server/src/shared.js` to protect critical lifecycle and interaction events from pruning.
- **UI Readiness Badges**: Enhanced agent status indicators in the Core Console to display specific readiness and auth states.
- **Strict Citation Mode**: Implemented a "Strict Citation" instruction for research and finance specialist lanes in `deep-mode.js`.
- **Mixed-Mode Toggle**: Added a user-controllable toggle in the Core Console to allow or disallow cross-agent fanout during deep runs.
- **Order Scorecard**: Integrated a new `ORDER_SCORECARD.md` artifact generation into the deep orchestration flow, providing per-lane quality and risk metrics.

## 📂 Files Modified
- `docs/INDEX.md` (Created)
- `docs/README.md`
- `docs/guides/TROUBLESHOOTING_MATRIX.md` (Created)
- `docs/CORE_DEMO_SCRIPT.md`
- `scripts/pre-deploy-smoke.sh` (Created)
- `docs/guides/RELEASE_PROCESS.md` (Created)
- `packages/dashboard/src/lib/instrumentation.js` (Created)
- `packages/dashboard/src/components/shared/SetupWizard.jsx`
- `packages/dashboard/src/components/connect/ConnectPage.jsx`
- `packages/dashboard/src/components/shared/OnboardingChecklist.jsx` (Created)
- `packages/dashboard/src/App.jsx`
- `packages/dashboard/src/components/core/CoreConsole.jsx`
- `packages/dashboard/src/components/git/GitPanel.jsx`
- `docs/guides/FEEDBACK_LOOP_PLAN.md` (Created)
- `scripts/normalize-ps.cjs` (Created)
- `scripts/run-hackathon-benchmark.mjs` (Created)
- `docs/guides/CLAIM_POLICY.md` (Created)
- `packages/remote-server/src/deep-mode.js`
- `packages/remote-server/src/shared.js`
- `tasks.md`
- `TODO_TERMINALS.md`
