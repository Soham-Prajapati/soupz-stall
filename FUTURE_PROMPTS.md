# Soupz - What's Done & What's Next

## Current State (as of 2026-03-20)

### Working Features
- Chat mode (Lovable-style centered prompt with suggestion chips that send on click)
- IDE mode (Monaco editor, file tree, git panel, extensions, search, terminal)
- 12 color themes
- Command palette (Cmd+K / Cmd+Shift+P)
- Search across files (Cmd+Shift+F) in IDE sidebar
- Resizable panels (sidebar, chat, terminal)
- Breadcrumbs above editor
- Minimap in editor
- VS Code-style status bar (subtle, not bold)
- Terminal panel (resizable)
- Profile page (/profile) with avatar, stats, edit name, sign out
- Leaderboard with XP, levels, rank badges, milestones (in sidebar Trophy icon)
- RAG memory system (auto-saves conversation shards, retrieves relevant context)
- QR code on connect page
- Google/GitHub/Apple OAuth (AuthScreen - only social login, no email/password)
- Git co-author tag (Soupz agent in commits)
- Neural TTS (Kokoro) with browser fallback
- Smart agent routing (keyword + Ollama + daemon cascade)
- Extensions marketplace (10 hardcoded packs)
- Gamification/achievements
- MCP server configuration
- Stats panel accessible from sidebar (Trophy icon)

### Deployed At
- Vercel: soupz.vercel.app
- Repo: github.com/Soham-Prajapati/soupz-stall
- Daemon port: 7533 (SOUPZ_REMOTE_PORT in .env)

---

## PENDING - Priority Order

### 1. Finish GitHub OAuth Setup (Manual - not code)
Go to github.com > Settings > Developer settings > OAuth Apps > New OAuth App.
- Application name: Soupz
- Homepage URL: https://soupz.vercel.app
- Authorization callback URL: https://apxlxvijazebukrykovk.supabase.co/auth/v1/callback
- Don't check "Enable Device Flow"
- Register, copy Client ID + generate Client Secret
- Go to Supabase dashboard > Auth > Sign In / Providers > GitHub > paste both > Save
- Supabase > Auth > URL Configuration > set Site URL to https://soupz.vercel.app
- Add redirect URLs: http://localhost:5173, http://localhost:5174, http://localhost:7534

### 2. Google OAuth Setup (Manual)
- Google Cloud Console > APIs & Credentials > Create OAuth 2.0 Client
- Authorized redirect URI: https://apxlxvijazebukrykovk.supabase.co/auth/v1/callback
- Copy Client ID + Secret to Supabase > Auth > Providers > Google

### 3. Make Chat Mode More Lovable-like
```
The chat mode in SimpleMode.jsx needs UX improvements to feel less like a dev tool and more like Lovable:

1. When no messages, show a greeting with the user's name (from Supabase user_metadata or localStorage profile)
2. Add more suggestion chips - categorized: "Build" (landing page, portfolio, dashboard), "Fix" (debug error, fix CSS), "Learn" (explain this code, teach me React)
3. Make suggestion chips animated - fade in with stagger
4. Add a subtle gradient or pattern background behind the empty state (not as extreme as Lovable's gradient, but warmer than plain dark)
5. The top bar with Auto/Quick/routing should be hidden when no messages exist - show it only after first message or in IDE mode
6. Add typing indicator animation when AI is responding (three bouncing dots, already exists but verify it shows)
```

### 4. Supabase Tables for User Data
```
Create Supabase tables to persist user data server-side instead of just localStorage:

1. Create table 'soupz_profiles': id (uuid, FK to auth.users), display_name, avatar_url, xp, level, streak, created_at
2. Create table 'soupz_projects': id, user_id, name, description, agent_id, created_at, last_active
3. Create table 'soupz_usage': id, user_id, agent_id, message_count, date, category

In the dashboard:
- After OAuth login, upsert the user's profile
- Sync XP/level/streak to Supabase so leaderboard can be real (not mock)
- Create a real leaderboard by querying soupz_profiles ordered by XP

Files to modify: lib/learning.js (add Supabase sync), LeaderboardPanel.jsx (fetch real data), App.jsx (profile sync on login)
```

### 5. Split Editor
```
In ProMode.jsx, add split editor support:
- Add a split button in the toolbar
- When split, render two Monaco Editor instances side by side
- Each pane has independent file state
- Track which pane is focused for StatusBar cursor info
- Close button on each pane
```

### 6. Extensions as Real Agent Configs
```
ExtensionsMarketplace.jsx has 10 hardcoded packs. Make them functional:
- Each pack should define agents with system prompts
- When installed, agents appear in the agent selector
- createCustomAgent() in learning.js already works - just needs proper system prompts per extension
- Add ability to create custom extension packs
```

### 7. Keyboard Shortcut Customization
```
Create lib/shortcuts.js with configurable key bindings.
Add a "Keyboard Shortcuts" editor in settings where users can click a shortcut and press new keys to rebind.
Store in localStorage 'soupz_shortcuts'.
Update App.jsx and ProMode.jsx to read from config instead of hardcoded keys.
```

### 8. Project .soupz Config
```
Read .soupz.json from project root when daemon starts:
{ "defaultAgent": "claude-code", "defaultBuildMode": "planned", "theme": "tokyo-night" }
Expose via GET /api/config endpoint.
Dashboard fetches and applies on load.
```

### 9. File Execution (Run Button)
```
The Run button in ProMode exists but runFile() is stubbed.
Add POST /api/exec to daemon (packages/remote-server/src/index.js):
- Accepts { path, command? }
- Spawns the file with appropriate runtime (node for .js, python for .py, etc.)
- Streams stdout/stderr back
Wire up ProMode's runFile() to call this endpoint.
```

### 10. Real Git Branch in Status Bar
```
StatusBar.jsx hardcodes "main". Fix:
- Add a gitBranch prop
- In App.jsx, fetch branch from daemon.gitStatus() on connect
- Pass to StatusBar
- Update when git operations happen
```

### 11. Settings Persistence
```
The editor checkboxes (font ligatures, smooth scrolling, word wrap) don't actually apply.
- Store settings in localStorage 'soupz_editor_settings'
- Apply them to Monaco Editor options in ProMode
- Read on mount, update on change
```

### 12. Proper Landing Page
```
LandingPage.jsx exists but needs work to compete with Lovable:
- Hero section with gradient background
- Feature grid
- How it works steps
- Pricing comparison (free vs competitors)
- CTA buttons
Make it feel premium, not AI-generated.
```

### 13. Make Users Use Their Own Supabase
```
Instead of hardcoding your Supabase keys, let users bring their own:
- During npx soupz setup, prompt for Supabase URL + key (or skip for local-only)
- Store in .soupz.json config
- Daemon reads and uses their Supabase for persistence
- This way users' data stays in their own Supabase project
```

### 14. Mobile Responsiveness
```
Currently mobile just shows SimpleMode (chat only).
Improve:
- Swipe gestures to open/close panels
- Bottom navigation bar on mobile
- Touch-friendly button sizes
- File tree as a full-screen modal on mobile
```

### 15. Notifications System
```
The StatusBar has a notifications bell but it's mostly empty.
Add real notifications:
- Agent completed task
- Git push success/failure
- Achievement unlocked
- Streak milestone
Toast notifications + bell dropdown
```

---

## Architecture Notes for Future AI Assistants

- Frontend: React 18 + Vite at packages/dashboard/
- Backend: Node.js ESM at packages/remote-server/
- Auth: Supabase (optional, falls back to local)
- Daemon port: 7533 (SOUPZ_REMOTE_PORT in .env)
- All UI state in localStorage
- CSS themes via custom properties in index.css
- Tailwind classes use CSS variable channels (--*-ch vars)
- Use font-ui for UI text, font-mono for code
- Use Lucide icons only
- No emojis in code
- Git commits include Co-Authored-By: Soupz <agent@soupz.vercel.app>
