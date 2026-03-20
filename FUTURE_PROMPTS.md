# Soupz Agents - Future Implementation Prompts

Use these prompts with any AI coding assistant (Claude, Gemini, Copilot) to continue building Soupz. Each prompt is self-contained with enough context to work independently.

---

## Priority 1: Auth (Google/GitHub Login)

```
I have a Soupz web app at packages/dashboard/ using React + Vite + Supabase.

Supabase is already configured in packages/dashboard/src/lib/supabase.js and there's an AuthScreen component at packages/dashboard/src/components/auth/AuthScreen.jsx.

The .env has SOUPZ_SUPABASE_URL and SOUPZ_SUPABASE_KEY set.

Tasks:
1. In my Supabase dashboard, I've enabled Google and GitHub OAuth providers
2. Update AuthScreen.jsx to show "Sign in with Google" and "Sign in with GitHub" buttons using supabase.auth.signInWithOAuth({ provider: 'google' }) and { provider: 'github' }
3. Add the VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to a .env.local file in packages/dashboard/ so the dashboard can connect to Supabase
4. Make sure the redirect URL after OAuth goes back to the app
5. Show user avatar and name in the nav bar after login

Read AuthScreen.jsx, supabase.js, and App.jsx first.
```

---

## Priority 2: Wispr Flow STT Integration

```
I'm building Soupz (packages/dashboard/) and want to integrate Wispr Flow for speech-to-text. Wispr has a local API that runs on the user's machine.

Current STT uses webkitSpeechRecognition which only works in Chrome. I need cross-browser STT.

Check my other project at ~/Developer/hackathon-template (or similar folder in ~/Developer/) for how I previously integrated Wispr. Look for any Wispr-related code, API calls, or configuration.

Tasks:
1. Find the Wispr integration in my hackathon project
2. Port the Wispr STT functionality to packages/dashboard/src/hooks/useWisprSTT.js
3. In SimpleMode.jsx, add Wispr as the preferred STT provider, falling back to webkitSpeechRecognition
4. Add a settings option in ProMode settings panel to configure Wispr API key
5. Store the API key in localStorage under 'soupz_wispr_key'

The mic button is in SimpleMode.jsx around the startVoice() function.
```

---

## Priority 3: RAG Memory System

```
I'm building a memory system for Soupz (packages/dashboard/). The concept:

1. Store conversation summaries as "memory shards" in localStorage (for now, later migrate to a proper vector DB)
2. Each shard is a JSON object: { id, summary, keywords, timestamp, agentId, category }
3. When a new conversation starts, retrieve relevant shards by keyword matching against the prompt
4. Inject retrieved context into the prompt sent to the daemon

Create these files:
- packages/dashboard/src/lib/memory.js - Memory shard CRUD, search by keywords, auto-summarize (using the daemon's AI to generate summaries of conversations)
- packages/dashboard/src/components/shared/MemoryPanel.jsx - UI to browse/search/delete memory shards

Integration points:
- In SimpleMode.jsx sendMessage(), before sending to daemon, call getRelevantMemory(prompt) and prepend context
- After each conversation (when streaming ends), call summarizeAndStore(messages) to save a shard
- Add a "Memory" tab in the settings sidebar in ProMode

Keep it simple - localStorage-based, keyword search (not vector embeddings). Max 200 shards, auto-prune oldest.
```

---

## Priority 4: Search Across Files (Ctrl+Shift+F)

```
In Soupz IDE mode (packages/dashboard/src/components/pro/ProMode.jsx), add a file search panel.

The daemon at localhost:7533 has a file system API:
- GET /api/fs/tree - returns the file tree
- GET /api/fs/file?path=... - reads a file

Tasks:
1. Create packages/dashboard/src/components/pro/SearchPanel.jsx
2. Add a "Search" activity in the ProMode sidebar (magnifying glass icon, between Files and Git)
3. When user types in search, send the query to a new daemon endpoint (or iterate client-side over the file tree and read each file)
4. Show results grouped by file with line numbers
5. Clicking a result opens the file in the editor at that line
6. Add Cmd+Shift+F keyboard shortcut to focus the search panel

Use the same styling as the existing FileTree and GitPanel components.
```

---

## Priority 5: Split Editor

```
In ProMode.jsx (packages/dashboard/src/components/pro/), add split editor support.

Currently there's one Monaco editor instance. Add the ability to split horizontally (side-by-side).

Tasks:
1. Add a "Split Editor" button in the top bar (next to the Run button)
2. When split, show two editor panes side by side, each with their own active file
3. The left pane keeps the current file, the right pane starts empty (user opens a file from the tree)
4. Add a close button on each split pane
5. Track cursor position for the focused pane and update the StatusBar accordingly
6. Store split state in localStorage

Keep the implementation simple - just duplicate the Editor component with independent file state.
```

---

## Priority 6: Extensions as Real Agent Configurations

```
The extensions marketplace in packages/dashboard/src/components/shared/ExtensionsMarketplace.jsx currently has 10 hardcoded extension packs.

Make them functional:
1. When an extension is installed, it should create custom agents with specific system prompts
2. Each extension pack should define: agents (with IDs, names, system prompts), and default build mode
3. Store installed extensions and their agent configs in localStorage
4. Installed agents should appear in the agent selector dropdown
5. Add an "Uninstall" confirmation dialog
6. Add a way to create custom extension packs (user defines name, description, agents)

Read ExtensionsMarketplace.jsx and learning.js (createCustomAgent) first - the auto-agent creation already works, just needs better system prompts per extension.
```

---

## Priority 7: Keyboard Shortcuts Customization

```
Add keyboard shortcut customization to Soupz.

1. Create packages/dashboard/src/lib/shortcuts.js with default shortcuts:
   - Cmd+1: Chat mode
   - Cmd+2: IDE mode
   - Cmd+Shift+P: Command palette
   - Cmd+K: Command palette
   - Cmd+S: Save file
   - Cmd+Shift+F: Search files
   - Enter: Send message
   - Shift+Enter: New line
2. Store custom shortcuts in localStorage 'soupz_shortcuts'
3. In ProMode settings panel, add a "Keyboard Shortcuts" section where users can click a shortcut and press a new key combo to rebind
4. Update App.jsx and ProMode.jsx to read shortcuts from the config instead of hardcoding
```

---

## Priority 8: Project .soupz Config

```
Add project-level configuration for Soupz.

When the daemon starts, it reads a .soupz.json file from the project root (if it exists):
{
  "defaultAgent": "claude-code",
  "defaultBuildMode": "planned",
  "customAgents": [...],
  "mcpServers": [...],
  "theme": "tokyo-night"
}

Tasks:
1. In packages/remote-server/src/index.js, read .soupz.json from REPO_ROOT on startup
2. Expose it via GET /api/config endpoint
3. In the dashboard, fetch this config on load and apply defaults
4. Add a UI in settings to edit the config (writes back via POST /api/config)
```

---

## Quick Fixes Backlog

```
Fix these small issues in packages/dashboard/:

1. Monaco minimap: In ProMode.jsx, change minimap: { enabled: false } to { enabled: true } and add a toggle in settings
2. Workspace trust indicator: Show a lock/shield icon in the status bar when connected, with the machine hostname
3. Real git branch: In StatusBar.jsx, fetch the actual branch from daemon.gitStatus() instead of hardcoding "main"
4. File execution: Add POST /api/exec endpoint to the daemon (packages/remote-server/src/index.js) that runs a file and returns stdout/stderr. Wire up the Run button in ProMode.
5. Settings persistence: Make the editor settings (font ligatures, smooth scrolling, word wrap) actually apply to Monaco and persist in localStorage
```

---

## Architecture Notes

- Frontend: React 18 + Vite at packages/dashboard/
- Backend: Node.js ESM at packages/remote-server/
- Auth: Supabase (optional, falls back to local mode)
- Daemon port: 7533 (set in .env SOUPZ_REMOTE_PORT)
- All UI state in localStorage (no server-side state)
- CSS themes via custom properties in index.css
- 12 themes available, all use --*-ch channel vars for Tailwind opacity
