# Soupz Stall — Task Tracker

## ✅ Completed
- [x] feat: add Supabase relay — CLI now syncs all tasks to cloud in real-time (46366bc)
- [x] Delete _bmad/ folder
- [x] Delete bmad-export/
- [x] Delete one-time migration scripts
- [x] Rename .github/agents/ (20 files → soupz- prefix)
- [x] Rename .github/prompts/ (83 files → soupz- prefix)
- [x] Internal content replacement across 152 files
- [x] Fix remaining bmad refs in 10 files
- [x] WebSocket upgrade (packages/dashboard/)
- [x] Supabase relay wiring (CLI → DB)
- [x] THING 1: Fix last-output.html (Remove auto-refresh)
- [x] THING 2: Check git identity
- [x] THING 3: Update Rule #10 in GEMINI.md files
- [x] CLI: Fix outdated model warnings (gpt-4.1 update)
- [x] CLI: Fix triple status line (move to start)
- [x] CLI: Remove debug relay console.log
- [x] Dashboard: Create KitchenView.jsx (Pixel Art Dashboard)
- [x] Dashboard: Integrate KitchenView into App.jsx
- [x] Dashboard: Fix Vercel 404 (Build Output Investigation)
- [x] Supabase Relay Refactor (Class-based instantiation in Session)
- [x] Fix SyntaxError in Session.js (Duplicate statusLine)
- [x] Dashboard: Full UI rewrite with Trae/Lovable IDE cockpit aesthetic.
- [x] CLI: Fix Gemini output parser (stream-json → readable text)
- [x] Add 9 new agents: finance, ai-engineer, growth-hacker, mobile-dev, product-analyst, legal, cost-optimizer, claude-code, kiro
- [x] Add API provider system (Anthropic, OpenAI, Groq, OpenRouter, Gemini API)
- [x] Web IDE: Rebuild dashboard as Simple Mode + Pro Mode (Monaco editor)
- [x] Web IDE: File tree, git panel, auth screen, Supabase relay
- [x] Web IDE: Vercel deployment config
- [x] Agent type: migrate 'persona' → 'agent' terminology

- [x] Remove redundant agents (brainstorm, quick-flow, design-thinking-coach, workflow-builder, forager, module-builder, tea, scrum, master) — 57 → 42 specialists
- [x] Delete BMAD ghost agents from ~/.soupz-agents/agents/
- [x] Rewrite bin/soupz.js as daemon starter (ditch interactive CLI loop)
- [x] Wire daemon commands: FILE_TREE, FILE_READ, FILE_WRITE, GIT_STATUS, GIT_DIFF, GIT_STAGE, GIT_COMMIT, GIT_PUSH, AGENT_PROMPT
- [x] Supabase schema: soupz_commands + soupz_responses tables with RLS + auto-cleanup
- [x] npx soupz pairing flow: generates code, opens browser to soupz.app/connect?code=...
- [x] Fix node-pty as optional dep (daemon starts even without it)

## 🚧 In Progress / TODO Next
- [ ] Landing page (marketing site — soupz.app)
- [ ] Connect page on web app: /connect?code=... (enter code, pair device)
- [ ] npm publish: test end-to-end npx soupz flow
- [ ] Supabase: apply schema.sql (run in Supabase SQL editor)

## 📋 Backlog
- [/] Browser extension bridge to CLI
- [ ] Fleet status in dashboard timeline
- [ ] Supabase sync for MemoryPool
- [ ] AST/WASM agent booster
- [ ] Mobile-responsive polish for Simple Mode
- [ ] Offline queue (SQLite)
