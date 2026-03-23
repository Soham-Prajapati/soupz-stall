# Soupz - Next Phase Tasks

## 🔥 HIGHEST PRIORITY (Core Logic Completion)
- [ ] **Implement REAL Sub-Agent Synthesis:** The current `/fleet` command just runs background CLIs and stores their output. It DOES NOT summarize or feed back into a main agent. We must connect the logic from `packages/dashboard/src/lib/teams.js` into the actual `src/session.js` backend so a coordinator agent actually reads the sub-agent outputs and synthesizes them.
- [ ] **Mobile Source Control Panel:** Implement the Git UI (diffs, commit generation, push) specifically for the mobile dashboard so the user can review and commit code from their phone during class.
- [ ] **Smart Agent Routing (Cost/Tier Optimization):** Ensure the orchestrator actually respects the user's free tiers (GitHub Student Pro, Gemini Pro, Kiro, Ollama) and automatically fails over when limits are hit.

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

## Auth & Connectivity
- [/] Investigate frequent logouts and session persistence.
- [ ] Add session auto-refresh mechanism for Supabase.
- [ ] Improve daemon token persistence.
