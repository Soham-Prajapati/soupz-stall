# Soupz Stall — Complete Project Reference (Detailed Overview)

> **Audience:** External agents, interview prep, and project stakeholders. This document provides a canonical, in-depth view of the **Soupz Stall** project.

---

## 🏗️ 1. Project Vision

**Soupz Stall** is a local-first, multi-agent orchestration platform that transforms standard AI coding tools into a transparent, observable, and highly efficient development environment. It follows an **"open food-stall yard"** metaphor, where tasks are "orders", agents are "chefs", and the execution pipeline is the "kitchen".

### The Problem We Solve
Traditional AI coding tools operate in a "black box" manner. Soupz Stall provides **complete observability**:
- **Why** an agent was selected (routing logic).
- **What** prompt was sent (including injected context).
- **How** the agent executed (real-time stdout/stderr streaming via PTY).
- **The Result** (diffs, metrics, and quality grading).

---

## 🛠️ 2. Tech Stack & Architecture

| Layer | Technology |
|---|---|
| **Frontend** | React 18, Vite, Framer Motion, Tailwind CSS |
| **Backend** | Node.js, Express, WebSocket (`ws`) |
| **Terminal Bridge** | `node-pty` (true terminal emulation) |
| **Auth** | OTP pairing codes + session tokens (crypto-based) |
| **Database** | Supabase (PostgreSQL) — optional persistence |
| **AI Agents** | GitHub Copilot CLI, Google Gemini CLI, Ollama (local) |
| **Monorepo** | Native pnpm workspaces |

### Component Roles
- **`src/`**: Core CLI runtime, orchestration, session management, and hooks.
- **`packages/dashboard/`**: Browser-based UI for live monitoring and interaction.
- **`packages/remote-server/`**: The bridge between the web dashboard and the local CLI runtime.
- **`packages/mobile-ide/`**: A React Native scaffold for mobile-based agent control.
- **`packages/browser-extension/`**: A scaffold for triggering agents directly from any browser tab.

---

## 🧩 3. Core Concepts & "Special Features"

### 🛡️ 1. Hooks (Lifecycle Extension)
Hooks allow us to inject logic into the agent's execution lifecycle:
- **Pre-Task**: Context loading from the `ContextPantry` and prompt optimization.
- **In-Task**: Real-time event streaming via `AgentSpawner` to the `StallMonitor`.
- **Post-Task**: Quality grading via `Grading`, persistence via `MemoryPool`, and delegation parsing for chained tasks.

### 🔌 2. MCP (Model Context Protocol)
Located in `src/mcp/client.js`, the MCP client enables `soupz-agents` to connect to external tool servers. This follows the standard protocol, allowing agents to use custom tools (like file system access or API connectors) provided by any MCP-compliant server.

### 🧠 3. Memory Management
- **Immediate Context**: `ContextPantry` stores the current conversation state.
- **Long-term Memory**: `MemoryPool` persists results across sessions, allowing for cross-session continuity and learning from previous tasks.
- **Token Compression**: `TokenCompressor` automatically shortens long context to save tokens while preserving critical meaning.

### 📋 4. Plan Mode (Task Decomposition)
When a complex, multi-step prompt is submitted, the system automatically:
1. **Analyzes** complexity using `getTaskComplexity()`.
2. **Decomposes** it into a `todoList` using `orchestrator.decompose()`.
3. **Assigns** sub-tasks to the best-matching agent (e.g., UI tasks to Gemini, logic to Copilot).
4. **Executes** via `/do` or `/parallel`.

---

## 🚀 4. Efficiency & Cost Optimization (Competitive Edge)

Inspired by systems like **Ruflo**, Soupz Stall focuses on aggressive token reduction and cost optimization:

- **Smart Semantic Routing**:
  - **Layer 1**: Claude Sonnet (via Copilot) for complex routing.
  - **Layer 2**: Ollama (`qwen2.5:1.5b`) for local/offline routing.
  - **Layer 3**: Regex rules for basic categorization (styling vs. coding).
- **Cheap Model Default Path**: Routing simple tasks to cheaper models (Ollama or GPT-4o-mini) and reserving premium models for complex reasoning.
- **ReasoningBank**: Only retrieving the most relevant "trajectories" and patterns from memory to avoid massive context windows.
- **Observable Metrics**: Real-time tracking of estimated token usage and cost per agent.

---

## 👨‍🍳 5. The Persona System (Chefs)

Personas are **layered specialists**. They aren't standalone binaries; they are system prompt configurations that "steer" an underlying headless agent (Copilot or Gemini).

| Icon | Chef Name | Invoke | Specialty |
|---|---|---|---|
| 🎨 | Designer | `@designer` | HTML/CSS prototypes, SVG art, branding |
| 🏗️ | Architect | `@architect` | System design, API schemas, DB design |
| 🛡️ | Security | `@security` | Auth flows, vulnerability analysis |
| 🧪 | Tester | `@tester` | Unit/E2E tests, edge cases |
| ⚡ | Maestro | `@maestro` | Orchestration, party mode, pipeline mode |

---

## 📈 6. Current Roadmap & Pending Features

### High Priority
- [ ] **Cloud Backend**: Deploying `remote-server` to Railway for persistent cloud access.
- [ ] **WebSocket Stream**: Replacing dashboard polling with real-time push events.
- [ ] **DB-First Orders**: Making the order history persistent via Supabase.

### Innovation Track
- [ ] **Agent Booster (WASM)**: Running simple code transformations locally (using WASM) to skip the LLM and reduce cost by up to 75% for basic tasks.
- [ ] **Fleet Monitoring**: Enhanced UI for managing dozens of background parallel workers.
- [ ] **Mobile IDE Completion**: Fully functional React Native app for remote coding.

---

## 📊 7. Key Interview Talking Points

1. **Observability**: "We move AI coding from a black box to a transparent kitchen timeline."
2. **Multi-Agent Coordination**: "How we decompose a complex request into parallel sub-tasks assigned to specialist engines."
3. **Local-First Bridge**: "The architecture of using a local CLI with a remote PTY bridge for secure, direct file access."
4. **Token Efficiency**: "How we use semantic routing and local pre-processing to drastically reduce LLM costs."
5. **Protocol Support**: "Our integration of MCP (Model Context Protocol) for extensibility."

---

*Last updated: 2026-03-16*
