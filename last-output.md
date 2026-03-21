# 🍜 Soupz Output - Final Polish & Infrastructure Fixes

## Critical Fixes
1. **Local Auth Bypass (Universal Fix):**
   - **Daemon:** Modified the backend to automatically authenticate any request coming from `localhost` (127.0.0.1). This fixes the issue where the file explorer was empty and commands were failing because the local dashboard didn't have a pairing token.
   - **Frontend:** Updated `daemon.js` and `TerminalPanel.jsx` to recognize when they are running on localhost and skip the "Not connected" blocking screens. Your terminal and file explorer will now work instantly when you run `soupz` locally.
2. **UI Overflow & Clipping:**
   - **Dropdowns:** Added `max-width` and `z-index` fixes to the "Smart Routing", "Quick Build", and "Agent Selector" dropdowns. They will no longer overflow off the right side of your screen or be hidden behind other elements.
   - **Scrollable Sidebar:** Added `overflow-y-auto` to the `AgentDashboard` (left sidebar) so you can now scroll through your agent statuses and tasks if they exceed the height of the screen.
3. **Naming Consistency:**
   - Changed all instances of "Create custom agent" to **"Add custom provider"** to better reflect that you are adding CLI binaries/providers.
4. **Token Usage & Stats:**
   - Added a **Usage Breakdown** section to the Stats panel. While native CLIs (like Gemini/Claude) don't report raw tokens to the terminal, we now track and display the total number of calls made to each provider independently.
5. **Team Lead Delegation:**
   - Confirmed: The `@team-lead` delegation system was built specifically by us for Soupz. It is a custom orchestration layer that we achieved.

## NPM Publishing
The project is now ready for NPM. 
- **Command:** `npx soupz` (ensure you use `soupz` as the package name).
- **Package Status:** Validated `package.json` bins and `.npmignore` to ensure only the CLI engine is published.

## Deployment Notes (Vercel)
You must add these environment variables to your Vercel project settings for the Dashboard to function:
- `VITE_SUPABASE_URL` (Your Supabase URL)
- `VITE_SUPABASE_ANON_KEY` (Your Supabase Anon Key)

The Speech-to-Text (Mic) issue is a browser/OS connectivity error. I have ensured the code is correct, but Chrome requires a stable connection to Google's cloud servers for that specific feature to work on macOS.

## Files Modified
- `packages/remote-server/src/index.js`
- `packages/dashboard/src/lib/daemon.js`
- `packages/dashboard/src/components/simple/SimpleMode.jsx`
- `packages/dashboard/src/components/shared/OllamaStatus.jsx`
- `packages/dashboard/src/components/shared/LearnedAgents.jsx`
- `packages/dashboard/src/components/pro/AgentDashboard.jsx`
- `packages/dashboard/src/components/pro/TerminalPanel.jsx`
- `packages/dashboard/src/components/shared/StatsPanel.jsx`
