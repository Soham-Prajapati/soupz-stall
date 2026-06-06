# Soupz Claim Policy: 5x/10x Efficiency

*Updated: April 3, 2026*

This document defines the evidence required to make specific efficiency claims for the Soupz Cockpit and its orchestrator.

## 📊 Claim Tiers

| Claim | Use Case | Required Evidence |
|---|---|---|
| **3x Speedup** | Standard single-agent tasks (e.g., refactoring a single file). | Baseline manual time vs Soupz execution time (including planning). |
| **5x Speedup** | Multi-agent orchestration (e.g., building a new feature with parallel workers). | Successful completion of `benchmarks/hackathon_throughput.json` with a speedup ratio >= 5.0. |
| **10x Efficiency** | High-complexity system builds (e.g., architecting and scaffolding a full microservice). | Requires verified **Zero-Touch** execution (no manual intervention in the first 10 minutes). |

---

## 🧪 Verification Protocol

1. **Deterministic Run**: The task must be repeatable with similar performance metrics (+/- 10%).
2. **Quality Audit**: The output must score >= 85 on the `ORDER_SCORECARD.md` (manual or AI-graded).
3. **Traceability**: Every claim must be backed by a run artifact in `.soupz/output/` or `benchmarks/`.

---

## 🚫 Prohibited Claims

- **Never claim "Zero Bugs"**: AI orchestration is probabilistic.
- **Never claim "Instant"**: Always use "Real-time" or specific latency metrics (e.g., "Plan generated in < 15s").
- **Never use "BMAD"**: The project identity is **Soupz Stall** or **Soupz Cockpit**.

---

## 📈 Evidence Artifacts

When publishing results (e.g., to Discord or a pitch deck), include a link to the corresponding `hackathon_throughput.json` entry or the full trace from a Deep Run.
