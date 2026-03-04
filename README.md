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

Soupz Stall is a **multi-agent CLI** that orchestrates multiple AI tools (GitHub Copilot, Gemini) through a cast of specialized **chefs** (personas). Think of it like Claude Code's sub-agent system but running on your existing AI subscriptions — no extra API keys needed.

**Key differentiator:** Unlike other CLIs that run tasks one at a time, Soupz Stall can **spawn multiple agents in parallel** — delegating design work to one agent while code architecture happens simultaneously in another.

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
│       ┌───────┴────────────────────┐                   │
│       │   Parallel Agent Dispatch  │                   │
│       └──┬──────────┬─────────┬────┘                   │
│          ▼          ▼         ▼                        │
│     ┌─────────┐ ┌────────┐ ┌────────┐                  │
│     ├── copilot ──┤ ├── gemini ──┤  ← Tool Engines  │
│     └─────┬───┘ └───┬────┘ └───┬────┘                  │
│           │         │          │                       │
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
| `/chefs` | List all 25 chefs (personas) |
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
| `/todo` | Task list (auto-extracted from prompts) |
| `/do N` | Execute a todo item |
| `/yolo` | Toggle YOLO mode (no confirmations) |
| `/browse` | Screenshot localhost |
| `/shards` | Memory shard status |
| `/sessions` | List saved sessions |
| `/load NAME` | Load saved session |
| `/quit` | Close the stall |

---

## 💰 Token Budget

Copilot and Ollama are **free/subscription** — use them as much as you want. Gemini charges per token.

Use `/utensil` to switch models at any time. Copilot's model list shows cost multipliers — pick what fits the task. There are no hardcoded recommendations here; you know your project best.

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
│   └── orchestrator/
│       ├── router.js            ← Main orchestrator (chain, fanOut)
│       └── semantic-router.js   ← Semantic routing by prompt analysis
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

## 🌊 Integrations

- [BMAD Integration →](docs/integrations/BMAD_IMPORT_GUIDE.md)
- [Ollama (Local LLMs) →](docs/guides/OLLAMA_SETUP.md)

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
