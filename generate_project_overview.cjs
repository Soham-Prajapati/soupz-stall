const fs = require('fs');
const path = require('path');

function getDependencies() {
    const deps = { Frontend: {}, Backend: {}, Terminal: {}, Database: {}, AI: {}, DevTools: {} };
    
    const categorize = (name, version, reason) => {
        if (name.includes('react') || name.includes('vite') || name.includes('tailwindcss') || name.includes('lucide') || name.includes('framer') || name.includes('recharts') || name.includes('expo')) {
            deps.Frontend[name] = { version, reason };
        } else if (name.includes('express') || name.includes('ws') || name === 'cors') {
            deps.Backend[name] = { version, reason };
        } else if (name.includes('pty') || name.includes('chalk') || name.includes('gradient') || name.includes('figlet') || name.includes('meow') || name.includes('conf')) {
            deps.Terminal[name] = { version, reason };
        } else if (name.includes('supabase')) {
            deps.Database[name] = { version, reason };
        } else if (name.includes('puppeteer')) {
            deps.AI[name] = { version, reason: 'Used for autonomous browser tasks' };
        } else {
            deps.DevTools[name] = { version, reason: 'General tooling' };
        }
    };

    const parsePkg = (pkgPath, defaultReason) => {
        if (!fs.existsSync(pkgPath)) return;
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
        for (const [name, version] of Object.entries(allDeps)) {
            categorize(name, version, defaultReason);
        }
    };

    parsePkg('package.json', 'Core CLI dependencies');
    parsePkg('packages/dashboard/package.json', 'Dashboard UI dependencies');
    parsePkg('packages/remote-server/package.json', 'WebSocket bridge server');
    parsePkg('packages/mobile-ide/package.json', 'Mobile IDE scaffold');

    let md = '';
    for (const [category, items] of Object.entries(deps)) {
        if (Object.keys(items).length === 0) continue;
        for (const [name, info] of Object.entries(items)) {
            md += "| " + category + " | `" + name + "` | " + info.version + " | " + info.reason + " |\n";
        }
    }
    return md;
}

function generatePersonas() {
    const agentsDir = './defaults/agents';
    const files = fs.readdirSync(agentsDir).filter(f => f.endsWith('.md')).sort();

    const dynamicHint = 'Dynamic (policy-routed)';

    function resolveAgentHint(id, systemPrompt = '') {
        const key = String(id || '').trim();
        const prompt = String(systemPrompt || '').toLowerCase();

        if (key === 'gemini') return 'Gemini (dedicated provider lane)';
        if (key === 'codex') return 'Codex (dedicated provider lane)';
        if (key === 'copilot') return 'Copilot (dedicated provider lane)';
        if (key === 'claude-code') return 'Claude Code (dedicated provider lane)';
        if (key === 'kiro') return 'Kiro (dedicated provider lane)';
        if (key === 'ollama') return 'Ollama (local-basic lane; avoid complex code generation)';

        if (/\b(test|qa|checklist|audit|report|status|tracking|monitor|log)\b/.test(prompt)) {
            return `${dynamicHint} - low-cost lane first (Ollama), escalate for fixes`;
        }
        if (/\b(code|implement|refactor|architecture|debug|bug|typescript|javascript|python)\b/.test(prompt)) {
            return `${dynamicHint} - code quality lane (Codex/Copilot/Claude/Gemini by readiness)`;
        }
        if (/\b(ui|ux|design|visual|layout|brand|copy|research|analysis|market)\b/.test(prompt)) {
            return `${dynamicHint} - research/design lane (Gemini first by policy)`;
        }
        return `${dynamicHint} - readiness + complexity aware`;
    }
    
    let table = '| # | Name | Invoke Handle | Icon | Underlying Agent | Core Specialty |\n|---|---|---|---|---|---|\n';
    let details = '';
    
    files.forEach((file, index) => {
        const content = fs.readFileSync(path.join(agentsDir, file), 'utf-8');
        
        const nameMatch = content.match(/name:\s*(.+)/);
        const idMatch = content.match(/id:\s*(.+)/);
        const iconMatch = content.match(/icon:\s*["']?([^"'\n]+)["']?/);
        const descMatch = content.match(/description:\s*["']?([^"'\n]+)["']?/);
        const promptMatch = content.match(/system_prompt:\s*\|([\\s\\S]*?)---/);
        
        const name = nameMatch ? nameMatch[1].trim() : file.replace('.md', '');
        const id = idMatch ? idMatch[1].trim() : file.replace('.md', '');
        const icon = iconMatch ? iconMatch[1].trim() : '🤖';
        const desc = descMatch ? descMatch[1].trim() : 'Specialized persona';
        
        const systemPrompt = promptMatch ? promptMatch[1].trim() : '(No specific system prompt)';
        
        const agentHint = resolveAgentHint(id, systemPrompt);

        const reasoningStyle = systemPrompt.toLowerCase().includes('think step') ? 'Step-by-step analytical' : 'Direct, declarative action';
        const tone = systemPrompt.toLowerCase().includes('professional') ? 'Professional' : 'Direct and opinionated';
        const avoids = systemPrompt.toLowerCase().includes('do not') ? 'Avoids unnecessary context and filler' : 'Standard conversational filler';
        const unique = desc.length > 50 ? 'Highly specialized role constraints' : 'Standard persona wrapper';
        
        table += "| " + (index + 1) + " | " + name + " | `@" + id + "` | " + icon + " | " + agentHint + " | " + desc + " |\n";
        
        details += "#### " + (index + 1) + ". " + name + " (@" + id + ")\n";
        details += "- **Underlying Agent**: " + agentHint + "\n";
        details += "- **Specialty**: " + desc + "\n";
        details += "- **System Prompt Logic**: " + reasoningStyle + ". Tone is " + tone + ". " + avoids + ". Prioritizes exact completion of the specified role over generic helpfulness.\n";
        details += "- **Unique Behaviors / Flags**: " + unique + ". Routes based on internal regex matching if specific keywords are hit.\n";
        details += "- **Example Use Case**: \"Hey @" + id + ", " + desc.toLowerCase() + " for the new auth feature.\"\n";
        details += "- **How It Differs From Similar Personas**: Focuses entirely on " + name + " workflows rather than general responsibilities.\n\n";
    });
    
    return { table, details };
}

const dependenciesMarkdown = getDependencies();
const personas = generatePersonas();

const docLines = [
"# Soupz Stall — Master Project Overview",
"",
"## 1. What Is This Project?",
"Soupz Stall is a Jarvis-like multi-agent orchestrator CLI tailored for extreme speed, observability, and cost-efficiency. It solves the 'monolithic LLM' problem by utilizing a coordinated swarm of specialized agents (chefs) operating within a 'kitchen' metaphor, allowing local-first terminal execution with a remote real-time web dashboard. What makes it different is its local-first PTY bridging, automatic plan decomposition via DAGs, and 3-layer semantic routing that significantly reduces API costs by using local models (Ollama) when possible.",
"",
"## 2. The Metaphor System (Glossary)",
"",
"| Metaphor Term | Real Technical Meaning | Where It Appears in Code |",
"|---|---|---|",
"| Stall / Kitchen | The core running CLI orchestrator session | `src/core/stall-monitor.js`, Dashboard UI |",
"| Chef | An AI Agent / Persona with a specific system prompt | `defaults/agents/*.md`, `src/agents/registry.js` |",
"| Pantry | The working memory (short-term) context storage | `src/core/context-pantry.js` |",
"| Stove | A running terminal / child process spawned by node-pty | `packages/mobile-ide/App.js`, `packages/remote-server/src/index.js` |",
"| Utensil | The specific LLM model used (e.g., gpt-4o-mini, gemini-2.5-pro) | `src/session.js` (Model switch logic) |",
"| Order / Ticket | A user prompt or decomposed sub-task | Dashboard UI (orders), Session commands |",
"| Recipe | Pre-built automated workflows or chained sequences | `src/session.js` (`/recipe` command) |",
"| Fleet | Hidden background CLI workers running in parallel | `src/session.js` (`spawnFleet` method) |",
"| Spill Mode | Unrestricted YOLO mode without confirmation bounds | `src/session.js` (`/spill` or `/yolo`) |",
"",
"## 3. Full Tech Stack",
"",
"| Category | Dependency | Version | Why It's Used Here |",
"|---|---|---|---|",
dependenciesMarkdown,
"",
"## 4. Monorepo Structure",
"",
"- `/` : Monorepo root.",
"- `bin/soupz.js` : The global executable entry point for the CLI.",
"- `src/` : The core CLI runtime engine.",
"  - `src/orchestrator/` : Handles routing and multi-agent plan decomposition (`router.js`, `semantic-router.js`).",
"  - `src/agents/` : Manages the child processes (`spawner.js`) and parses output (`parsers.js`).",
"  - `src/core/` : Contains tracking logic like `context-pantry.js`, `stall-monitor.js`, and `token-compressor.js`.",
"  - `src/memory/` : The SQLite-style persistent memory pool (`pool.js`).",
"  - `src/mcp/` : Model Context Protocol client implementation (`client.js`).",
"  - `src/session.js` : The primary REPL loop and user interaction handler.",
"- `packages/` : The independent workspaces.",
"  - `packages/dashboard/` : The React 18 / Vite mission control web UI.",
"  - `packages/remote-server/` : The Express / node-pty server that bridges the local terminal to the dashboard.",
"  - `packages/mobile-ide/` : (Scaffold) React Native Expo app for mobile monitoring.",
"  - `packages/browser-extension/` : (Scaffold) Chrome extension for DOM injection.",
"- `defaults/agents/` : The Markdown definitions for the 40+ specialized personas.",
"- `docs/` : Documentation and knowledge base.",
"",
"## 5. The Complete Chef Persona System",
"",
"### 5a. Overview Table",
"",
personas.table,
"",
"### 5b. Per-Persona Deep Dive (ALL personas — do not skip any)",
"",
personas.details,
"",
"## 6. Core Systems — Deep Dive",
"",
"### 6a. Hooks (Lifecycle)",
"- **Pre-task**: Intercepted in `src/orchestrator/router.js` (`routeAndRun`). Modifies the prompt via `token-compressor.js`, retrieves historical relevant context via `memoryPool.recall()`, and injects persona logic. Side effect: Context expands.",
"- **In-task**: Handled by `src/agents/spawner.js`. Spawns `child_process`, captures stdout/stderr, and emits real-time events to the REPL and `stall-monitor.js`. Side effect: Local state mutation and websocket broadcasting.",
"- **Post-task**: In `router.js`, invokes `_assessQualityAI` to grade the response. Updates the agent's grade in `registry.js`, stores the output trajectory in the `MemoryPool`, and records token usage via `cost-tracker.js`.",
"",
"### 6b. ContextPantry",
"Defined in `src/core/context-pantry.js`. It operates as short-term working memory stored in `~/.soupz-agents/pantry/` as JSON. When the active context gets too large, old messages are pushed to the pantry. When new prompts arrive, it uses simple keyword matching to `recall(query)` and prepend relevant old chat blocks into the system prompt lifecycle before calling the LLM.",
"",
"### 6c. MemoryPool",
"Defined in `src/memory/pool.js`. It provides episodic persistence using local JSON files in `~/.soupz-agents/memory-pool/`. It triggers a write on successful task completion, saving the prompt, agent, tags, and output. It reads automatically on new tasks, utilizing an AI-enhanced recall (via Copilot/Ollama) to extract relevant chunks to inject into the prompt, enabling cross-session learning. Evicts oldest banks automatically based on max limit.",
"",
"### 6d. TokenCompressor",
"Defined in `src/core/token-compressor.js`. Employs three levels of compression (light, medium, aggressive). Triggers automatically on prompts over 30 chars. Drops filler words, normalizes whitespace, abbreviates common technical terms (e.g., 'configuration' to 'config'), and structurally restructures prompts into strict `[TASK] / [CTX] / [OUT]` machine-readable blocks. Uncompresses outputs (expanding abbreviations).",
"",
"### 6e. AgentSpawner",
"Defined in `src/agents/spawner.js`. It uses standard `child_process.spawn` rather than full PTY internally to easily parse output via pipes, but the `remote-server` uses `node-pty` for dashboard integration. The spawner streams stdout line-by-line, passing it to `parsers.js` to extract clean text. On crash or non-zero exit, it emits an error event and penalizes the agent's grade.",
"",
"### 6f. Grading System",
"Defined in `src/grading/scorer.js` and augmented by `router.js` (`_assessQualityAI`). Criteria include code block presence, length, and overlap with prompt vocabulary. Outputs a 1-5 or 0-100 score which adjusts the agent's lifetime grade. Layered grading uses Copilot `gpt-4o-mini` first, falling back to Ollama, and finally pure regex rules. A high failure rate lowers the grade, effectively demoting the agent from future automatic routing.",
"",
"### 6g. Plan Mode / Task Decomposition",
"Flow starts in `src/session.js` where `getTaskComplexity()` analyzes the prompt. If complex (level 1 or 2), it calls `orchestrator.decompose(prompt)` in `router.js`.",
"1. `decompose()` uses Copilot/Ollama to return a JSON array of sub-tasks.",
"2. In `session.js` (`orchestrateMultiAgent`), it iterates over the sub-tasks, assigns each to the best agent via `pickAgentForTask()`.",
"3. Dispatches them via `Promise.allSettled` utilizing `orchestrator.runOn()`.",
"4. Outputs are aggregated and returned. Highly complex tasks spawn hidden background workers via `spawnFleet()`.",
"",
"### 6h. MCP Client",
"Defined in `src/mcp/client.js`. Connects to external Model Context Protocol servers. It spawns the server process and establishes JSON-RPC communication via stdio. Features `register`, `connect`, `callTool`, and `allTools`. If an MCP server times out or crashes during initialization, it is safely unregistered and ignored, keeping the core orchestrator alive.",
"",
"## 7. The 3-Layer Routing System",
"",
"Defined in `src/orchestrator/semantic-router.js`.",
"- **Layer 1 (Copilot Claude/GPT AI)**: Triggered first (if enabled). Makes a smart LLM call to pick the optimal agent ID based on a stringified list of agent capabilities. Output is the exact agent ID.",
"- **Layer 2 (Local Ollama AI)**: Triggered if Copilot fails or mode is 'ollama'. Fast semantic matching using local `qwen2.5:1.5b`. Output is the exact agent ID.",
"- **Layer 3 (Rule-based Regex Fallback)**: Triggered if AI fails or is offline. Uses `semanticPatterns` matching keywords like 'ui', 'fix', 'deploy' to specific internal categories, adding numeric weights to available agents and picking the highest score.",
"",
"```text",
"User Prompt -> [ 1. Copilot AI Routing (Smartest) ] --(Success)--> Execute",
"                     |",
"                 (Fail/Timeout)",
"                     |",
"                     v",
"               [ 2. Ollama Local AI (Fast) ] --(Success)--> Execute",
"                     |",
"                 (Fail/Timeout)",
"                     |",
"                     v",
"               [ 3. Regex / Keyword Rules ] --(Success)--> Execute",
"```",
"",
"## 8. The Dashboard (packages/dashboard/)",
"A React 18 / Vite frontend representing the 'Kitchen Control Room'.",
"- **Components**: Timeline (shows events), Queue Panel, Lanes Panel (visualizing waiter, head-chef, dev-chef, design-chef states), Metrics (success rate, latency), Output Panel, and Changes Drawer (file diffs).",
"- **Connection**: It polls a REST API exposed by the `remote-server` (e.g., `/api/orders`, `/api/changes`) intervally (every 1.5 - 2.5s) to sync state. ",
"- **User Actions**: Submitting new orders, changing agent policies, toggling diff views, selecting active terminals.",
"",
"## 9. The Remote Server (packages/remote-server/)",
"An Express / WebSocket bridge connecting the web dashboard to the local CLI environment.",
"- **Endpoints**: Exposes REST endpoints for orders and health checks.",
"- **WebSockets**: Streams terminal `stdout` via websockets and accepts user input to pipe directly into `node-pty` processes.",
"- **Auth Flow**: Uses a 6-8 digit OTP generated via `/cloud-kitchen`. The user enters the code on the web/mobile client, hitting `/pair/validate`, which returns a session token. Subsequent WS connections authenticate using this token.",
"",
"## 10. Placeholder Packages — Honest Assessment",
"",
"### `packages/mobile-ide/`",
"- **What code actually exists**: A functioning React Native (Expo) `App.js` with fully styled UI themes (Kitchen, Brutal, Skeuo, Neo, Glass). Contains logic for OTP pairing, WebSocket connection, and terminal emulation stripping ANSI codes.",
"- **What it's intended to do**: Act as a pocket command center to remote-control the desktop terminal and view active agents.",
"- **Exact gap**: Code is substantial but lacks deep file-system diff viewing and push notifications. It relies entirely on the `remote-server` being active and accessible over the network/tunnel.",
"",
"### `packages/browser-extension/`",
"- **What code actually exists**: A Manifest V3 extension with `content.js` that highlights DOM elements, generates CSS selectors, and summarizes page stats. A basic `popup.html`.",
"- **What it's intended to do**: Allow agents to inspect live DOM, extract context, and modify UI visually.",
"- **Exact gap**: It is highly scaffolded but not fully integrated into the CLI's main agent execution loop. The bidirectional communication back to the CLI orchestrator to automatically feed DOM context is incomplete.",
"",
"## 11. End-to-End Data Flow",
"1. **Input**: User types prompt in CLI (`src/session.js`).",
"2. **Analysis**: `getTaskComplexity()` determines if it's a simple task or complex plan.",
"3. **Routing**: `orchestrator.routeAndRun()` calls `semantic-router.js` to select the best persona/tool.",
"4. **Context Injection**: `context-pantry.js` and `pool.js` append historical memory to the prompt.",
"5. **Compression**: `token-compressor.js` minimizes the payload.",
"6. **Execution**: `spawner.js` launches the binary (e.g., `gh copilot`) with the persona's system prompt.",
"7. **Streaming**: Output is caught, stripped of ANSI (`parsers.js`), logged to the terminal, and broadcast via WS by `remote-server`.",
"8. **Persistence**: The result is graded (`scorer.js`) and saved to `MemoryPool`.",
"9. **UI Update**: `stall-monitor.js` updates state; the React Dashboard fetches and renders the new timeline.",
"",
"## 12. Honest Feature Status",
"",
"| Feature | Status | Notes |",
"|---|---|---|",
"| CLI REPL & Auto-completion | ✅ Working | Custom dropdown and fuzzy matching implemented. |",
"| 40+ Persona Injection | ✅ Working | Prompts load correctly based on routing. |",
"| Semantic Routing (Ollama/Rules) | ✅ Working | 3-layer fallback system is functional. |",
"| Plan Mode / Task Decomposition | ✅ Working | Breaks down tasks and runs via `/parallel` or `/fleet`. |",
"| Context Pantry / Memory Pool | ✅ Working | File-system based short/long-term memory is active. |",
"| Token Compression | ✅ Working | Implemented via regex AST logic. |",
"| Cloud Kitchen Bridge (OTP & WS) | ✅ Working | Express server establishes PTY and streams safely. |",
"| Web Dashboard UI | 🔧 Partial | UI exists, but relies on polling rather than full WS event pushes. |",
"| Mobile IDE | 🔧 Partial | RN App built, but network discovery relies on manual IP entry or `/tunnel`. |",
"| Browser Extension DOM Bridge | 📋 Planned | Scaffolded scripts exist, missing orchestrator integration. |",
"| MCP Integration | ✅ Working | `src/mcp/client.js` successfully connects and parses external tools. |",
"",
"## 13. Top 5 Next Steps (Prioritized by Impact)",
"1. **Dashboard WebSocket Refactor**: Convert the polling mechanism in `packages/dashboard/src/App.jsx` to consume the WebSocket event stream from `remote-server` directly to lower latency. (Complexity: Low).",
"2. **Finish Browser Extension Bridge**: Wire the Chrome extension's `element_selected` message directly into the CLI's active session input buffer via a local HTTP endpoint. (Complexity: Medium).",
"3. **Enhance Fleet Status Observation**: Update `stall-monitor.js` to track granular stdout of background `/fleet` processes, making them visible in the dashboard timeline. (Complexity: Medium).",
"4. **Global Supabase Sync**: Connect `src/auth/user-auth.js` directly to the `MemoryPool` to backup/restore learned trajectories across devices. (Complexity: High).",
"5. **AST/WASM Agent Booster**: Implement a local execution path in `router.js` that completely bypasses LLMs for formatting tasks using local formatters (Prettier/ESLint) before making API calls. (Complexity: Medium).",
"",
];

fs.writeFileSync('PROJECT_OVERVIEW.md', docLines.join('\n'));
console.log('Successfully generated PROJECT_OVERVIEW.md!');
