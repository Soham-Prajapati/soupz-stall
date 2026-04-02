# Core Phase Plan (Phase 0 -> Phase N)

Date: 2026-04-03

## Phase 0: Core Demo Baseline (Must Work)

Goal: `/core` matches the demo story and is reliable for recording.

Definition of done:
- `/core` shows clear runtime readiness (Gemini/Copilot readiness visibility).
- `/core` includes preview enable/disable control.
- `/core` includes a workspace dock with preview, git, and terminal visibility.
- Bottom status bar is visible on `/core` route.
- Dev server detection works from daemon and can refresh.

## Phase 1: Editor Experience Stabilization

Goal: reduce UI confusion and improve editing ergonomics.

Planned scope:
- Markdown visual preview mode for `.md` files.
- Keep source and rendered markdown easy to toggle.
- Ensure search behavior is consistent (editor find for in-file search).
- Improve run-button feedback with exit code and first-line output.

## Phase 2: Run File Reliability

Goal: run button executes real code, not stub actions.

Planned scope:
- Real execution endpoint for common file types.
- Add C/C++ support (`.c`, `.cpp`, `.cc`, `.cxx`) with compile + run.
- Return structured output (`stdout`, `stderr`, `exitCode`, `timedOut`).
- Handle missing compiler/runtime cleanly.

## Phase 3: Product Cleanup and UX Consolidation

Goal: remove duplicated or conflicting controls and tighten layout.

Planned scope:
- Trim redundant controls and duplicate search flows.
- Improve panel hierarchy and spacing in Pro mode and Core mode.
- Standardize language around preview, run, and diagnostics.

## Phase N: Remote Connectivity Hardening

Goal: remote connection is predictable and provider-agnostic.

Planned scope:
- Keep Cloudflare quick-tunnel path optional and clearly documented.
- Officially support ngrok/Tailscale Funnel as first-class alternatives.
- Add runbook checks for same-LAN vs different-network connectivity.
