# PROMPTS.md — Soupz Handoff Document

> This file is the single source of truth for any AI session (Claude, Gemini, Copilot, or similar)
> continuing work on the Soupz project. Read this entirely before touching any code.
> Last updated: 2026-03-20

---

## TABLE OF CONTENTS

1. [Quick Start — Read This First](#1-quick-start--read-this-first)
2. [What Is Soupz](#2-what-is-soupz)
3. [Project Structure (Exhaustive)](#3-project-structure-exhaustive)
4. [Design System](#4-design-system)
5. [Architecture Decisions](#5-architecture-decisions)
6. [What Is Done](#6-what-is-done)
7. [What Is NOT Done](#7-what-is-not-done)
8. [Key Technical Patterns](#8-key-technical-patterns)
9. [Current Bugs / Known Issues](#9-current-bugs--known-issues)
10. [Copy-Paste Prompts for Each Remaining Task](#10-copy-paste-prompts-for-each-remaining-task)
11. [Prompt Templates — Using Soupz's Own Specialists](#11-prompt-templates--using-soupzs-own-specialists)
12. [Running Locally](#12-running-locally)
13. [Deployment](#13-deployment)
14. [Environment Variables](#14-environment-variables)
15. [Supabase Schema Reference](#15-supabase-schema-reference)
16. [Daemon API Reference](#16-daemon-api-reference)
17. [localStorage Keys Reference](#17-localstorage-keys-reference)
18. [Agent System Reference](#18-agent-system-reference)

---

## 1. QUICK START — READ THIS FIRST

### Who This Is For

You are an AI assistant helping build Soupz — a web IDE where users run `npx soupz` on
their machine and then control AI coding agents (Claude Code, Gemini CLI, GitHub Copilot,
Kiro, Ollama) from their browser or phone. Think "Claude Code but with a beautiful web UI
and phone support."

### The Single Most Important Concept

**The daemon is the brain. The web app is the face.**

- `npx soupz` starts a local Express + WebSocket server on port 7070 (the daemon)
- The web app at `packages/dashboard/` connects to it either directly (localhost) or via
  Supabase Realtime (when accessing from phone/remote)
- All AI agent execution happens on the USER'S machine, never on Vercel servers
- The web app is a pure SPA — it has zero server-side execution

### In 90 Seconds: How a Prompt Gets Executed

```
1. User types prompt in SimpleMode (web browser on phone)
2. sendAgentPrompt() in daemon.js inserts row into soupz_commands (Supabase)
3. Daemon (running on laptop) is subscribed to soupz_commands via Supabase Realtime
4. executeCommand() picks it up, calls runAgentPrompt()
5. runAgentPrompt() spawns: node bin/soupz.js ask claude-code "the prompt"
6. Stdout/stderr collected → stored in soupz_responses (Supabase)
7. Web app subscribed to soupz_responses — receives result and renders it
```

**The gap**: Steps 5-7 are NOT streaming yet. The agent runs to completion, THEN the full
output appears. Streaming chunks is the #1 priority work remaining.

### Orientation Checklist for a New Session

Before writing any code, verify:
- [ ] You understand the two transport paths: direct HTTP (localhost) vs Supabase relay (remote)
- [ ] You know the daemon lives at `/packages/remote-server/src/index.js`
- [ ] You know the web app entry point is `/packages/dashboard/src/App.jsx`
- [ ] You know `daemon.js` (lib) is the web-side API client, NOT the daemon itself
- [ ] The design system is dark: `#0C0C0F` background, `#6366F1` accent (indigo)
- [ ] Icons are ALWAYS Lucide React — never emojis in JSX

---

## 2. WHAT IS SOUPZ

### Elevator Pitch

Soupz is a web-based IDE that lets you use any AI coding agent (Claude Code, Gemini, Copilot,
Kiro, Ollama) from your browser or phone — while the actual code execution happens on your
laptop. You don't install a desktop app. You don't give a cloud service access to your files.
You run one command (`npx soupz`) and your phone becomes a powerful coding interface.

### Why This Matters

- **Claude Code has no mobile UI** — Soupz fixes that
- **Multi-agent** — switch between Claude, Gemini, Copilot without changing tools
- **Privacy** — code runs locally, Supabase only relays the messages
- **Voice input** — dictate prompts on phone (Web Speech API)
- **Phone in lecture** — primary use case is a student coding from their phone discreetly

### Target Audience

Not hobbyists. Target: investors, VPs of engineering, top MNC recruiters. The aesthetic
must be Linear / Cursor / Vercel quality — dark, opinionated, professional.

### Key Differentiators

1. Browser/phone access to Claude Code (unique — no one else does this)
2. Multi-agent in one UI (Claude, Gemini, Copilot, Kiro, Ollama)
3. Specialist overlay system (30+ specialist modes layered on any CLI agent)
4. Voice input as first-class feature
5. Zero cloud code execution — your laptop is the compute

---

## 3. PROJECT STRUCTURE (EXHAUSTIVE)

```
/soupz-agents/                          ← git root
├── bin/
│   └── soupz.js                        ← CLI entry point (npx soupz runs this)
├── src/
│   ├── env.js                          ← dotenv config loader
│   ├── config.js                       ← directory setup (ensureDirectories)
│   ├── auto-import.js                  ← auto-imports agent definitions on startup
│   └── agents/
│       └── registry.js                 ← AgentRegistry class (finds installed CLIs)
├── packages/
│   ├── remote-server/
│   │   └── src/
│   │       └── index.js                ← THE DAEMON (1260 lines, Express + WS + Supabase)
│   ├── dashboard/                      ← THE WEB APP (React SPA)
│   │   ├── src/
│   │   │   ├── main.jsx                ← Vite entry, mounts <App />
│   │   │   ├── App.jsx                 ← Root: auth, routing, daemon health, mode toggle
│   │   │   ├── index.css               ← CSS variables + global styles
│   │   │   ├── KitchenView.jsx         ← Legacy pixel art dashboard (not in main routing)
│   │   │   ├── hooks/
│   │   │   │   └── useRoute.js         ← Client-side router (pushState-based)
│   │   │   ├── lib/
│   │   │   │   ├── agents.js           ← CLI_AGENTS, SPECIALISTS, BUILD_MODES arrays
│   │   │   │   ├── cn.js               ← Tailwind clsx utility
│   │   │   │   ├── daemon.js           ← HTTP/Supabase client for daemon commands
│   │   │   │   └── supabase.js         ← Supabase client (null if no env vars)
│   │   │   └── components/
│   │   │       ├── auth/
│   │   │       │   └── AuthScreen.jsx  ← GitHub OAuth + email/pw + skip-locally
│   │   │       ├── connect/
│   │   │       │   └── ConnectPage.jsx ← 9-character alphanumeric pairing code entry (/connect route)
│   │   │       ├── simple/
│   │   │       │   └── SimpleMode.jsx  ← Mobile-first chat UI (PRIMARY UI)
│   │   │       ├── pro/
│   │   │       │   └── ProMode.jsx     ← Monaco editor 3-panel IDE
│   │   │       ├── filetree/
│   │   │       │   └── FileTree.jsx    ← File browser with Lucide icons
│   │   │       ├── git/
│   │   │       │   └── GitPanel.jsx    ← Stage/unstaged/diff/commit/push
│   │   │       ├── agents/             ← (empty, agent UI is inline in SimpleMode)
│   │   │       ├── daemon/             ← (empty, daemon logic is in lib/daemon.js)
│   │   │       ├── layout/             ← (empty, layout is inline in App.jsx)
│   │   │       └── ui/                 ← (empty, shared UI components TBD)
│   │   ├── index.html
│   │   ├── vite.config.js
│   │   ├── tailwind.config.js          ← Dark theme tokens
│   │   └── package.json
│   ├── browser-extension/              ← Chrome extension (bridges browser → daemon)
│   └── mobile-ide/                     ← Expo React Native app (future)
├── defaults/
│   └── agents/                         ← Agent definition .md files (system prompts)
├── supabase/
│   └── migrations/                     ← SQL migration files
├── vercel.json                         ← Vercel config (build cmd, SPA rewrite)
├── tasks.md                            ← Task tracker (completed / TODO)
└── BRAND_IDENTITY.md                   ← Brand guidelines
```

### Most Important Files (In Order of Importance)

1. `/packages/remote-server/src/index.js` — The daemon. Everything runs through here.
2. `/packages/dashboard/src/App.jsx` — Root component. Auth, routing, daemon state.
3. `/packages/dashboard/src/components/simple/SimpleMode.jsx` — Primary UI.
4. `/packages/dashboard/src/lib/daemon.js` — Web-side command sender.
5. `/packages/dashboard/src/lib/agents.js` — All agent/specialist definitions.
6. `/packages/dashboard/tailwind.config.js` — Color tokens used everywhere.
7. `/bin/soupz.js` — npx entry point, starts daemon.

---

## 4. DESIGN SYSTEM

### Color Palette (Exact Values)

These are used in Tailwind classes (`bg-bg-base`, `text-text-pri`, etc.) and CSS variables:

```
Background:
  bg-base:     #0C0C0F   ← deepest background (body, editor)
  bg-surface:  #111114   ← panels, nav, sidebars
  bg-elevated: #16161A   ← inputs, buttons, cards
  bg-overlay:  #1A1A1F   ← hover states, dropdown backgrounds

Borders:
  border-subtle: #1E1E24 ← default borders
  border-mid:    #2A2A33 ← stronger borders, hover
  border-strong: #3A3A47 ← focus states, active borders

Accent (Indigo):
  accent:        #6366F1 ← primary CTAs, focus, active states
  accent-hover:  #4F46E5 ← hover on accent buttons

Semantic:
  success:  #22C55E  ← git added, connected, online
  warning:  #F59E0B  ← git modified, offline, code pairing
  danger:   #EF4444  ← git deleted, errors, voice recording

Text:
  text-pri:   #F0F0F5  ← primary text, labels
  text-sec:   #8B8B9A  ← secondary text, descriptions
  text-faint: #4A4A5A  ← muted text, placeholders
```

### Typography

```css
font-ui:   'Inter', -apple-system, sans-serif      (all UI text)
font-mono: 'JetBrains Mono', 'Fira Code', monospace (code, paths, diffs)
```

### Icons

ALWAYS use Lucide React. Import from 'lucide-react'. NEVER use emojis in JSX.

Common icon sizes used:
- 10-11px: inline status dots, tiny indicators
- 12-13px: sidebar icons, inline icons in text
- 14-16px: button icons
- 18-20px: activity bar icons
- 24-32px: empty state illustrations

### Tailwind Class Conventions

```jsx
// Button primary (CTA)
className="bg-accent hover:bg-accent-hover text-white px-3 py-1.5 rounded-md text-sm font-medium font-ui transition-colors"

// Button ghost
className="text-text-faint hover:text-text-sec hover:bg-bg-elevated transition-colors rounded-md px-2 py-1 text-xs font-ui"

// Card / panel
className="bg-bg-surface border border-border-subtle rounded-xl"

// Input
className="bg-bg-elevated border border-border-subtle rounded-md text-text-pri placeholder:text-text-faint focus:border-accent focus:outline-none transition-colors"

// Monospace text (paths, code)
className="font-mono text-xs text-text-sec"
```

### Layout Dimensions

- Navbar height: `h-11` (44px)
- Sidebar width (ProMode): `w-60` (240px)
- Activity bar width: `w-12` (48px)
- Chat panel width: `w-80` (320px)
- Status bar height: `h-[22px]`
- Mobile breakpoint: `768px` (md)

---

## 5. ARCHITECTURE DECISIONS

### Why Supabase Relay?

The core problem: the web app runs at `soupz.app` (Vercel, HTTPS). The daemon runs at
`http://localhost:7070`. Browser CORS and mixed-content policies prevent direct calls from
the hosted app to localhost.

**Solutions considered:**
1. Proxy through Vercel functions → latency, can't stream, cold starts
2. WebRTC peer-to-peer → complex, NAT traversal issues
3. Supabase Realtime as relay → simple, real-time, free tier works

**Chosen: Supabase relay.** Web inserts a command row, daemon subscribes via Realtime,
executes, inserts a response row, web receives it via Realtime subscription. The entire
round-trip is database-mediated.

**Local exception**: when the browser is on `localhost` (developer's machine), `daemon.js`
falls back to direct HTTP calls to `http://localhost:7070` instead of Supabase. This means
the dev experience works even without Supabase configured.

### Why Not Next.js?

The dashboard is a pure Vite React SPA. Reasons:
- No server-side execution needed (all compute is on user's machine)
- Faster Vercel cold starts (static file serving only)
- Simpler to understand and modify
- Monaco Editor and Web Speech API work better in pure browser context

### Why Two UI Modes (Simple / Pro)?

- **SimpleMode**: Chat-first, works great on mobile/phone. Primary use case.
- **ProMode**: Monaco editor + file tree + git panel. For desktop power users.
- Mobile automatically forces SimpleMode (check at `window.innerWidth < 768`)

### Why localStorage for Chat History?

Chat history is stored in `localStorage` (`soupz_chat_history`), limited to last 100
messages. This was a deliberate tradeoff:
- No backend required for history
- Instant load (no network fetch)
- Privacy (stays on device)
- Downside: not synced across devices

### Why 9-Character Alphanumeric Pairing Code?

Inspired by GitHub Device Auth flow. The daemon generates a cryptographically random
9-character alphanumeric code (using `crypto.randomBytes` mapped to safe charset, no ambiguous
characters). The code:
- Is displayed in terminal when daemon starts
- Auto-refreshes every 5 minutes
- Is single-use (consumed on pair, deleted from map)
- The URL is opened automatically: `soupz.app/connect?code=12345678`

### Why Specialists vs CLI Agents?

There are two layers:
- **CLI Agents**: Real executables (`claude`, `gemini`, `gh copilot`, `kiro-cli`, `ollama`)
- **Specialists**: Expert modes (`@architect`, `@devops`, `@designer`, etc.) that are
  personality overlays on top of any CLI agent

When a user picks `@architect`, the system routes through whatever CLI agent is available
(e.g., claude-code) but prepends the architect's system prompt from `/defaults/agents/`.

### Why No TypeScript?

The project uses plain JavaScript (`.jsx`, `.js`). Reason: the project started as a quick
prototype and TypeScript adds friction for fast iteration. The codebase is small enough that
type safety is not the bottleneck. Can be migrated later if needed.

### Why node-pty is Optional?

`node-pty` (terminal emulator) requires native compilation. It's not available in all
environments (especially CI and some npm setups). The daemon wraps the import in try/catch
and disables terminal features gracefully if not installed. This keeps `npx soupz` working
out of the box.

---

## 6. WHAT IS DONE

Progress: approximately 55% complete.

### Infrastructure
- Full daemon architecture (Express + WebSocket + Supabase listener) in one file
- OTP pairing system (9-character alphanumeric code, 5-min expiry, single-use, session tokens)
- WebSocket auth handshake (10-second timeout, token OR code)
- File system API (tree, read, write) with path traversal protection
- Git API (status, diff, stage, commit, push)
- System health monitoring (CPU, memory, swap, disk)
- Supabase relay (commands table → daemon → responses table)
- Session management (24-hour expiry, revocation)

### Web App
- Full React SPA with Vite + Tailwind
- Client-side router (`useRoute.js`) using `pushState`
- Auth: GitHub OAuth + email/password + skip-locally (all via Supabase)
- `ConnectPage` — 9-character alphanumeric entry with char-by-char inputs, paste support, auto-connect
- `AuthScreen` — tabs for login/signup, GitHub OAuth, local skip button
- `SimpleMode` — full chat UI with agent selector, build mode picker, voice input,
  markdown rendering (code blocks, bold, inline code), message copy, clear history
- `ProMode` — 3-panel IDE: activity bar + sidebar (FileTree/GitPanel) + Monaco + chat
- `FileTree` — recursive tree with Lucide file-type icons, search, changed-file dots
- `GitPanel` — staged/unstaged sections, diff viewer (colorized), commit textarea, push
- `App.jsx` — top nav (mode toggle, daemon status, user email, sign out), offline banner
- Monaco Editor with custom `soupz-dark` theme (exact hex values matching design system)
- Design tokens in both `tailwind.config.js` and `index.css` (CSS variables)
- Agent dropdown with CLI Agents / Specialists tabs, category filtering
- Build mode selector (Quick Build / Planned Build / Chat)

### CLI
- `bin/soupz.js` — daemon starter, version flag, agents list, auth subcommands
- `soupz agents` — lists available CLI agents with availability dots
- `soupz auth status|login|logout` — per-agent auth management
- Auto-import of agent definitions on startup

### Deployment
- Vercel config (`vercel.json`) — custom build command, SPA rewrite, security headers
- Deployed at: `https://soupz-agents-sohams-projects-4080e0ee.vercel.app`
- Supabase RLS migrations applied

---

## 7. WHAT IS NOT DONE

Progress: approximately 45% remaining.

### Priority 1 — Daemon Streaming (Highest Impact)

**Problem**: `runAgentPrompt()` in the daemon waits for the entire agent process to finish,
then returns the full output as one blob. The web UI shows a spinner, then dumps all text.
This feels bad, especially for long tasks.

**What needs to happen**: As the agent process emits stdout chunks, they should be pushed to
the web in real time. Two options:
1. Insert chunk rows into `soupz_output_chunks` table (already defined in schema)
2. Broadcast chunks via WebSocket to connected clients

See Section 10 for the exact implementation prompt.

### Priority 2 — InteractiveQuestions Component (MCQ UI)

Claude Code sometimes asks clarifying questions like "Which approach: REST, GraphQL, or
gRPC?" Soupz needs to detect this in the agent output, render it as clickable cards, and
resume the agent with the user's answer.

The format is JSON embedded in the output:
```
[SOUPZ_Q]{"questions":[{"id":"q1","text":"Which approach?","multi":false,"options":["REST","GraphQL","gRPC"]}]}[/SOUPZ_Q]
```

SimpleMode needs to detect this pattern, extract the JSON, render cards, collect answers,
and send a follow-up prompt.

### Priority 3 — Ollama Smart Routing

When `agentId === 'auto'`, currently the code doesn't have real logic for picking an agent.
It should:
1. POST to `http://localhost:11434/api/generate` with model `qwen2.5:0.5b`
2. Ask it to pick the best agent from the available list
3. Fall back to keyword matching in `agents.js`
4. Final fallback: `claude-code`

### Priority 4 — File Tree Loading on Connect

The file tree is defined in `App.jsx` state but never actually populated. The daemon has a
full `FILE_TREE` command handler. The wire-up is missing: after daemon connects, call
`getFileTree()` and pipe the result into `setFileTree`.

The issue: `handleDaemonResponse()` in `App.jsx` has the handler for `FILE_TREE` responses
but `getFileTree()` is never called on connect.

### Priority 5 — Landing Page

`soupz.app` needs a marketing landing page. Currently the root shows the app (requires
auth). The landing page should be investor-grade: hero with terminal animation, feature
highlights, demo video embed, waitlist/pricing CTA.

### Priority 6 — npm Publish Testing

The npm package (`npx soupz`) flow has never been tested end-to-end as a published package.
Need to verify:
- `package.json` has correct `main`, `bin`, `files` fields
- All imports resolve correctly when installed as a package
- `node_modules` is not bundled

### Priority 7 — Task Queue

Users should be able to queue multiple prompts and have them run sequentially. Currently
each prompt is independent. A queue system would:
- Show queued items in the UI
- Run them one at a time
- Show results as each completes

### Priority 8 — Project Memory (.soupz.md)

When the daemon starts in a directory, it should auto-read `.soupz.md` if it exists and
prepend its content to every agent prompt. This gives agents project context automatically.

### Priority 9 — Ollama Integration

The Ollama agent (`binary: 'ollama'`) is defined in `agents.js` but not actually implemented.
Need to wire it: `POST http://localhost:11434/api/generate` with streaming enabled.

---

## 8. KEY TECHNICAL PATTERNS

### Pattern: Two-Path Daemon Communication

Every command in `daemon.js` follows this pattern:

```javascript
// lib/daemon.js
export async function sendCommand(type, payload, userId) {
  const commandId = crypto.randomUUID();

  if (supabase && userId) {
    // REMOTE PATH: Insert into Supabase, daemon picks it up via Realtime
    await supabase.from('soupz_commands').insert({
      id: commandId, user_id: userId, type, payload,
      status: 'pending', created_at: new Date().toISOString(),
    });
    return commandId;
  } else {
    // LOCAL PATH: Direct HTTP to localhost:7070
    await fetch(`${LOCAL_DAEMON_URL}/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: commandId, type, payload }),
    });
    return commandId;
  }
}
```

### Pattern: Daemon Response Subscription

In `App.jsx`, the app subscribes to daemon responses and routes them to state setters:

```javascript
// App.jsx
useEffect(() => {
  if (!user || user.id === 'local') return;
  return subscribeToDaemon(user.id, handleDaemonResponse);
}, [user]);

function handleDaemonResponse(response) {
  if (response.type === 'FILE_TREE') {
    setFileTree(response.payload?.tree);
    setChangedFiles(response.payload?.changedFiles || []);
  }
  // Add more type handlers here as features are added
}
```

### Pattern: Supabase Command Listener in Daemon

The daemon subscribes to the `soupz_commands` table on startup:

```javascript
// remote-server/src/index.js
async function startCommandListener() {
  if (!supabase) return;

  supabase
    .channel('soupz_cmd_listener')
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'soupz_commands',
    }, (payload) => {
      executeCommand(payload.new).catch(() => {});
    })
    .subscribe();
}
```

### Pattern: Streaming Agent Output (TO BE IMPLEMENTED)

The current `runAgentPrompt()` collects all output then returns. The streaming version
should push chunks via Supabase inserts:

```javascript
// TO IMPLEMENT in remote-server/src/index.js
async function runAgentPromptStreaming(payload, commandId, userId) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [CLI_ENTRY, 'ask', payload.agentId, payload.prompt], {
      cwd: payload.cwd || REPO_ROOT,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let fullOutput = '';
    child.stdout?.on('data', async (d) => {
      const chunk = d.toString();
      fullOutput += chunk;
      // Push chunk to Supabase for real-time relay
      if (supabase && commandId) {
        await supabase.from('soupz_output_chunks').insert({
          order_id: commandId,
          chunk,
          created_at: new Date().toISOString(),
        });
      }
    });

    child.on('close', (code) => {
      resolve({ output: fullOutput.trim(), exitCode: code });
    });
  });
}
```

On the web side, `daemon.js` needs a subscription to `soupz_output_chunks`:

```javascript
// TO IMPLEMENT in lib/daemon.js
export function subscribeToChunks(commandId, onChunk) {
  if (!supabase) return () => {};
  const channel = supabase
    .channel(`chunks:${commandId}`)
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'soupz_output_chunks',
      filter: `order_id=eq.${commandId}`,
    }, (payload) => {
      onChunk(payload.new.chunk);
    })
    .subscribe();
  return () => supabase.removeChannel(channel);
}
```

### Pattern: InteractiveQuestions Detection (TO BE IMPLEMENTED)

```javascript
// TO IMPLEMENT: detect in SimpleMode message rendering
const SOUPZ_Q_RE = /\[SOUPZ_Q\]([\s\S]*?)\[\/SOUPZ_Q\]/;

function extractQuestion(content) {
  const match = content.match(SOUPZ_Q_RE);
  if (!match) return null;
  try { return JSON.parse(match[1]); } catch { return null; }
}

function renderMessage(msg) {
  const question = extractQuestion(msg.content);
  if (question) {
    return <InteractiveQuestions
      data={question}
      onAnswer={(answers) => sendFollowUp(answers)}
    />;
  }
  return renderMarkdown(msg.content);
}
```

### Pattern: Voice Input

Already implemented in `SimpleMode.jsx`. Do not change this:

```javascript
function startVoice() {
  const SpeechRecog = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecog) return;
  const r = new SpeechRecog();
  r.continuous = false;
  r.interimResults = false;
  r.onresult = e => {
    setInput(e.results[0][0].transcript);
    setListening(false);
  };
  r.onerror = () => setListening(false);
  r.onend = () => setListening(false);
  recogRef.current = r;
  r.start();
  setListening(true);
}
```

### Pattern: Monaco Editor Theme

The custom `soupz-dark` Monaco theme is defined inside the `beforeMount` callback in
`ProMode.jsx`. Key colors:

```javascript
monaco.editor.defineTheme('soupz-dark', {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment',  foreground: '4A4A5A', fontStyle: 'italic' },
    { token: 'keyword',  foreground: '6366F1' },  // accent indigo
    { token: 'string',   foreground: '22C55E' },  // success green
    { token: 'number',   foreground: 'F59E0B' },  // warning amber
    { token: 'type',     foreground: '06B6D4' },  // cyan
  ],
  colors: {
    'editor.background': '#0C0C0F',          // bg-base
    'editor.foreground': '#F0F0F5',          // text-pri
    'editorCursor.foreground': '#6366F1',    // accent
  },
});
```

### Pattern: Daemon Object Shape

The `daemon` object is constructed in `App.jsx` and passed as a prop to `SimpleMode` and
`ProMode`. Its interface:

```typescript
// Interface (not actual TypeScript — for documentation only)
interface DaemonObject {
  online: boolean;
  machine: string | null;
  sendPrompt(opts: { prompt: string; agentId: string; buildMode: string }, onChunk: (chunk: string) => void): Promise<void>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  gitStatus(): Promise<{ staged: FileEntry[]; unstaged: FileEntry[]; branch: string }>;
  gitDiff(path?: string): Promise<string>;
  gitStage(paths: string[]): Promise<void>;
  gitCommit(message: string): Promise<void>;
  gitPush(): Promise<void>;
}
```

Currently, `sendPrompt`'s `onChunk` callback is accepted but the daemon does not call it —
streaming is not yet wired. The callback exists as a placeholder API.

---

## 9. CURRENT BUGS / KNOWN ISSUES

### Bug 1: onChunk Callback Never Called

**File**: `/packages/dashboard/src/App.jsx` line 79-81
**Problem**: `daemon.sendPrompt` accepts an `onChunk` callback but ignores it:
```javascript
async sendPrompt({ prompt, agentId, buildMode }, onChunk) {
  return sendAgentPrompt(prompt, agentId, buildMode, user?.id);  // onChunk unused!
}
```
**Fix needed**: Implement streaming (see Priority 1 in Section 7).

### Bug 2: File Tree Never Loaded

**Files**: `App.jsx`, `lib/daemon.js`
**Problem**: `handleDaemonResponse` handles `FILE_TREE` responses but `getFileTree()` is
never called to trigger the request. FileTree component shows empty state always.
**Fix needed**: Call `getFileTree(null, user?.id)` after daemon health check confirms online.

### Bug 3: ConnectPage Hardcodes localhost

**File**: `/packages/dashboard/src/components/connect/ConnectPage.jsx` line 5
```javascript
const PAIRING_API = 'http://localhost:7070';
```
This works for local dev but breaks for LAN access (accessing from phone on same network).
**Fix needed**: Make this configurable or detect the daemon URL from environment.

### Bug 4: GitPanel Gitignores Response Format

**File**: `components/git/GitPanel.jsx`
**Problem**: `daemon.gitStatus()` returns a `commandId` (async via Supabase), not the actual
git status object. The `refresh()` function sets `status` to a command ID string, then
tries `s?.unstaged?.length` which is undefined.
**Fix needed**: The response system needs to be wired so the response comes back via
`subscribeToDaemon` and is dispatched to the right component.

### Bug 5: ProMode Mobile Detection is Static

**File**: `components/pro/ProMode.jsx` line 28
```javascript
const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
```
This runs ONCE at render. If the window is resized, `isMobile` doesn't update (there IS a
resize listener but it only toggles sidebar/chat, not `isMobile` itself).
**Fix needed**: Move `isMobile` to state with a resize listener, or use a media query hook.

### Bug 6: supabase_commands / supabase_responses Tables May Not Exist

The relay tables (`soupz_commands`, `soupz_responses`) are defined in migrations but there
is no guarantee they have been applied to the Supabase project. The `run-this-now.sql` file
in migrations is a hint that manual SQL execution may have been required.
**Fix needed**: Verify migrations are applied. Run the SQL from `supabase/migrations/` in
the Supabase SQL editor if tables are missing.

### Bug 7: WS Auth Handshake Not Used by Web App

The WebSocket server requires an auth handshake (`{ type: 'auth', token: '...' }`).
However, the web app's `daemon.js` does not use WebSockets at all — it uses the REST API
and Supabase Realtime. The WebSocket is only used by the mobile app (Expo) and browser
extension. This is intentional but can be confusing.

### Known Limitation: 5-Minute Agent Timeout

In `runAgentPrompt()`, there is a hardcoded 5-minute timeout:
```javascript
setTimeout(() => { child.kill(); resolve({ output: stdout.trim(), timedOut: true }); }, 300000);
```
Long-running Claude Code tasks (large refactors) will be killed. This should be configurable.

---

## 10. COPY-PASTE PROMPTS FOR EACH REMAINING TASK

These are ready-to-use prompts. Paste them verbatim into Claude Code, Gemini, or similar.

---

### PROMPT 1: Wire Daemon Streaming

```
I'm working on the Soupz project. The codebase is a web IDE where a daemon runs locally
(packages/remote-server/src/index.js) and a React web app (packages/dashboard/) communicates
with it via Supabase Realtime.

The current problem: when a user sends a prompt to an AI agent (claude, gemini, etc.), the
daemon runs the agent, waits for it to finish, then returns the full output all at once. I
need to stream the output in real time.

Here is the current runAgentPrompt function (at the bottom of remote-server/src/index.js):

async function runAgentPrompt({ prompt, agentId = 'auto', mode, cwd: workDir }) {
    return new Promise((resolve) => {
        const args = [CLI_ENTRY];
        if (agentId && agentId !== 'auto') {
            args.push('ask', agentId, prompt);
        } else {
            args.push('run', prompt);
        }
        const child = spawn(process.execPath, args, {
            cwd: workDir || REPO_ROOT,
            env: process.env,
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        let stdout = '';
        let stderr = '';
        child.stdout?.on('data', (d) => { stdout += d.toString(); });
        child.stderr?.on('data', (d) => { stderr += d.toString(); });
        child.on('close', (code) => {
            resolve({ output: stdout.trim() || stderr.trim(), exitCode: code });
        });
    });
}

The AGENT_PROMPT case in executeCommand() calls this function then inserts one response row
into soupz_responses.

There is already a table soupz_output_chunks(id bigserial, order_id text, chunk text,
created_at timestamptz). This is perfect for streaming.

Please make the following changes:

1. In remote-server/src/index.js, modify runAgentPrompt to accept (payload, commandId, userId)
   and on each stdout data chunk, insert a row into soupz_output_chunks with order_id=commandId.
   Keep the final soupz_responses insert at the end with the complete output.

2. In packages/dashboard/src/lib/daemon.js, add a new exported function
   subscribeToChunks(commandId, onChunk) that subscribes to INSERT events on
   soupz_output_chunks filtered by order_id = commandId.

3. In packages/dashboard/src/App.jsx, update the daemon.sendPrompt implementation to:
   - Call sendAgentPrompt() to get a commandId
   - Call subscribeToChunks(commandId, onChunk) to start streaming
   - Unsubscribe when the response arrives via subscribeToDaemon

4. Verify the onChunk callback is properly wired in SimpleMode.jsx. It already calls
   daemon.sendPrompt({ prompt, agentId, buildMode }, chunk => { ... }) but the callback
   is currently ignored.

Do not change the design system, colors, or any UI that already exists. Only change the
data flow layer.
```

---

### PROMPT 2: Build InteractiveQuestions Component

```
I'm building a feature for the Soupz project — a web IDE where AI agents run on the user's
machine. The web UI is at packages/dashboard/src/.

I need to build an InteractiveQuestions component that renders when an AI agent embeds a
question block in its output. The format is:

[SOUPZ_Q]{"questions":[{"id":"q1","text":"Which database?","multi":false,"options":["PostgreSQL","MySQL","SQLite"]},{"id":"q2","text":"Deploy targets?","multi":true,"options":["Vercel","Railway","AWS","GCP"]}]}[/SOUPZ_Q]

The fields:
- id: string identifier for the question
- text: question label
- multi: boolean, if true allow multiple selections
- options: string array of choices

The component should:
1. Render each question as a card with the question text and option buttons
2. Track selected answers in local state
3. Show a "Continue" button that's enabled only when all questions are answered
4. On "Continue", call an onAnswer({ q1: "PostgreSQL", q2: ["Vercel", "AWS"] }) callback

Design requirements (match the existing soupz design system exactly):
- Background: bg-bg-elevated (#16161A), border: border-subtle (#1E1E24)
- Selected option: bg-accent/15 border-accent text-text-pri
- Unselected option: bg-bg-surface border-border-subtle text-text-sec hover:border-border-mid
- Continue button: bg-accent hover:bg-accent-hover text-white
- Question text: text-text-pri text-sm font-ui font-medium
- Option text: text-xs font-ui
- Border radius: rounded-xl for card, rounded-lg for options
- Icons: Lucide React only (use Check for selected state indicator)

Create the file at: packages/dashboard/src/components/simple/InteractiveQuestions.jsx

Then modify SimpleMode.jsx to:
1. Import InteractiveQuestions
2. Add a parseQuestionBlock(content) function that extracts the JSON from [SOUPZ_Q]...[/SOUPZ_Q]
3. In the Message component, if the AI message contains a question block, render
   InteractiveQuestions instead of (or below) the regular renderMarkdown output
4. When answered, call sendMessage() with the formatted answers string

The answer format sent back to the agent should be:
"[User answers] q1: PostgreSQL | q2: Vercel, AWS"
```

---

### PROMPT 3: Implement Ollama Smart Routing

```
In the Soupz project (packages/dashboard/src/), when a user selects "Auto" as their agent,
I need to implement smart routing that picks the best AI agent for their prompt.

Current state: when agentId === 'auto', daemon.sendPrompt just sends it to the daemon which
has no routing logic (it falls back to a hardcoded agent or runs the default CLI).

I need to implement this in the daemon (packages/remote-server/src/index.js) in the
AGENT_PROMPT case of executeCommand():

```javascript
// Routing priority:
// 1. Try Ollama locally for classification
// 2. Keyword matching
// 3. Default to 'claude-code'

async function selectAgent(prompt, availableAgents) {
  // 1. Try Ollama
  try {
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen2.5:0.5b',
        prompt: `Given this task: "${prompt}", which agent should handle it? Options: ${availableAgents.join(', ')}. Reply with ONLY the agent id, nothing else.`,
        stream: false,
      }),
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();
    const picked = data.response?.trim().toLowerCase();
    if (availableAgents.includes(picked)) return picked;
  } catch { /* Ollama not running */ }

  // 2. Keyword matching
  const keywords = {
    'claude-code': ['code', 'function', 'bug', 'refactor', 'implement', 'fix', 'typescript', 'javascript'],
    'gemini': ['analyze', 'research', 'explain', 'document', 'summarize'],
    'copilot': ['github', 'pull request', 'issue', 'workflow', 'action'],
    'ollama': [], // local-only tasks
  };
  for (const [agent, words] of Object.entries(keywords)) {
    if (words.some(w => prompt.toLowerCase().includes(w))) {
      if (availableAgents.includes(agent)) return agent;
    }
  }

  // 3. Default
  return availableAgents.includes('claude-code') ? 'claude-code' : availableAgents[0];
}
```

Also add this routing logic to the AGENT_PROMPT handler:

```javascript
case 'AGENT_PROMPT': {
  let resolvedAgentId = payload.agentId;
  if (resolvedAgentId === 'auto') {
    const available = ['claude-code', 'gemini', 'copilot', 'ollama'].filter(id => {
      // check if binary exists
      try { execSync(`which ${id === 'claude-code' ? 'claude' : id}`, { timeout: 1000 }); return true; }
      catch { return false; }
    });
    resolvedAgentId = await selectAgent(payload.prompt, available);
  }
  result = await runAgentPrompt({ ...payload, agentId: resolvedAgentId });
  break;
}
```

Do not modify any frontend files. This is purely a daemon-side change.
```

---

### PROMPT 4: Fix File Tree Loading

```
In the Soupz project, the file tree panel in ProMode is always empty even when the daemon
is online. The data flow is broken — the request is never sent.

The daemon has a working FILE_TREE command handler at packages/remote-server/src/index.js.
The web has a handler for FILE_TREE responses at App.jsx line 69-73:

function handleDaemonResponse(response) {
  if (response.type === 'FILE_TREE') {
    setFileTree(response.payload?.tree);
    setChangedFiles(response.payload?.changedFiles || []);
  }
}

But getFileTree() is never called.

Please fix App.jsx to request the file tree when:
1. The daemon first comes online (daemonOnline transitions from false to true)
2. After any git operation (so the changed-files indicators update)

Add this effect to App.jsx:

useEffect(() => {
  if (daemonOnline && user) {
    getFileTree(null, user.id);
  }
}, [daemonOnline, user]);

Also fix the response parsing: the response from soupz_responses has the data in a
'result' field, not 'payload'. Look at how executeCommand() stores results:

await supabase.from('soupz_responses').insert({
  command_id: id, user_id, type,
  result,          // <-- the actual data is here
  status: 'success',
});

But handleDaemonResponse receives payload.new from the Realtime subscription, so the
field is response.result, not response.payload.

Fix handleDaemonResponse to use response.result instead of response.payload:

function handleDaemonResponse(response) {
  if (response.type === 'FILE_TREE') {
    setFileTree(response.result?.tree);
    setChangedFiles(response.result?.changedFiles || []);
  }
}

Make the same fix for any other response types that are added later.
```

---

### PROMPT 5: Build the Landing Page

```
I need to build a marketing landing page for Soupz — a web IDE that lets users control
AI coding agents (Claude Code, Gemini, Copilot) from their browser or phone.

The landing page should go at packages/dashboard/src/components/landing/LandingPage.jsx
and be served at the root route ('/') ONLY for unauthenticated users. After auth, the root
shows the app.

The existing App.jsx routing logic should be modified to:
- If path === '/' and user is null and !authLoading → show LandingPage
- If path === '/' and user exists → show the IDE (current behavior)

Design requirements (must match soupz design system EXACTLY):

Colors:
- bg-base: #0C0C0F, bg-surface: #111114, bg-elevated: #16161A
- accent: #6366F1 (indigo), border-subtle: #1E1E24
- text-pri: #F0F0F5, text-sec: #8B8B9A, text-faint: #4A4A5A
- success: #22C55E, warning: #F59E0B

Typography: Inter (UI), JetBrains Mono (code)
Icons: Lucide React only (NO emojis)
Aesthetic: Linear, Vercel, Cursor — dark, professional, investor-worthy

Landing page sections:

1. HERO
   - Logo: Terminal icon in accent-colored rounded box + "Soupz" text
   - Headline (large, bold): "Your AI coding agents, on your phone"
   - Subheadline: "Run npx soupz on your machine. Use Claude Code, Gemini, and Copilot from anywhere — browser, phone, or tablet."
   - Two CTAs: "Get started free" (accent button → /connect) and "View on GitHub" (ghost)
   - Below: animated terminal showing `npx soupz` startup output
   - Background: subtle grid pattern (.bg-grid class exists in index.css)

2. FEATURES (3-column grid)
   Feature cards with Lucide icon, title, description:
   - Smartphone icon: "Built for your phone" — "Voice input, mobile-first UI. Code during your commute."
   - Bot icon: "Every AI agent" — "Claude Code, Gemini CLI, GitHub Copilot, Kiro. One interface."
   - Shield icon: "Your code stays local" — "No cloud execution. Your laptop is the server."
   - Zap icon: "Streaming output" — "Watch your agent work in real time."
   - GitBranch icon: "Built-in git" — "Stage, diff, commit, push without leaving the browser."
   - Cpu icon: "Smart routing" — "Auto picks the best agent for your prompt."

3. HOW IT WORKS (steps)
   Simple numbered list:
   1. Run npx soupz on your Mac, Linux, or Windows machine
   2. Scan the pairing code or open the link
   3. Start building from your phone or browser

4. FOOTER
   - Logo + copyright
   - Links: GitHub, Docs (coming soon), Status

Do NOT use any emojis. Use Lucide React icons everywhere. The font for the headline
should be Inter, weight 700 or 800. Keep it dark and minimal.
```

---

### PROMPT 6: Add Project Memory (.soupz.md)

```
In the Soupz project, I want to add project memory support. When the daemon is started
in a directory, it should look for a .soupz.md file and prepend its contents to every
agent prompt.

Changes needed in packages/remote-server/src/index.js:

1. On startup (inside startRemoteServer()), read .soupz.md from process.cwd() if it exists:

async function loadProjectMemory(cwd) {
  const memoryPath = join(cwd || process.cwd(), '.soupz.md');
  try {
    const content = await readFile(memoryPath, 'utf8');
    return content.trim();
  } catch {
    return null;
  }
}

let projectMemory = null;

// In startRemoteServer():
startRemoteServer(port, opts) {
  projectMemory = await loadProjectMemory(); // add this line
  // ... rest of startup
}

2. In runAgentPrompt(), prepend the memory to the prompt:

async function runAgentPrompt({ prompt, agentId, mode, cwd: workDir }) {
  let fullPrompt = prompt;
  if (projectMemory) {
    fullPrompt = `[Project Context]\n${projectMemory}\n\n[Task]\n${prompt}`;
  }
  // use fullPrompt instead of prompt in the spawn args
}

3. Add a GET /api/memory endpoint (authenticated) that returns the current project memory:

app.get('/api/memory', requireAuth, (req, res) => {
  res.json({ memory: projectMemory, loaded: !!projectMemory });
});

4. Add a POST /api/memory endpoint to update it at runtime:

app.post('/api/memory', express.json(), requireAuth, async (req, res) => {
  const { content } = req.body;
  const memoryPath = join(process.cwd(), '.soupz.md');
  await writeFile(memoryPath, content, 'utf8');
  projectMemory = content;
  res.json({ ok: true });
});

Do not change any frontend files. This is daemon-only.
```

---

### PROMPT 7: npm Publish Audit

```
I need to verify the Soupz npm package (npx soupz) works correctly as a published package.
The package.json is at /soupz-agents/package.json.

Please do the following:

1. Read the root package.json and check these fields exist and are correct:
   - "bin": { "soupz": "./bin/soupz.js" }
   - "main": appropriate entry point
   - "files": array that includes bin/, src/, packages/remote-server/src/, defaults/
   - "engines": { "node": ">=18.0.0" }
   - "type": "module" (since we use ESM imports)

2. Check that bin/soupz.js has the shebang line: #!/usr/bin/env node

3. Check all imports in bin/soupz.js and packages/remote-server/src/index.js use correct
   relative paths that will work when installed as a package.

4. Verify that node_modules is in .npmignore or not in "files".

5. Check that packages/dashboard/ is NOT included in the npm package (it's deployed
   separately on Vercel, not bundled with npm).

6. Create a test script at scripts/test-npm-install.sh that:
   - npm pack (creates tarball)
   - Creates a temp directory
   - npm install the tarball
   - Runs npx soupz --version to verify it works
   - Cleans up

Report all issues found. Do not make changes without listing them first.
```

---

## 11. PROMPT TEMPLATES — USING SOUPZ'S OWN SPECIALISTS

These prompts are for using Soupz's internal specialist system to build more parts of
the project. They demonstrate how to invoke specific specialists.

### Using the @designer Specialist

```
You are acting as the @designer specialist — expert in UI/UX, brand, visual design.

Design a micro-animation system for the Soupz web IDE that matches its dark, professional
aesthetic (Linear/Cursor/Vercel style). Specify:
1. Transition durations (suggest 150ms for interactions, 200ms for panels)
2. Easing functions (ease-out for entrances, ease-in for exits)
3. Which elements should animate (hover states, dropdowns, streaming text cursor)
4. CSS keyframes for the thinking-dot animation (already in index.css as thinkBounce)
5. Framer Motion variants for panel slide-ins (if Framer Motion is added)

Constraints:
- No emojis anywhere
- Colors must use existing CSS variables (--accent, --bg-elevated, etc.)
- Performance: prefer CSS transitions over JavaScript animations
- All animations must respect prefers-reduced-motion media query
```

### Using the @architect Specialist

```
You are acting as the @architect specialist — expert in system design and architecture.

Review the Soupz daemon communication architecture and design the streaming architecture.
Current state: web sends command → Supabase → daemon executes → Supabase → web gets result.

Design a streaming solution that:
1. Sends output chunks within 500ms of the agent producing them
2. Works for both local (same machine) and remote (phone) access
3. Handles disconnections gracefully (buffering, replay)
4. Doesn't require changes to CLI agent binaries (claude, gemini, etc.)
5. Scales to 1 daemon serving 5 simultaneous web clients

Evaluate and compare:
A) Supabase soupz_output_chunks table with Realtime inserts
B) WebSocket broadcast from daemon to web app directly
C) Server-Sent Events endpoint on the daemon
D) Polling the daemon's /api/orders/:id endpoint

Give a recommendation with tradeoffs.
```

### Using the @devops Specialist

```
You are acting as the @devops specialist — expert in deployment, infrastructure, CI/CD.

Set up a complete CI/CD pipeline for Soupz. The project has:
- A Vercel-deployed React SPA (packages/dashboard/)
- An npm package (npx soupz) to publish to npm
- A Supabase database with migrations in supabase/migrations/

Design GitHub Actions workflows for:
1. On PR: lint + type-check (if added) + build dashboard
2. On push to main: deploy dashboard to Vercel via CLI
3. On git tag (v*.*.*): publish to npm with OTP if needed
4. Nightly: run supabase db push to apply any new migrations

Constraints:
- npm publish should require manual approval (GitHub environments)
- Vercel deployment token stored as VERCEL_TOKEN secret
- npm token stored as NPM_TOKEN secret
- Never put secrets in workflow files directly
```

### Using the @contentwriter Specialist

```
You are acting as the @contentwriter specialist — expert in product copy, marketing.

Write the hero section copy for the Soupz landing page. Soupz is a web IDE that:
- Lets you run `npx soupz` and access AI coding agents (Claude Code, Gemini, Copilot)
  from your browser or phone
- Primary use case: student coding from phone during lecture
- Target: investors, VPs of engineering, MNC recruiters

Write:
1. Main headline (max 8 words, punchy)
2. Subheadline (1-2 sentences, concrete benefit)
3. 3 feature taglines (4-6 words each, no fluff)
4. CTA button text (2-4 words)
5. Social proof line (example: "Used by 500+ developers at Google, Meta, ...")

Tone: confident, technical, not startup-fluff. Think Vercel's marketing — factual,
developer-focused, no exclamation marks. No emojis.
```

### Using the @ai-engineer Specialist

```
You are acting as the @ai-engineer specialist — expert in LLMs, agents, RAG, pipelines.

Design the Ollama smart routing system for Soupz. When a user's agentId is 'auto',
we need to classify their prompt and route to the best available CLI agent.

Available agents: claude-code, gemini, copilot, kiro, ollama (local)
Available Ollama models for classification: qwen2.5:0.5b (tiny, fast), llama3.2:1b

Design:
1. The classification prompt template (few-shot examples for each agent's specialty)
2. The routing decision tree (Ollama → keyword matching → default)
3. Handling for when Ollama is not installed or not running
4. Whether to cache routing decisions for similar prompts
5. How to handle the 'specialist' layer (e.g., @architect routed through claude-code)

The routing runs inside the daemon (Node.js), so you can use fetch() to call Ollama.
Ollama API: POST http://localhost:11434/api/generate with { model, prompt, stream: false }
```

---

## 12. RUNNING LOCALLY

### Prerequisites

- Node.js 18+
- npm or pnpm
- (Optional) Claude Code CLI: `npm install -g @anthropic-ai/claude-code`
- (Optional) Gemini CLI: `npm install -g @google/gemini-cli`
- (Optional) GitHub Copilot CLI: `gh extension install github/gh-copilot`

### Start the Web App (Dev Mode)

```bash
cd /Users/shubh/Developer/soupz-agents/packages/dashboard
npm install
npm run dev
# Opens at http://localhost:5173
```

The web app will show "Offline" banner if the daemon isn't running. That's expected.
You can still browse the UI — it just won't execute agents.

### Start the Daemon

```bash
cd /Users/shubh/Developer/soupz-agents
node bin/soupz.js
# Outputs pairing code and opens browser to localhost:5173/connect
# Daemon runs at http://localhost:7070
```

If port 7070 is in use, the daemon logs "Daemon already running" and exits. Kill the
existing process with `lsof -ti:7070 | xargs kill`.

### Pair the Web App to the Daemon

1. Daemon shows: `Code: 12345678 (expires in 300s)`
2. Browser auto-opens to `/connect?code=12345678`
3. Or manually go to http://localhost:5173/connect and enter the code
4. After pairing: nav bar shows green "Connected" dot

### Build for Production

```bash
cd /Users/shubh/Developer/soupz-agents/packages/dashboard
npm run build
# Output at packages/dashboard/dist/
```

### Check Daemon Health Directly

```bash
curl http://localhost:7070/health
# Returns: { platform, hostname, memory, cpu, port, ... }
```

### Environment Setup (Local Dev Without Supabase)

If you don't have Supabase keys, the app works in local-only mode:
- No `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` = Supabase client is null
- Auth is skipped (auto-sets user to `{ id: 'local', email: 'local@soupz.app' }`)
- All daemon communication goes direct HTTP (not relay)
- This is the easiest dev setup

Create `/packages/dashboard/.env.local`:
```
# Leave empty or omit Supabase keys for local-only mode
VITE_DAEMON_URL=http://localhost:7070
```

---

## 13. DEPLOYMENT

### Vercel (Dashboard)

**Config** (`/vercel.json` in repo root):
```json
{
  "buildCommand": "cd packages/dashboard && npm install && npm run build",
  "outputDirectory": "packages/dashboard/dist",
  "installCommand": "npm install",
  "framework": null,
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-Content-Type-Options", "value": "nosniff" }
      ]
    }
  ]
}
```

**Deploy**: Push to main branch → Vercel auto-deploys.

**Live URL**: `https://soupz-agents-sohams-projects-4080e0ee.vercel.app`

**Custom domain**: Map `soupz.app` in Vercel dashboard (not yet done).

**Environment variables** (set in Vercel project settings):
```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_DAEMON_URL=http://localhost:7070
```

### Supabase (Database + Relay)

Migrations are in `/supabase/migrations/`. To apply:
1. Go to your Supabase project SQL editor
2. Run each migration file in order (by timestamp prefix)
3. Or use Supabase CLI: `supabase db push`

**Tables used**:
- `soupz_commands` — web → daemon commands
- `soupz_responses` — daemon → web responses
- `soupz_output_chunks` — streaming output chunks (not yet used)
- `soupz_machines` — machine heartbeat / registry
- `soupz_orders` — legacy order tracking (from pre-relay architecture)

**Realtime subscriptions** needed:
- `soupz_commands` — daemon subscribes to this
- `soupz_responses` — web app subscribes to this
- `soupz_output_chunks` — web app will subscribe (once streaming is implemented)

Make sure Realtime is enabled for these tables in Supabase project settings.

### npm (Package)

Not yet published. Steps when ready:
```bash
npm login
npm publish --access public
# or for scoped: npm publish --access public --scope @soupz
```

---

## 14. ENVIRONMENT VARIABLES

### Dashboard (Vite, prefix: VITE_)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_SUPABASE_URL` | No | (none) | Supabase project URL. Without this, local-only mode. |
| `VITE_SUPABASE_ANON_KEY` | No | (none) | Supabase anonymous key |
| `VITE_DAEMON_URL` | No | `http://localhost:7070` | Daemon base URL for direct HTTP |

### Daemon (Node.js process env)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SUPABASE_URL` | No | (none) | Supabase URL for daemon-side relay |
| `SUPABASE_SERVICE_ROLE_KEY` | No | (none) | Service role key (bypasses RLS) |
| `SOUPZ_REMOTE_PORT` | No | `7070` | Port to listen on |
| `SOUPZ_APP_URL` | No | `https://soupz.app` | URL opened in browser on startup |
| `SOUPZ_WEB_AGENT` | No | `copilot` | Fallback agent when 'auto' selected |
| `SOUPZ_SUPABASE_ORDERS_TABLE` | No | `soupz_orders` | Override orders table name |

### Local Development Setup

Create `/packages/dashboard/.env.local` for the web app:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_DAEMON_URL=http://localhost:7070
```

Create `/.env` in the repo root for the daemon:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SOUPZ_REMOTE_PORT=7070
SOUPZ_APP_URL=http://localhost:5173
```

---

## 15. SUPABASE SCHEMA REFERENCE

### soupz_commands

Commands sent from web → daemon.

```sql
CREATE TABLE soupz_commands (
  id TEXT PRIMARY KEY,               -- UUID generated by web app
  user_id TEXT NOT NULL,             -- Supabase auth user ID
  type TEXT NOT NULL,                -- Command type (see below)
  payload JSONB,                     -- Command arguments
  status TEXT DEFAULT 'pending',     -- pending | running | done | error
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Command Types** (`type` field):
- `FILE_TREE` — payload: `{ path: string | null }` → returns file tree
- `FILE_READ` — payload: `{ path: string, root?: string }` → returns file content
- `FILE_WRITE` — payload: `{ path: string, content: string, root?: string }`
- `GIT_STATUS` — payload: `{ path?: string }` → returns `{ files: [{status, path}] }`
- `GIT_DIFF` — payload: `{ path?: string, root?: string }` → returns diff string
- `GIT_STAGE` — payload: `{ path: string, root?: string }`
- `GIT_COMMIT` — payload: `{ message: string, root?: string }`
- `GIT_PUSH` — payload: `{ root?: string }`
- `AGENT_PROMPT` — payload: `{ prompt: string, agentId: string, mode: string, cwd?: string }`

### soupz_responses

Responses sent from daemon → web.

```sql
CREATE TABLE soupz_responses (
  id BIGSERIAL PRIMARY KEY,
  command_id TEXT REFERENCES soupz_commands(id),
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,                -- Mirrors command type
  result JSONB,                      -- Command-specific result
  status TEXT DEFAULT 'success',     -- success | error
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Important**: In `handleDaemonResponse(response)` in App.jsx, the data is at
`response.result` (not `response.payload`). This is a known discrepancy.

### soupz_output_chunks

Streaming output for long-running agents. Not yet used.

```sql
CREATE TABLE soupz_output_chunks (
  id BIGSERIAL PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES soupz_orders(id),
  chunk TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### soupz_machines

Machine heartbeat for online/offline status.

```sql
CREATE TABLE soupz_machines (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT DEFAULT 'My Laptop',
  last_seen TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'offline',
  version TEXT
);
```

### soupz_orders

Legacy order tracking from the pre-relay architecture. Still used for /api/orders
history. The daemon persists to this table via Supabase service role.

```sql
-- Key fields (simplified):
CREATE TABLE soupz_orders (
  id TEXT PRIMARY KEY,
  prompt TEXT,
  agent TEXT,
  run_agent TEXT,
  status TEXT,              -- queued | running | completed | failed
  created_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  stdout TEXT,
  stderr TEXT,
  events JSONB[],
  exit_code INTEGER,
  user_id TEXT,             -- added by migration 20260316000200
  machine_id TEXT,
  source TEXT DEFAULT 'cli'
);
```

---

## 16. DAEMON API REFERENCE

Base URL: `http://localhost:7070`

### Public Endpoints (No Auth Required)

```
GET  /health
  Response: { platform, arch, hostname, uptime, cpu, memory, swap, disk, port, lanIPs }

POST /pair
  Response: { code, expiresIn, qrData, connectUrls[] }
  Note: Generates a new pairing code

POST /pair/validate
  Body: { code: "12345678" }
  Response: { token, expiresIn, hostname }
  Note: Validates code, returns session token

POST /command
  Body: { id, type, payload }
  Note: Only accepts requests from localhost (127.0.0.1)
  Response: { ok, commandId }
  Note: Async — result comes via Supabase relay or WebSocket
```

### Authenticated Endpoints (Require `X-Soupz-Token: <token>` header)

```
GET  /health/full              — Full health + session info
GET  /api/orders               — List recent orders
POST /api/orders               — Create new order (run agent)
GET  /api/orders/:id           — Order detail with timeline
GET  /api/changes              — Git changed files
GET  /api/changes/diff?file=   — Git diff for specific file
GET  /api/fs/tree?root=        — File tree
GET  /api/fs/file?path=&root=  — Read file
POST /api/fs/file              — Write file { path, content, root }
POST /api/git/stage            — Stage file { path, root }
POST /api/git/commit           — Commit { message, root }
POST /api/git/push             — Push { root }
POST /terminal                 — Create terminal (requires node-pty)
GET  /terminals                — List active terminals
POST /logout                   — Revoke session
```

### WebSocket Protocol

Connect to: `ws://localhost:7070`

**Auth handshake** (must send within 10 seconds):
```json
{ "type": "auth", "token": "<session-token>", "clientType": "browser" }
// OR
{ "type": "auth", "code": "12345678", "clientType": "mobile" }
```

**Auth success response**:
```json
{ "type": "auth_success", "hostname": "macbook.local", "health": { ... } }
```

**After auth — supported message types**:
```json
{ "type": "ping" }                                    → { "type": "pong" }
{ "type": "health" }                                  → { "type": "health", "data": {...} }
{ "type": "create_terminal", "cols": 80, "rows": 24 } → { "type": "terminal_created", "terminalId": 1 }
{ "type": "subscribe", "terminalId": 1 }             → history replay
{ "type": "input", "terminalId": 1, "data": "ls\n" } → (no response, output via output events)
{ "type": "resize", "terminalId": 1, "cols": 120 }   → (no response)
{ "type": "kill_terminal", "terminalId": 1 }          → (no response)
{ "type": "logout" }                                   → { "type": "logged_out" } + close
```

**Server-push events** (daemon → client):
```json
{ "type": "health", "data": { ... } }                 // Every 5 seconds
{ "type": "order_update", "data": { ... } }           // On order status change
{ "type": "output", "terminalId": 1, "data": "..." }  // Terminal output
{ "type": "exit", "terminalId": 1, "code": 0 }       // Terminal exit
```

---

## 17. LOCALSTORAGE KEYS REFERENCE

All keys used by the dashboard web app:

| Key | Type | Description |
|-----|------|-------------|
| `soupz_chat_history` | JSON array | Last 100 chat messages (trimmed) |
| `soupz_agent` | string | Selected agent ID (e.g., 'claude-code', 'auto') |
| `soupz_build_mode` | string | 'quick' / 'planned' / 'chat' |
| `soupz_ide_mode` | string | 'simple' / 'pro' |
| `soupz_sidebar_open` | 'true'/'false' | ProMode sidebar visibility |
| `soupz_chat_open` | 'true'/'false' | ProMode chat panel visibility |
| `soupz_open_files` | JSON array | Open file tabs in ProMode (max 20) |
| `soupz_daemon_token` | string | Session token from pairing |
| `soupz_hostname` | string | Connected machine hostname |

---

## 18. AGENT SYSTEM REFERENCE

### CLI Agents (Real Executables)

Defined in `/packages/dashboard/src/lib/agents.js` as `CLI_AGENTS`:

| ID | Name | Binary | Description |
|----|------|--------|-------------|
| `gemini` | Gemini | `gemini` | Google Gemini CLI |
| `claude-code` | Claude Code | `claude` | Anthropic Claude CLI |
| `copilot` | Copilot | `gh` | GitHub Copilot CLI (`gh copilot suggest`) |
| `kiro` | Kiro | `kiro-cli` | AWS Kiro AI agent |
| `ollama` | Ollama | `ollama` | Local models (free) |

### Specialists (Expert Modes)

Defined in `SPECIALISTS` array. These are persona overlays on CLI agents.
Categories: `dev`, `design`, `research`, `strategy`, `content`, `business`, `all`

Key specialists:
- `auto` — AI picks the best agent
- `dev` — Code, debug, APIs
- `architect` — System design
- `ai-engineer` — LLMs, RAG, agent pipelines
- `devops` — Deploy, infra, CI/CD
- `designer` — UI/UX, brand
- `strategist` — Business, GTM, roadmap
- `pm` — Product management
- `researcher` — Market research
- `contentwriter` — Blog, copy, social

Full list has 29 specialists across 6 categories.

### Build Modes

Defined in `BUILD_MODES`:
- `quick` — "Straight to code" (default)
- `planned` — "Plan first, then code"
- `chat` — "Ask questions, brainstorm"

### Adding a New Specialist

1. Add to `SPECIALISTS` array in `/packages/dashboard/src/lib/agents.js`:
```javascript
{
  id: 'new-specialist',
  name: 'New Specialist',
  icon: SomeLucideIcon,      // import from 'lucide-react'
  color: '#HEXCODE',
  desc: 'Short description',
  category: 'dev',           // existing category
}
```

2. Add agent definition file at `/defaults/agents/soupz-new-specialist.md` with system prompt.

3. No daemon changes needed — specialists use existing CLI agents.

### Adding a New CLI Agent

1. Add to `CLI_AGENTS` in `agents.js`:
```javascript
{ id: 'new-cli', name: 'New Agent', icon: SomeLucideIcon, color: '#HEX', binary: 'binary-name', description: 'Description' }
```

2. In the daemon, update the binary resolution logic if the binary name doesn't match the id.

3. Add auth support in `src/auth/manager.js` if the CLI requires login.

---

## APPENDIX: QUICK REFERENCE CARD

For maximum speed when starting a new session:

```
Web app entry:     packages/dashboard/src/App.jsx
Daemon:            packages/remote-server/src/index.js
Lib API client:    packages/dashboard/src/lib/daemon.js
Agent defs:        packages/dashboard/src/lib/agents.js
Primary UI:        packages/dashboard/src/components/simple/SimpleMode.jsx
Design tokens:     packages/dashboard/tailwind.config.js

Key colors:
  bg:     #0C0C0F  (bg-bg-base)
  panel:  #111114  (bg-bg-surface)
  input:  #16161A  (bg-bg-elevated)
  accent: #6366F1  (accent)
  text:   #F0F0F5  (text-text-pri)

Daemon URL:    http://localhost:7070
Web dev URL:   http://localhost:5173
Live URL:      https://soupz-agents-sohams-projects-4080e0ee.vercel.app

Top remaining work:
  1. Streaming agent output via soupz_output_chunks
  2. InteractiveQuestions component (MCQ UI)
  3. Ollama smart routing when agentId === 'auto'
  4. File tree auto-load on daemon connect
  5. Landing page at soupz.app
```

---

*End of PROMPTS.md. If you are an AI reading this in a future session, start from
Section 1 Quick Start and orient yourself before making changes.*
