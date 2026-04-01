# Four-Day Stabilization Checklist

## Day 1 - Routing Integrity

- [ ] Confirm Codex and Copilot are shown as separate lanes in API status responses.
- [ ] Run routing explanation smoke checks:
  - `POST /api/classify`
  - `POST /api/routing/explain`
- [ ] Verify Ollama is treated as local-unlimited (no quota cooldown behavior).
- [ ] Capture one benchmark baseline run using `scripts/run-model-benchmark.mjs`.

## Day 2 - Pairing and Tunnel Reliability

- [ ] Run `npm run dev:web` with default free tunnel behavior and confirm hosted `/code` URL is printed.
- [ ] Validate pairing lifecycle: code generation -> validation -> authenticated order.
- [ ] Verify `/connect` legacy alias still resolves correctly.
- [ ] Record tunnel failure diagnostics behavior with `cloudflared` absent.

## Day 3 - Data and Docs Hygiene

- [ ] Run FK audit queries from `supabase/fk_audit.sql`.
- [ ] Run dry-run cleanup queries from `supabase/cleanup_test_data.sql`.
- [ ] Reconcile docs for setup, architecture, and owner runbook references.
- [ ] Confirm run artifact paths remain ignored in git.

## Day 4 - Final Gates

- [ ] Backend standalone verification (`cd packages/remote-server && npm run start`).
- [ ] Frontend standalone verification (`cd packages/dashboard && npm run dev -- --host 127.0.0.1 --port 7534`).
- [ ] Production build + test gate:
  - `cd packages/dashboard && npm run build`
  - `cd ../.. && npm test`
- [ ] Execute phone pairing and one end-to-end demo order from mobile browser.
- [ ] Freeze checklist with pass/fail notes and ship/no-ship decision.
