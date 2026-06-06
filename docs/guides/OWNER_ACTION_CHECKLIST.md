# Owner Action Checklist (Next 4 Days)

## Infrastructure and Accounts

1. Verify `gh auth status` works for the account used in demos.
2. Verify `gh extension list` includes `github/gh-copilot`.
3. Ensure `cloudflared` is installed on demo machine.
4. Confirm Ollama daemon is running before demos.
5. Confirm required Ollama model is present:

```bash
ollama list
```

Expected minimum model for Soupz runtime guard:
- `qwen2.5:1.5b`

## Supabase and Data Hygiene

1. Review FK coverage and RLS in `supabase/schema.sql` + migrations.
2. Run dry-run queries in `supabase/cleanup_test_data.sql`.
3. Execute cleanup only after reviewing row counts.
4. Verify production tables after cleanup (especially `soupz_orders`, `soupz_commands`, `soupz_responses`).

## Product Quality Gates

1. Run backend standalone:

```bash
cd packages/remote-server
npm run start
```

2. Run frontend standalone:

```bash
cd packages/dashboard
npm run dev -- --host 127.0.0.1 --port 7534
```

3. Run build and tests:

```bash
cd packages/dashboard && npm run build
cd ../.. && npm test
```

4. Scan pairing flow from phone camera with hosted route:
- `https://soupz.vercel.app/code?code=...`

## Model Governance

1. Run benchmark pack:

```bash
node scripts/run-model-benchmark.mjs --agents codex,gemini,copilot,claude-code,kiro,ollama
```

2. Grade outputs with rubric in `docs/guides/MODEL_SELECTION_AND_GRADING.md`.
3. Choose default policy using evidence.
4. Save benchmark report artifact for launch claims.

## Launch Narrative Discipline

1. Only claim improvements supported by benchmark reports.
2. Keep architecture and README links synchronized.
3. Keep docs current whenever runtime behavior changes.
