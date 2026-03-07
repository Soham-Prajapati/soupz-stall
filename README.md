<div align="center">

```
       ███████╗  ██████╗  ██╗   ██╗ ██████╗  ███████╗
       ██╔════╝ ██╔═══██╗ ██║   ██║ ██╔══██╗ ╚══███╔╝
      ███████╗ ██║   ██║ ██║   ██║ ██████╔╝   ███╔╝
     ╚════██║ ██║   ██║ ██║   ██║ ██╔═══╝   ███╔╝
       ███████║ ╚██████╔╝ ╚██████╔╝ ██║      ███████╗
       ╚══════╝  ╚═════╝   ╚═════╝  ╚═╝      ╚══════╝
            S  T  A  L  L  v0.1-alpha
```

**Multi-agent AI orchestration CLI — your personal hackathon weapon** 🫕

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue)](LICENSE)
[![GitHub Copilot](https://img.shields.io/badge/Works%20with-GitHub%20Copilot-purple)](https://github.com/features/copilot)

</div>

---

## What is Soupz Stall?

Soupz Stall is a **multi-agent CLI** that orchestrates multiple AI tools (GitHub Copilot, Gemini) through a cast of **48 specialized chefs** (personas). Think of it like Claude Code's sub-agent system but running on your existing AI subscriptions — no extra API keys needed.

**Key differentiators:**
- **Parallel agent execution** — delegate design, architecture, and planning simultaneously across tool engines
- **3-layer AI routing** — Copilot-first routing picks the best engine×chef combo for every task
- **Token compression** — Copilot-first + rule-based preprocessing saves ~40% on input tokens
- **Live dashboard** — animated Kitchen Floor monitor shows chefs cooking in real time
- **Auto-active memory** — Pantry Banks store after each task and recall before each task automatically
- **MCP support** — built-in Model Context Protocol client for tool server integration
- **User auth** — Supabase-backed authentication with local fallback

---

## 🚀 Quick Start

```bash
# Install
git clone https://github.com/Soham-Prajapati/soupz-stall.git
cd soupz-stall
npm install
npm link    # makes `soupz` available globally

# Launch
soupz
```

> **Requirements:** At least one of: `gh` (GitHub Copilot CLI) or `gemini` (Gemini CLI)

### Optional: Ollama Setup (AI Routing + Token Compression)

```bash
# Install Ollama for AI-powered routing and token compression
brew install ollama  # or download from ollama.ai
ollama pull qwen2.5:1.5b  # Smart routing model (986MB)

# Optional: Remote Ollama (friend's machine with more RAM)
export OLLAMA_HOST=http://remote-ip:11434

# Optional: Docker for Ollama
docker run -d -p 11434:11434 ollama/ollama
docker exec -it <container> ollama pull qwen2.5:1.5b
```

> Without Ollama, Soupz Stall falls back to rule-based routing — everything still works.

### CLI Auth Management

```bash
# Login to tool engines
soupz-stall auth login copilot
soupz-stall auth login gemini

# Check auth status
soupz-stall auth status

# Logout
soupz-stall auth logout copilot
```

Auth state is stored at `~/.soupz-agents/auth/state.json` — each tool engine has independent auth.

See [Installation Guide →](docs/guides/INSTALL.md) for detailed setup.

---

## 🏗️ Architecture

```
┌────────────────────────────────────────────────────────┐
│                    SOUPZ STALL CLI                     │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │              Master Orchestrator                 │  │
│  │         (routes, delegates, coordinates)         │  │
│  └────────────┬─────────────────────────────────────┘  │
│               │  @DELEGATE[agent]: task                │
│        ┌──────┴───────────────────────────────┐        │
│        │        Parallel Agent Dispatch       │        │
│        └──┬──────────┬───────────────────┬────┘        │
│           ▼          ▼                   ▼             │
│     ┌───────────┐ ┌──────────┐    ┌──────────────┐     │
│     ├─ copilot ─┤ ├─ gemini ─┤   ←┤ Tool Engines │     │
│     └─────┬─────┘ └───┬──────┘    └────┬─────────┘     │
│           │           │                │               │
│    [chef persona system prompts injected per agent]    │
└────────────────────────────────────────────────────────┘
```

Each **tool engine** can run any **chef** (persona). The orchestrator routes tasks to the best engine×chef combination, and can run multiple in parallel.

---

## 🔧 The Kitchen — Tool Engines

| Engine | Command | Best For |
|--------|---------|----------|
| [🐙 GitHub Copilot](docs/agents/copilot.md) | `gh copilot` | Shell, GitHub, DevOps, coding |
| [🔮 Gemini](docs/agents/gemini.md) | `gemini` | Research, long context, multi-modal |
| [🤖 Ollama](docs/agents/ollama.md) | `ollama` | Offline, private, custom local models |

Switch stations with `/station <name>`. Switch model with `/utensil <model>`. Use `/auto` to let the router pick.

---

## 👨‍🍳 The Chefs — Personas

Chefs are **specialized AI personas** injected as system prompts into tool engines. Each chef has a unique expertise, routing keywords, and capability set.

### 🎨 Design & Creative

| Chef | Icon | Specialty | Summon |
|------|------|-----------|--------|
| [Design Agency](docs/agents/designer.md) | 🎨 | Award-winning UI (Awwwards/FWA), GSAP animations, brand identity, SVG | `@designer` |
| [SVG Artist](docs/agents/svgart.md) | 🖼️ | Production-ready SVG code — logos, icons, illustrations, animations | `@svgart` |
| [Storyteller](docs/agents/storyteller.md) | 📖 | Brand narratives, pitch decks, copywriting, emotional hooks | `@storyteller` |
| [Presenter](docs/agents/presenter.md) | 🎤 | Hackathon pitches, slide structure, judge psychology, demo scripts | `@presenter` |
| [Content Writer](docs/agents/contentwriter.md) | ✍️ | Blogs, social, emails, landing page copy, SEO | `@contentwriter` |

### 💻 Engineering

| Chef | Icon | Specialty | Summon |
|------|------|-----------|--------|
| [Tech Architect](docs/agents/architect.md) | 🏗️ | System design, tech stack decisions, API contracts, DB schemas | `@architect` |
| [DevOps Engineer](docs/agents/devops.md) | ⚙️ | Docker, CI/CD, Terraform, cloud infra, monitoring | `@devops` |
| [QA Engineer](docs/agents/qa.md) | 🧪 | Test plans, edge cases, automation frameworks, quality gates | `@qa` |
| [Security Auditor](docs/agents/security.md) | 🔒 | Threat modeling, OWASP, pen test planning, compliance | `@security` |
| [Test Architect](docs/agents/tester.md) | 🔍 | Test strategy, E2E/unit/integration, CI/CD quality | `@tester` |
| [Data Scientist](docs/agents/datascientist.md) | 📈 | ML pipelines, analytics, visualization, statistical modeling | `@datascientist` |

### 🧠 Strategy & Planning

| Chef | Icon | Specialty | Summon |
|------|------|-----------|--------|
| [Orchestrator](docs/agents/orchestrator.md) | 🎯 | BMAD-style multi-agent coordinator, breaks complex tasks, delegates in parallel | `@orchestrator` |
| [Team Lead](docs/agents/master.md) | 👑 | Master coordinator — parallel streams, batch delegation to all personas | `@master` |
| [Strategist](docs/agents/strategist.md) | 💼 | Business strategy, investor framing, competitive positioning | `@strategist` |
| [Product Manager](docs/agents/pm.md) | 🎯 | PRDs, roadmaps, prioritization, user research, metrics | `@pm` |
| [Project Planner](docs/agents/planner.md) | 📋 | Sprint planning, task breakdown, parallel work streams, estimates | `@planner` |
| [PS Evaluator](docs/agents/evaluator.md) | ⚖️ | Hackathon problem statement analysis, feasibility scoring | `@evaluator` |
| [Innovation Strategist](docs/agents/innovator.md) | 🚀 | Disruption, blue ocean strategy, business model innovation | `@innovator` |

### 📚 Research & Analysis

| Chef | Icon | Specialty | Summon |
|------|------|-----------|--------|
| [Researcher](docs/agents/researcher.md) | 🔬 | Finds APIs, SDKs, design inspiration, competitive analysis | `@researcher` |
| [Business Analyst](docs/agents/analyst.md) | 📊 | Requirements, user stories, market sizing, competitive landscape | `@analyst` |
| [Brainstorming Coach](docs/agents/brainstorm.md) | 💡 | SCAMPER, mind mapping, creative problem solving, ideation | `@brainstorm` |
| [Problem Solver](docs/agents/problemsolver.md) | 🧩 | Root cause analysis, 5 Whys, first principles, debugging mindset | `@problemsolver` |
| [Teacher](docs/agents/teacher.md) | 📚 | Explains anything from basics to advanced, tutorials, walkthroughs | `@teacher` |
| [Scrum Master](docs/agents/scrum.md) | 🏃 | Sprint planning, standups, retros, velocity, blockers | `@scrum` |
| [Tech Writer](docs/agents/techwriter.md) | 📝 | Docs, READMEs, API guides, changelogs, tutorials | `@techwriter` |

---

## 🔗 Multi-Agent Orchestration

### How it works

Soupz Stall uses a **delegation protocol**: when an agent outputs `@DELEGATE[agentId]: task`, the system automatically spawns that sub-agent — and when multiple delegations appear, they run **in parallel** across different tool engines.

```
@orchestrator I'm building a fintech app for a hackathon.
Design the UI, architect the backend, and plan the sprint.
```

The orchestrator responds with:
```
@DELEGATE[designer]: Create fintech dashboard with dark theme, glassmorphism
@DELEGATE[architect]: Design REST API for transaction tracking
@DELEGATE[planner]: Sprint plan for 2-person team, 24 hours
```

All three fire **simultaneously** — design via Gemini, architecture via Copilot, planning via the strategist chef.

### Explicit Commands

```bash
# Chain agents sequentially (output feeds into next)
/chain designer→svgart "Create branding for HealthTrack app"
/chain researcher→designer→presenter "Research fintech UX trends, design homepage, pitch deck"

# Delegate to specific agent
/delegate designer "Create a glassmorphism card component with GSAP hover"

# Parallel dispatch (manual — runs all at once)
/parallel designer architect planner "Build a real-time collaboration tool"
```

### Dynamic Persona Creation

If you reference an agent that doesn't exist, Soupz Stall **creates it on the fly**:

```
@wizard Design a magical onboarding experience
```
> Soupz Stall creates a `wizard` persona, runs it, and optionally saves it to `~/.soupz-agents/agents/wizard.md`.

---

## 💬 Commands Reference

| Command | Description |
|---------|-------------|
| `/help` | Show all commands |
| `/chefs` | List all 38 chefs (personas) with grades |
| `/agents` | List the kitchen (tool engines) |
| `/chain a→b→c "prompt"` | Sequential agent pipeline |
| `/parallel a b c "prompt"` | Parallel agent dispatch |
| `/delegate agent "prompt"` | Delegate to specific chef |
| `/model` | Switch AI model |
| `/tool` | Lock to specific engine |
| `/auto` | Full auto mode (best engine×chef) |
| `/skills` | List all available skills |
| `/costs` | Token usage and cost breakdown |
| `/tokens` | Session token stats |
| `/compress` | Token compression settings |
| `/dashboard` | Open Kitchen Floor visualization |
| `/user` | User account management (signup/login/logout/status) |
| `/mcp` | MCP server management (list/register/connect/disconnect/tools/call/remove) |
| `/pantry` | View distributed memory banks |
| `/stock` | Manage memory banks |
| `/todo` | Task list (auto-extracted from prompts) |
| `/do N` | Execute a todo item |
| `/yolo` | Toggle YOLO mode (no confirmations) |
| `/browse` | Screenshot localhost |
| `/shards` | Memory shard status |
| `/sessions` | List saved sessions |
| `/load NAME` | Load saved session |
| `/quit` | Close the stall |

---

## 🧠 AI-Powered Routing

Soupz Stall uses a **3-layer Copilot-first routing** system for intelligent decisions:

1. **Copilot gpt-5-mini (primary)** — ~9/10 accuracy, ~5-10s. Uses GitHub Copilot for smarter persona and tool engine picks.
2. **Ollama qwen2.5:1.5b (fallback)** — ~7/10 accuracy, ~1-2s. Local model when Copilot is unavailable.
3. **Rule-based (last resort)** — Instant keyword matching if both AI methods fail.

```bash
# Control routing mode (default: copilot)
export SOUPZ_ROUTER=copilot  # Copilot-first (smarter, 5-10s)
export SOUPZ_ROUTER=ollama   # Ollama-only (faster, 1-2s)
export SOUPZ_ROUTER=auto     # Try Copilot, then Ollama

# Point to a remote Ollama instance (e.g. friend's machine with more RAM)
export OLLAMA_HOST=http://remote-ip:11434
```

---

## 🗜️ Token Compression

Save tokens with a **Copilot-first compression pipeline** and rule-based preprocessing:

| Level | Strategy | Savings |
|-------|----------|---------|
| `light` | Remove filler words, trim whitespace | ~15% |
| `medium` | Abbreviate patterns, collapse structures | ~30% |
| `aggressive` | Smart rewrite via Copilot gpt-5-mini (fallback: Ollama qwen2.5:0.5b) | ~40% |

**3-layer fallback:** Copilot gpt-5-mini → Ollama qwen2.5:0.5b → rule-based compression.

**Metrics tracked:** compression ratio, latency, total tokens saved.

```bash
/compress on              # Enable compression
/compress aggressive      # Set compression level
/compress stats           # View savings so far
/compress test <text>     # Preview compressed output
/compress off             # Disable compression
```

---

## 📊 Stall Monitor (Live Dashboard)

Run `/dashboard` to open the animated **Kitchen Floor** visualization in your browser:

- **Chef avatars** — animated characters appear through a door-entry animation as they start tasks
- **Thought bubbles** — hover over a chef to see what they're currently thinking about
- **Task queue** — live view of pending, active, and completed work
- **Token usage card** — total tokens consumed and estimated cost for the session
- **Multi-stall tabs** — switch between multiple terminal sessions running simultaneously

Each terminal session writes state to `~/.soupz-agents/dashboard/stall-{sessionId}.json`.

---

## 🔐 User Authentication (Supabase)

Optional user auth via Supabase with local fallback for multi-user support:

```bash
/user signup <email> <password>   # Create account
/user login <email> <password>    # Login
/user logout                       # Logout
/user status                       # Check current auth state
```

Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` to enable Supabase Auth. Without these, Soupz Stall runs in **local-only mode** — everything works, just no cloud sync.

---

## 🔌 MCP (Model Context Protocol) Support

Built-in MCP client for integrating external tool servers via JSON-RPC over stdio:

```bash
/mcp list                          # List registered MCP servers
/mcp register <name> <command>     # Register a new MCP server
/mcp connect <name>                # Connect to a registered server
/mcp disconnect <name>             # Disconnect from a server
/mcp tools [server]                # List available tools (optionally per server)
/mcp call <tool> [args]            # Invoke an MCP tool
/mcp remove <name>                 # Remove a registered server
```

- **Tool discovery** — auto-detect available tools from connected servers
- **Tool calling** — invoke MCP tools directly from chat or agent pipelines
- **Config** — server definitions stored at `~/.soupz-agents/mcp/servers.json`

### Integrating MCPs (Examples)

```bash
# Register a filesystem MCP server
/mcp register filesystem npx -y @modelcontextprotocol/server-filesystem /path/to/project

# Register Stitch MCP for UI components
/mcp register stitch npx -y @anthropic/stitch-mcp

# Register a GitHub MCP server
/mcp register github npx -y @modelcontextprotocol/server-github

# Connect and use
/mcp connect filesystem
/mcp tools filesystem        # See available tools
/mcp call read_file {"path": "src/index.js"}
```

Any MCP-compatible server works — register it with its launch command and Soupz handles JSON-RPC communication over stdio.

---

## 🏦 Distributed Memory Pool (Pantry Banks)

Extend context beyond single conversations with **Pantry Banks** — auto-active memory that stores after each task and recalls before each task. No `/memory` command needed.

```bash
/pantry                   # View all active memory banks
/stock store "key info"   # Manually store a memory with auto-tags
/stock recall "query"     # Manually recall relevant memories by search
```

- **Auto-active** — memories are stored after each completed task and recalled before each new task automatically
- **Tag-based search** with relevance scoring for fast recall
- **Auto-eviction** of oldest banks when limit reached (FIFO)
- Configurable max banks — default 10, supports up to 100
- Memories persist across sessions at `~/.soupz-agents/memory/`

---

## 📈 AI-Powered Grading

Every chef earns a **grade (0–100)** based on task performance, using the same 3-layer fallback:

| Component | Weight | Evaluates |
|-----------|--------|-----------|
| Rule-based scoring | 40% | Output length, code detection, keyword overlap, response structure |
| AI scoring (Copilot gpt-5-mini → Ollama qwen2.5:1.5b) | 60% | Rates 1-5 on relevance, creativity, completeness |

**3-layer fallback:** Copilot gpt-5-mini → Ollama qwen2.5:1.5b → pure rule-based scoring.

- Grades affect future routing — higher-graded chefs get preferred for matching tasks
- View grades with `/chefs` — each chef shows their current score
- Grades update after every completed task

---

## 🔀 Session Isolation

Each terminal session gets a **unique UUID-based session ID**:

- State files: `~/.soupz-agents/dashboard/stall-{sessionId}.json`
- Multiple terminals run simultaneously without conflicts
- Dashboard shows tabs for switching between active stalls
- Session IDs are generated on launch and persist until exit

---

## 💰 Cost Tracking

Track token usage and estimated costs across your session:

```bash
/costs    # Detailed cost breakdown by engine and task
/tokens   # Session token statistics (input/output)
```

- Tracks input and output tokens per task
- Estimates ~4 chars per token for cost calculation
- Copilot and Ollama are **free/subscription** — use them freely. Gemini charges per token.

Use `/utensil` to switch models at any time. Copilot's model list shows cost multipliers — pick what fits the task.

---

## 🎮 Hackathon Workflow

```
# 1. Evaluate the problem statement
@evaluator Analyze PS: "Build a tool to help remote teams collaborate"

# 2. Orchestrate full project setup (runs all agents in parallel)
@orchestrator Hackathon mode — build CollabSync. Remote team collaboration.
              24h, 2 devs. Need: brand, tech stack, sprint plan.

# 3. Design (award-quality)
@designer Create landing page — Awwwards quality, GSAP scroll animations, dark theme

# 4. Generate brand assets
@svgart Create logo for CollabSync — abstract connected nodes, blue/purple gradient

# 5. Chain design to code
/chain designer→architect→devops "CollabSync: real-time collaboration with presence"

# 6. Build the pitch
@presenter Create 3-minute pitch deck — judges, demo moments, why we win
```

---

## 📁 Project Structure

```
soupz-stall/
├── README.md                    ← You are here
├── bin/
│   └── soupz.js                 ← CLI entry point
├── src/
│   ├── session.js               ← Interactive session, all commands
│   ├── config.js                ← Agent loader, path config
│   ├── skills.js                ← Global skills manifest
│   ├── auto-import.js           ← First-run setup, skills registration
│   ├── agents/
│   │   ├── registry.js          ← Agent registry
│   │   ├── spawner.js           ← Process spawner (parallel-capable)
│   │   └── parsers.js           ← Output parsers per tool
│   ├── auth/                    ← User auth (Supabase + local fallback)
│   ├── core/                    ← Compression, grading, routing engine
│   ├── dashboard/               ← Stall Monitor (live HTML dashboard)
│   ├── mcp/                     ← MCP client (JSON-RPC over stdio)
│   ├── memory/                  ← Distributed memory pool (Pantry Banks)
│   └── orchestrator/
│       ├── router.js            ← Main orchestrator (chain, fanOut)
│       └── semantic-router.js   ← AI-powered semantic routing
├── defaults/agents/             ← Built-in agent definitions (.md)
├── docs/
│   ├── agents/                  ← Per-agent documentation
│   ├── guides/                  ← Setup, usage guides
│   ├── integrations/            ← BMAD, Copilot CLI integration
│   └── development/             ← Architecture, migration notes
├── bmad-export/                 ← BMAD-compatible agent exports
├── scripts/                     ← Utility scripts
└── tests/                       ← Test files
```

---

## 🛠️ GitHub Copilot CLI Skills

Soupz agents are also available as **Copilot CLI skills** (toggle in `/skills` panel):

| Skill | File | Capability |
|-------|------|------------|
| [soupz-designer](~/.agents/skills/soupz-designer/SKILL.md) | `~/.agents/skills/soupz-designer/` | Awwwards-quality UI, GSAP, brand |
| [soupz-svgart](~/.agents/skills/soupz-svgart/SKILL.md) | `~/.agents/skills/soupz-svgart/` | SVG logo/icon/illustration generator |
| [soupz-orchestrator](~/.agents/skills/soupz-orchestrator/SKILL.md) | `~/.agents/skills/soupz-orchestrator/` | BMAD-style multi-agent coordinator |
| [soupz-architect](~/.agents/skills/soupz-architect/SKILL.md) | `~/.agents/skills/soupz-architect/` | Hackathon-ready tech stack design |
| [soupz-researcher](~/.agents/skills/soupz-researcher/SKILL.md) | `~/.agents/skills/soupz-researcher/` | Competitive analysis, design inspiration |

---

## 🔑 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SOUPZ_ROUTER` | Routing mode: `copilot` (smarter), `ollama` (faster), `auto` | `copilot` |
| `OLLAMA_ROUTER_MODEL` | Ollama model for routing/grading | `qwen2.5:1.5b` |
| `OLLAMA_HOST` | Ollama server URL | `http://localhost:11434` |
| `SUPABASE_URL` | Supabase project URL for user auth | — (local-only mode) |
| `SUPABASE_ANON_KEY` | Supabase anon key for user auth | — (local-only mode) |

---

## 🌊 Integrations

- [BMAD Integration →](docs/integrations/BMAD_IMPORT_GUIDE.md)
- [Ollama (Local LLMs) →](docs/guides/OLLAMA_SETUP.md)
- [Token Optimization Research →](docs/research/token-optimization-evidence.md) — peer-reviewed citations backing all efficiency claims

---

## 🤝 Contributing

This project is open source and hackathon-tested. To add a new chef:

1. Create `defaults/agents/yourchef.md` with YAML frontmatter + system prompt
2. Copy to `~/.soupz-agents/agents/yourchef.md`
3. Summon with `@yourchef`

See [Agent Development Guide →](docs/development/MASTER_PERSONA_GUIDE.md)

---

<div align="center">
Built with 🫕 by <a href="https://github.com/Soham-Prajapati">Soham Prajapati</a>
</div>
