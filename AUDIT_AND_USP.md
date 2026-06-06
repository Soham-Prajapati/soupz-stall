# Soupz - Brutally Honest Audit and USP

Date: April 1, 2026
Owner: Product + Core Runtime
Status: Production-hardening week in progress

---

## 1) Executive Truth

| Area | Current State | Verdict |
|---|---|---|
| Core value | Remote control for local AI coding stack works | Strong |
| Reliability | Much better than before, still has edge-case gaps | Medium |
| Mobile UX | Improved, still inconsistent in stacked overlays and dense states | Medium |
| Docs quality | Better than before, still uneven and partially duplicated | Medium |
| Market readiness | Demo-ready, not yet broad-market ready | Not done |

Short version:
- Yes, it is a real product.
- No, it is not yet a fully polished production SaaS.
- A focused four-day hardening sprint can materially improve launch confidence.

---

## 2) What Soupz Actually Is

Soupz is a local-first AI orchestration cockpit:
- daemon runs on the user machine
- browser UI controls prompt, file, git, and terminal workflows
- routing and fallback span multiple local providers (Gemini, Codex/Copilot, Claude Code, Ollama, Kiro)
- remote access is mediated by pairing + realtime relay

One-line pitch:
"Run your local AI coding stack from any browser, with orchestration and workspace control in one place."

---

## 3) Feature Status Matrix

### 3.1 Production-Ready or Near-Ready

| Capability | Evidence | Status |
|---|---|---|
| Pairing and one-time code flow | `/pair`, `/pair/current`, `/pair/validate`, deep-linking | Working |
| Order lifecycle + streaming | order create/track/cancel + WS chunks | Working |
| Workspace APIs | file tree/read/write, git panel, terminal panel | Working |
| Routing and fallback | prompt-aware selection + fallback chain | Working |
| Codex support | frontend + backend mappings, readiness, fallbacks | Working |
| Build and tests | dashboard build passes, test suite green | Working |

### 3.2 Working but Needs Hardening

| Capability | Gap | Priority |
|---|---|---|
| Pairing resilience across tunnel/network conditions | not enough user-facing diagnostics for failure reasons | High |
| Mobile layout consistency | z-index and overflow regressions still possible in dense states | High |
| Docs consistency | multiple architecture narratives; not all links lead to actionable runtime docs | High |
| Provider onboarding UX | some setup paths still confusing for non-technical users | Medium |
| CI safety rails | branch/release workflow can be tightened to reduce bad deploy risk | High |

### 3.3 Not Done (Do Not Oversell)

| Capability | Reality |
|---|---|
| Fully autonomous multi-agent swarm | not safe without strict guardrails + ownership model |
| Mass-market zero-friction setup | still power-user oriented |
| Perfect mobile IDE parity with desktop | not yet |

---

## 4) What Changed in This Hardening Cycle

| Workstream | What was fixed |
|---|---|
| Deep-link and pairing pathing | moved to hosted `/code` route, kept `/connect` compatibility |
| Route support | app now accepts both `/code` and `/connect` |
| Connect page bug | fixed QR mode code length guard (9 chars) |
| Docs architecture quality | added dedicated `docs/architecture/SYSTEM_ARCHITECTURE.md` and improved architecture docs |
| README docs routing | architecture link now points to concrete architecture spec |
| Supabase UX cleanup | removed browser credential-entry pattern in settings; env-first guidance |
| Mobile layering | increased and normalized overlay z-index in critical chat/command surfaces |
| Parallel execution planning | added four-day multi-session task plan in `TODO_TERMINALS.md` |

---

## 5) Remaining Risk Register

| Risk | User Impact | Mitigation |
|---|---|---|
| Pairing fails silently on some networks | onboarding drop-off | explicit diagnostics + endpoint attempt trace |
| Mobile layering regressions | controls become untappable or hidden | z-index convention + viewport regression tests |
| Docs drift from runtime | demo confusion and trust loss | canonical architecture doc + link lint checks |
| Unstable deploy flow | broken production pushes | release branch policy + pre-deploy smoke gate |
| Overpromising orchestration autonomy | reputational damage | claim policy tied to measurable benchmark runs |

---

## 6) USP (Defensible)

| USP Claim | Why It Is Defensible |
|---|---|
| Local-first execution | code and secrets remain on user machine |
| Multi-provider orchestration | not locked to one vendor/model |
| Browser-first remote control | phone/tablet support without local IDE install |
| End-to-end coding loop | prompt -> edit -> terminal -> git in one runtime |

What not to claim:
- "Replaces VS Code end-to-end"
- "Fully autonomous engineering without guardrails"
- "Works perfectly in every environment with zero setup"

---

## 7) Product Direction Decision (UI Identity)

Recommended hybrid:
- Keep VS Code familiarity in Code mode (editor/git/terminal behavior).
- Differentiate Chat/Builder/Teams as a distinct cockpit experience.

Why:
- Familiarity reduces learning cost.
- Distinct orchestration UX creates moat and product identity.

---

## 8) Four-Day Execution Plan

| Day | Focus | Outcome |
|---|---|---|
| Day 1 | Pairing reliability + diagnostics | failures become explainable and actionable |
| Day 2 | Routing governance + model benchmarks | transparent, evidence-backed model selection |
| Day 3 | Docs unification + architecture accuracy | demo-safe docs with clear technical narrative |
| Day 4 | Release gates + full dry-run demo | launch confidence with rollback path |

---

## 9) Ship Gate

| Gate | Current |
|---|---|
| Build green | Pass |
| Tests green | Pass |
| Pairing path verified (`/code`) | In progress this cycle |
| Mobile sanity on target widths | In progress this cycle |
| Docs coherence for demo | Improved, still being finalized |

Final verdict:
- Demo-ready: Yes.
- Production-market-ready: Not yet.
- Path to market-ready within one focused four-day sprint: Realistic.
