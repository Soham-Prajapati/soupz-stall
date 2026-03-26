# Runtime Changelog

## 2026-03-26

- Added AI planner controls in deep mode (`useAiPlanner`, `plannerStyle`, `plannerNotes`).
- Added interactive clarification lifecycle:
  - `waiting_input` status support
  - answer submission endpoint `POST /api/orders/:id/input`
  - dashboard resume wiring through `submitOrderInput(orderId, answers)`
- Updated Core Console interaction UX:
  - planner controls can be collapsed
  - interactive panel appears only when required
  - interactive panel renders in Output section
  - selected planning profile visibility improved
- Hardened startup and pairing:
  - `npm run dev:web` continues in local mode when token bootstrap fails
  - pairing validation retries cover `/pair/validate` and `/api/pair`
  - one-time pairing code rotates immediately after consumption
- Updated core docs to reflect current behavior.

## 2026-03-24

- Added pairing current snapshot and runtime tunnel target updates.
- Added runtime pairing config endpoints.
- Added deep orchestration stress and synthesis resilience improvements.
- Added synthesis deterministic fallback mode and lifecycle consistency fixes.

## Notes

- This changelog tracks runtime behavior changes, not every internal refactor.
- For full setup instructions, see `docs/SETUP.md`.
