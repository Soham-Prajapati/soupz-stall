# Soupz Agents

## What This Is
Soupz is a hosted web IDE (soupz.vercel.app) + local daemon (`npx soupz`) that bridges a user's laptop to the browser. Think Claude Code / Cursor but accessible from any device (phone, tablet, another PC).

## Architecture
- **Web app** (Vercel): `packages/dashboard/` — React 18 + Vite + Tailwind + Framer Motion
- **Local daemon**: `packages/remote-server/` — Node.js ESM, Express, node-pty, WebSocket
- **Relay**: Supabase Realtime between web app and daemon
- **Auth**: Device pairing flow (8-digit OTP or QR code → soupz.vercel.app/connect?code=XXX → approve)

## Core Flow
1. User runs `npx soupz` on their machine → Express server starts on port 7533 (configurable via SOUPZ_REMOTE_PORT)
2. Terminal shows 8-digit pairing code (auto-refreshes every 5 min)
3. User opens soupz.vercel.app on phone/browser → enters code OR scans QR → paired
4. Web app sends prompts to daemon via WS (local) or Supabase Realtime (remote)
5. Daemon spawns CLI agents (Claude Code, Gemini, Copilot, Kiro, Ollama) and streams responses back

## Tech Stack
- Frontend: React 18, Vite, Tailwind 3, Framer Motion, Monaco Editor, Recharts, Lucide icons, qrcode.react
- Backend: Node.js ESM, Express, node-pty, ws, @supabase/supabase-js
- Hosting: Vercel (web app only — daemon is always local)
- AI agents: Copilot CLI, Gemini CLI, Claude Code, Kiro, Ollama (local models)
- STT: Sarvam AI (cross-browser), webkitSpeechRecognition (Chrome fallback)
- TTS: Kokoro-82M neural (ONNX/WASM), browser SpeechSynthesis (fallback)

## Key Frontend Files
- `packages/dashboard/src/App.jsx` — Main app shell, theme switcher (12 themes), mode toggle (Chat/IDE), command palette (Cmd+Shift+P)
- `packages/dashboard/src/components/simple/SimpleMode.jsx` — Chat mode: message list, STT, neural TTS, agent selector, build mode picker, compact mode support
- `packages/dashboard/src/components/pro/ProMode.jsx` — IDE mode: Monaco editor, file tree, git panel, extensions, settings, resizable panels, terminal, breadcrumbs
- `packages/dashboard/src/components/pro/TerminalPanel.jsx` — Integrated terminal panel (resizable)
- `packages/dashboard/src/components/git/GitPanel.jsx` — Source control: staging, diffs, commit with Soupz co-author tag
- `packages/dashboard/src/components/shared/StatusBar.jsx` — VS Code-style status bar with agent popup, notifications
- `packages/dashboard/src/components/shared/CommandPalette.jsx` — Command palette (Cmd+Shift+P or Cmd+K)
- `packages/dashboard/src/components/shared/ExtensionsMarketplace.jsx` — Extension packs (agent packs, tools, workflows)
- `packages/dashboard/src/components/shared/StatsPanel.jsx` — Gamification: achievements, streaks, usage charts
- `packages/dashboard/src/components/shared/MCPPanel.jsx` — MCP server configuration
- `packages/dashboard/src/components/connect/ConnectPage.jsx` — Pairing page with OTP code input + QR code tab
- `packages/dashboard/src/components/landing/LandingPage.jsx` — Landing page
- `packages/dashboard/src/lib/daemon.js` — Daemon client (WS + REST + Supabase relay), default port 7533
- `packages/dashboard/src/lib/agents.js` — Agent definitions (CLI_AGENTS, SPECIALISTS, BUILD_MODES)
- `packages/dashboard/src/lib/routing.js` — Smart routing: auto-picks best free agent, daemon port 7533
- `packages/dashboard/src/lib/learning.js` — Usage tracking, adaptive thresholds, custom agent auto-promotion
- `packages/dashboard/src/hooks/useKokoroTTS.js` — On-device neural TTS with browser fallback
- `packages/dashboard/src/index.css` — 12 themes via CSS custom properties

## Key Backend Files
- `packages/remote-server/src/index.js` — Full daemon: pairing, auth, WS streaming, REST API (fs, git, agent spawning), Supabase relay, terminal (node-pty), MCP env passthrough

## Important Ports
- Daemon: 7533 (set via SOUPZ_REMOTE_PORT in .env)
- Dashboard dev: 7534 (vite.config.js) or 5173 (via dev:web script)
- Default fallback: 7070 (remote server DEFAULT_PORT, only used if env not set)
- Vite proxy: forwards /api/*, /health, /command, /pair to daemon

## Commands
```bash
# Full stack dev (recommended)
npm run dev:web                # Starts daemon + Vite dev server, auto-pairs

# Individual
cd packages/dashboard && npm run dev     # Vite dev server only
cd packages/dashboard && npm run build   # Production build
npx soupz                                # Starts daemon + opens soupz.vercel.app
```

## Theming
12 themes: dark, dim, midnight, light, monokai, nord, dracula, catppuccin, tokyo-night, rose-pine, solarized, github-dark. All use `--*-ch` space-separated RGB channel vars (e.g. `--accent-ch: 99 102 241`) so Tailwind opacity modifiers like `bg-accent/10` work at runtime.

## Conventions
- No emojis in code or responses unless explicitly asked
- Concise responses, no fluff
- Use Lucide icons consistently
- All state persisted in localStorage (no server-side state for UI prefs)
- CSS variables for theming, never hardcoded colors in components
- `font-ui` for UI text, `font-mono` for code
- Agent IDs are kebab-case strings (e.g. 'claude-code', 'ai-engineer')
- Git commits include `Co-Authored-By: Soupz <agent@soupz.vercel.app>`
- Custom checkboxes (not native `<input type="checkbox">`) for theme consistency
- Chat panel supports `compact` prop for narrow widths (< 360px)
- Dropdowns use z-[100] to escape overflow containers

## What's Implemented
- Chat mode + IDE mode with toggle
- 5 CLI agents + 30 specialists with smart routing
- File editing (Monaco), file tree, git operations
- Extensions marketplace (10 packs, hardcoded)
- Voice input (Sarvam AI + webkitSpeechRecognition fallback)
- Neural TTS (Kokoro) + browser fallback
- VS Code-style status bar with agent usage popup
- Command palette (Cmd+Shift+P / Cmd+K)
- Resizable panels (sidebar, chat, terminal)
- QR code on connect page
- Breadcrumbs above editor
- Terminal panel
- Gamification / achievements
- MCP server configuration with preset library (Google Stitch, Nano Banana, Excalidraw, Canva, etc.)
- 12 color themes
- Smart agent fallback chain (handles users with limited agent access — only Gemini, only Copilot, etc.)
- Agent availability detection with detailed status (installed vs ready vs running)
- Sub-agents system (isolated task contractors: code reviewer, test writer, researcher, etc.)
- Agent teams (collaborative workflows: full review, feature builder, UX audit, ship readiness)
- Lazy-loaded heavy components (Monaco, Git, Extensions, Stats, MCP panel)
- Auth: Google + GitHub only (Apple removed)
- Auto file tree loading for local connections

## Key Library Files
- `packages/dashboard/src/lib/teams.js` — Sub-agents and agent teams definitions, orchestration engine
- `packages/dashboard/src/lib/routing.js` — Smart routing with availability-aware fallback chain
- `packages/dashboard/src/lib/agents.js` — CLI agent + specialist definitions, install guides

## UI/UX Design Rules
1. Limited color palette — accent + semantic only, no decorative colors
2. Fewer font weights — 400, 500, 600 only (no 300/700)
3. Generous spacing — 8px between items, 16px between groups, 24px between sections
4. Borders over shadows — borders for structure, shadows only on overlays
5. No decorative shapes — every element serves a purpose
6. Consistent radius scale — sm(4), md(6), lg(8), xl(12)

## What's NOT Implemented (see FUTURE_PROMPTS.md)
- Real git branch display (hardcoded "main")
- File execution (runFile)
- Split editor
- RAG memory system
- Keyboard shortcut customization
- Project .soupz config files
- Extensions as real agent configs (currently hardcoded)
