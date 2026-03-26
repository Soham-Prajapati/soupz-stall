# Current Runtime Reference

Updated: March 26, 2026

This document is the canonical source of truth for current runtime behavior.

## Runtime Components

- Dashboard UI: `packages/dashboard`
- Local daemon: `packages/remote-server`
- Dev stack launcher: `scripts/dev-web-stack.js`

## Deep Orchestration (Current)

- Deep runs support AI planner inputs:
  - `useAiPlanner`
  - `plannerStyle`
  - `plannerNotes`
- AI planning has fallback behavior if planner output is invalid or unavailable.
- Planner options in Core Console are collapsible to reduce default UI noise.

## Interactive Clarification Flow (Current)

- Orders may enter `waiting_input` when clarifications are required.
- Clarification answers are submitted through:
  - `POST /api/orders/:id/input`
- Dashboard bridge method:
  - `submitOrderInput(orderId, answers)`
- Execution resumes after valid input submission.

## Core Console UX Rules (Current)

- Interactive question panel is shown only when:
  - order status is `waiting_input`
  - pending questions are present
- Interactive question panel is rendered in the `Output` section.
- Keyboard behavior:
  - up/down and left/right: option navigation
  - tab/shift+tab: question navigation
  - space: select/toggle option
  - enter: submit answers

## Pairing and Startup Behavior (Current)

- `npm run dev:web` starts daemon + dashboard.
- Bootstrap token creation is resilient:
  - if token bootstrap fails, dev stack continues in local no-token mode
- Pairing validation compatibility checks include both:
  - `/pair/validate`
  - `/api/pair`
- Consumed active pairing codes rotate immediately to avoid stale one-time code display.

## Restart Playbook

1. Stop active dev process (`Ctrl+C`).
2. Restart full stack:
   - `npm run dev:web`
3. Hard refresh browser (`Cmd+Shift+R`) if UI state appears stale.

## Canonical References

- Setup and troubleshooting: `docs/SETUP.md`
- Runtime changes by date: `docs/RUNTIME_CHANGELOG.md`
- Team-facing summary: `CLAUDE.md`
