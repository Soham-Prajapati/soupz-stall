# Soupz - Next Phase Tasks

## 🔥 HIGHEST PRIORITY (Core Logic Completion)
- [x] **Implement REAL Sub-Agent Synthesis:** The current `/fleet` command just runs background CLIs and stores their output. It DOES NOT summarize or feed back into a main agent. We must connect the logic from `packages/dashboard/src/lib/teams.js` into the actual `src/session.js` backend so a coordinator agent actually reads the sub-agent outputs and synthesizes them.
	- Delivered: `spawnFleet` now waits for all hidden workers, synthesizes coordinated output, logs synthesis into session history, and exposes run introspection (`/fleet runs`, `/fleet result`, `/fleet result <run-id>`).
- [x] **Mobile Source Control Panel:** Implement the Git UI (diffs, commit generation, push) specifically for the mobile dashboard so the user can review and commit code from their phone during class.
- [/] **Smart Agent Routing (Cost/Tier Optimization):** Ensure the orchestrator actually respects the user's free tiers (GitHub Student Pro, Gemini Pro, Kiro, Ollama) and automatically fails over when limits are hit.
	- Baseline shipped: daemon now tracks temporary cooldowns for rate-limited agents and auto-fails over in single-run mode when stderr indicates 429/quota/rate-limit failures.
- [x] **Settings Sync to Supabase:** Key dashboard settings now hydrate from `soupz_profiles.settings` at sign-in and sync periodically from local storage for cross-device continuity.

## Deep Orchestration Hardening (March 2026)
- [x] Prevent weak-model assignment on hard lanes (developer/architect/security/finance).
- [x] Add stricter runtime readiness checks for subscription/auth-sensitive CLIs (Claude Code probe + Copilot auth check).
- [x] Make synthesis consume `SHARED_MEMORY.md` context.
- [x] Add specialist suffix to worker artifact filenames for clearer auditability.
- [x] Enable nested deep-worker delegation: parent workers can spawn nested sub-agents and nested mini-team synthesis.
- [x] Remove deep-worker timeout enforcement (workers/nested/synthesis no longer auto-killed by timeout).
- [x] Add structured shared-memory schema (claims, assumptions, sources, confidence) instead of raw text dumps.
- [x] Preserve lifecycle events while pruning only noisy deltas; make event cap configurable per deployment.
- [x] Surface explicit "not installed vs installed-not-authenticated vs subscription/quota" in UI agent readiness badges.
- [x] Add strict citation mode for research/finance lanes (reject uncited numeric claims).
- [x] Add "mixed-mode" toggle in Core Console to intentionally allow/disallow cross-agent fanout in deep mode.
- [x] Add Deep Run scorecard artifact (`ORDER_SCORECARD.md`) with per-lane quality, risk, and source coverage.

## Landing Page Improvements
- [x] Clean up `LandingPage.jsx` (remove variants: Agentic, Clay, 3D) making it solely `LandingMorphism`.
- [x] Add background elements (colorful orbs, gradients, curves) to `LandingMorphism` to enhance glassmorphism refraction.
- [x] Reposition phone and terminal elements in `LandingMorphism` for better visibility.
- [x] Increase breathing room and 'bridge' height on the landing page.
- [x] Add session logging to debug authentication issues.
- [x] Remove secondary theme switchers from the landing page to focus on glassmorphism.
- [x] Space out the bento box grid vertically to reduce clutter.
- [x] Adjust the heights/transforms of the Phone Mockup and Terminal to ensure they aren't uncomfortably cut off.
- [x] Populate the top Navbar with more links (e.g. Features, OSS, Documentation, Pricing) so it doesn't look empty.
- [x] Add conversion-focused CTA block for npm package and canonical GitHub repo.

## Input/Shortcut Parity
- [x] Add platform-specific keyboard shortcut rendering in shortcuts modal (macOS vs Windows/Linux labels).
- [x] Publish keyboard parity validation guide (`docs/guides/KEYBOARD_PARITY.md`).

## Auth & Connectivity
- [/] Investigate frequent logouts and session persistence.
- [x] Add session auto-refresh mechanism for Supabase.
- [x] Improve daemon token persistence.
