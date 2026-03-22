---

# Soupz Stall — Master Project Overview (Updated: March 22, 2026)

## 1. What Is This Project?
Soupz Stall is a Jarvis-like multi-agent orchestrator CLI tailored for extreme speed, observability, and cost-efficiency. It solves the 'monolithic LLM' problem by utilizing a coordinated swarm of specialized agents (chefs) operating within a 'kitchen' metaphor, allowing local-first terminal execution with a remote real-time web dashboard. What makes it different is its local-first PTY bridging, automatic plan decomposition via DAGs, and 3-layer semantic routing that significantly reduces API costs by using local models (Ollama) when possible.

## 2. The Metaphor System (Glossary)

| Metaphor Term | Real Technical Meaning | Where It Appears in Code |
|---|---|---|
| Stall / Kitchen | The core running CLI orchestrator session | `src/core/stall-monitor.js`, Dashboard UI |
| Chef | An AI Agent / Persona with a specific system prompt | `defaults/agents/*.md`, `src/agents/registry.js` |
| Pantry | The working memory (short-term) context storage | `src/core/context-pantry.js` |
| Stove | A running terminal / child process spawned by node-pty | `packages/mobile-ide/App.js`, `packages/remote-server/src/index.js` |
| Utensil | The specific LLM model used (e.g., gpt-4o-mini, gemini-2.5-pro) | `src/session.js` (Model switch logic) |
| Order / Ticket | A user prompt or decomposed sub-task | Dashboard UI (orders), Session commands |
| Recipe | Pre-built automated workflows or chained sequences | `src/session.js` (`/recipe` command) |
| Fleet | Hidden background CLI workers running in parallel | `src/session.js` (`spawnFleet` method) |
| Spill Mode | Unrestricted YOLO mode without confirmation bounds | `src/session.js` (`/spill` or `/yolo`) |

## 3. Full Tech Stack

| Category | Dependency | Version | Why It's Used Here |
|---|---|---|---|
| Frontend | `react` | 18.3.1 | Mobile IDE scaffold |
| Frontend | `react-dom` | ^18.3.1 | Dashboard UI dependencies |
| Frontend | `framer-motion` | ^11.0.0 | Dashboard UI dependencies |
| Frontend | `lucide-react` | ^0.400.0 | Dashboard UI dependencies |
| Frontend | `recharts` | ^2.12.0 | Dashboard UI dependencies |
| Frontend | `@types/react` | ^18.3.1 | Dashboard UI dependencies |
| Frontend | `@types/react-dom` | ^18.3.1 | Dashboard UI dependencies |
| Frontend | `@vitejs/plugin-react` | ^4.2.1 | Dashboard UI dependencies |
| Frontend | `tailwindcss` | ^3.4.1 | Dashboard UI dependencies |
| Frontend | `vite` | ^5.1.4 | Dashboard UI dependencies |
| Frontend | `@react-native-async-storage/async-storage` | 1.23.1 | Mobile IDE scaffold |
| Frontend | `@react-navigation/bottom-tabs` | ^7.0.0 | Mobile IDE scaffold |
| Frontend | `@react-navigation/native` | ^7.0.0 | Mobile IDE scaffold |
| Frontend | `expo` | ~52.0.0 | Mobile IDE scaffold |
| Frontend | `expo-asset` | ~11.0.5 | Mobile IDE scaffold |
| Frontend | `expo-status-bar` | ~2.0.1 | Mobile IDE scaffold |
| Frontend | `react-native` | 0.76.9 | Mobile IDE scaffold |
| Frontend | `react-native-safe-area-context` | 4.12.0 | Mobile IDE scaffold |
| Frontend | `react-native-screens` | ~4.4.0 | Mobile IDE scaffold |
| Backend | `express` | ^4.21.0 | WebSocket bridge server |
| Backend | `ws` | ^8.18.0 | WebSocket bridge server |
| Terminal | `chalk` | ^5.3.0 | Core CLI dependencies |
| Terminal | `conf` | ^13.0.1 | Core CLI dependencies |
| Terminal | `figlet` | ^1.8.0 | Core CLI dependencies |
| Terminal | `gradient-string` | ^3.0.0 | Core CLI dependencies |
| Terminal | `meow` | ^13.0.0 | Core CLI dependencies |
| Terminal | `node-pty` | ^1.2.0-beta.11 | WebSocket bridge server |
| Database | `@supabase/supabase-js` | ^2.98.0 | WebSocket bridge server |
| AI | `puppeteer-core` | ^24.37.5 | Used for autonomous browser tasks |
| DevTools | `tree-kill` | ^1.2.2 | General tooling |
| DevTools | `yaml` | ^2.6.1 | General tooling |
| DevTools | `clsx` | ^2.1.0 | General tooling |
| DevTools | `tailwind-merge` | ^2.2.0 | General tooling |
| DevTools | `autoprefixer` | ^10.4.17 | General tooling |
| DevTools | `postcss` | ^8.4.35 | General tooling |


## 4. Monorepo Structure

- `/` : Monorepo root.
- `bin/soupz.js` : The global executable entry point for the CLI.
- `src/` : The core CLI runtime engine.
  - `src/orchestrator/` : Handles routing and multi-agent plan decomposition (`router.js`, `semantic-router.js`).
  - `src/agents/` : Manages the child processes (`spawner.js`) and parses output (`parsers.js`).
  - `src/core/` : Contains tracking logic like `context-pantry.js`, `stall-monitor.js`, and `token-compressor.js`.
  - `src/memory/` : The SQLite-style persistent memory pool (`pool.js`).
  - `src/mcp/` : Model Context Protocol client implementation (`client.js`).
  - `src/session.js` : The primary REPL loop and user interaction handler.
- `packages/` : The independent workspaces.
  - `packages/dashboard/` : The React 18 / Vite mission control web UI.
  - `packages/remote-server/` : The Express / node-pty server that bridges the local terminal to the dashboard.
  - `packages/mobile-ide/` : (Scaffold) React Native Expo app for mobile monitoring.
  - `packages/browser-extension/` : (Scaffold) Chrome extension for DOM injection.
- `defaults/agents/` : The Markdown definitions for the 40+ specialized personas.
- `docs/` : Documentation and knowledge base.

## 5. The Complete Chef Persona System

### 5a. Overview Table

| # | Name | Invoke Handle | Icon | Underlying Agent | Core Specialty |
|---|---|---|---|---|---|
| 1 | Agent Builder (Bond) | `@agent-builder` | 🔧 | Copilot / Gemini | Agent architecture specialist and BMAD compliance expert who creates robust, maintainable agents |
| 2 | Business Analyst | `@analyst` | 📊 | Copilot / Gemini | Senior business analyst — requirements, user stories, competitive analysis, market sizing, KPIs |
| 3 | Tech Architect | `@architect` | 🏗️ | Copilot / Gemini | CTO-level technical architect who plans for 50-person teams with production-grade systems |
| 4 | Brainstorming Coach | `@brainstorm` | 💡 | Copilot / Gemini | SCAMPER, Six Thinking Hats, Mind Mapping, Crazy 8s, Reverse Brainstorming — master ideation facilitator |
| 5 | Brand Chef | `@brand-chef` | 🧑‍🍳 | Copilot / Gemini | Brand identity specialist — naming, messaging, positioning, voice & tone, visual direction |
| 6 | Content Writer | `@contentwriter` | ✍️ | Copilot / Gemini | Marketing copy, blog posts, social media, SEO optimization |
| 7 | GitHub Copilot | `@copilot` | 🐙 | Copilot / Gemini | GitHub Copilot CLI — shell commands, DevOps, GitHub workflows |
| 8 | Data Scientist | `@datascientist` | 📈 | Copilot / Gemini | CRISP-DM, ML pipelines, statistical analysis, experiment design, data storytelling |
| 9 | Design Thinking Coach (Maya) | `@design-thinking-coach` | 💡 | Copilot / Gemini | Human-centered design expert and empathy architect guiding design thinking processes with 15+ years experience |
| 10 | Design Agency | `@designer` | 🎨 | Copilot / Gemini | World-class design agency — 8-phase brand engagement, Awwwards-quality HTML prototypes, 3-second clarity test. |
| 11 | Developer (Amelia) | `@dev` | 💻 | Copilot / Gemini | Senior software engineer who executes approved stories with strict TDD adherence and comprehensive test coverage |
| 12 | DevOps Engineer | `@devops` | ⚙️ | Copilot / Gemini | DevOps — Docker, CI/CD, cloud infra, Terraform, monitoring |
| 13 | Domain Scout | `@domain-scout` | 🗺️ | Copilot / Gemini | Maps competitive domains — classifies product space, finds direct/adjacent competitors, identifies whitespace |
| 14 | PS Evaluator | `@evaluator` | ⚖️ | Copilot / Gemini | Hackathon judging, feasibility scoring, competitive analysis |
| 15 | "Forager (Ingredient Scout)" | `@forager` | 🧺 | Copilot / Gemini | The Stall |
| 16 | Gemini | `@gemini` | 🔮 | Copilot / Gemini | Google Gemini CLI — research, code generation, multi-modal analysis |
| 17 | Innovation Strategist | `@innovator` | 🚀 | Copilot / Gemini | Blue Ocean Strategy, Jobs-to-be-Done, Business Model Canvas, disruption analysis — strategic innovation architect |
| 18 | Team Lead | `@master` | 👑 | Copilot / Gemini | Master orchestrator — decomposes complex projects into parallel persona work streams, coordinates and integrates outputs |
| 19 | Module Builder (Morgan) | `@module-builder` | 📦 | Copilot / Gemini | Module architecture specialist who creates cohesive, scalable BMAD modules with agents, workflows, and infrastructure |
| 20 | Ollama | `@ollama` | 🤖 | Copilot / Gemini | Ollama — local LLMs (Llama, Mistral, Phi) |
| 21 | Orchestrator | `@orchestrator` | 🎯 | Copilot / Gemini | Master orchestrator — breaks down complex tasks, delegates to specialist agents, coordinates multi-agent workflows like BMAD |
| 22 | Project Planner | `@planner` | 📋 | Copilot / Gemini | Sprint planning, task breakdown, dependency mapping, Gantt charts |
| 23 | Product Manager | `@pm` | 🎯 | Copilot / Gemini | PRDs, roadmaps, RICE/MoSCoW prioritization, user research, north star metrics — outcome-driven PM |
| 24 | Presentation Coach | `@presenter` | 🎤 | Copilot / Gemini | 10x hackathon champion and pitch coach — demo scripts, investor decks, judge prep, storytelling |
| 25 | Problem Solver | `@problemsolver` | 🧩 | Copilot / Gemini | TRIZ, 5 Whys, First Principles, Theory of Constraints, Systems Thinking — systematic problem-solving expert |
| 26 | QA Engineer | `@qa` | 🧪 | Copilot / Gemini | QA — test plans, edge cases, bug reports, quality gates |
| 27 | Quick Flow Solo Dev (Barry) | `@quick-flow` | ⚡ | Copilot / Gemini | Elite full-stack developer for rapid spec creation through lean implementation with minimum ceremony |
| 28 | Researcher | `@researcher` | 🔬 | Copilot / Gemini | Deep researcher — competitive intelligence, API/SDK evaluation, market sizing, domain analysis |
| 29 | Review Miner | `@review-miner` | ⛏️ | Copilot / Gemini | Mines user reviews from Reddit, X, App Store, Play Store — extracts real pain points & feature gaps |
| 30 | Scrum Master | `@scrum` | 🏃 | Copilot / Gemini | Certified Scrum Master — sprint planning, story preparation, retrospectives, velocity tracking, blocker removal |
| 31 | Security Auditor | `@security` | 🔒 | Copilot / Gemini | Security — threat modeling, OWASP, pen test planning, compliance |
| 32 | Storyteller | `@storyteller` | 📖 | Copilot / Gemini | Hero |
| 33 | Strategist | `@strategist` | 💼 | Copilot / Gemini | Billionaire-level strategist — market intelligence, brand positioning, investor pitch, GTM, business model |
| 34 | SVG Artist | `@svgart` | 🖼️ | Copilot / Gemini | SVG & CSS art generator — creates ready-to-import SVG files, icons, logos, illustrations, and UI assets |
| 35 | Test Architect (Murat) | `@tea` | 🧪 | Copilot / Gemini | Master test architect specializing in risk-based testing, ATDD, test strategy, and CI/CD quality governance |
| 36 | Teaching Assistant | `@teacher` | 📚 | Copilot / Gemini | Patient expert educator — Bloom |
| 37 | Tech Writer | `@techwriter` | 📝 | Copilot / Gemini | READMEs, API docs, tutorials, changelogs, migration guides |
| 38 | Test Architect | `@tester` | 🔍 | Copilot / Gemini | Test strategy, automation frameworks, quality gates, CI/CD |
| 39 | UI Builder | `@ui-builder` | 🏗️ | Copilot / Gemini | Builds the actual HTML prototypes — GSAP animations, design systems, SVG assets, Awwwards-quality output |
| 40 | UX Designer (Sally) | `@ux-designer` | 🎯 | Copilot / Gemini | Senior UX designer specializing in user research, interaction design, and human-centered experience strategy |
| 41 | Workflow Builder (Wendy) | `@workflow-builder` | 🔄 | Copilot / Gemini | Workflow architecture specialist and process design expert who creates efficient, scalable BMAD workflows |


### 5b. Per-Persona Deep Dive (ALL personas — do not skip any)

#### 1. Agent Builder (Bond) (@agent-builder)
- **Underlying Agent**: Copilot / Gemini
- **Specialty**: Agent architecture specialist and BMAD compliance expert who creates robust, maintainable agents
- **System Prompt Logic**: Direct, declarative action. Tone is Direct and opinionated. Standard conversational filler. Prioritizes exact completion of the specified role over generic helpfulness.
- **Unique Behaviors / Flags**: Highly specialized role constraints. Routes based on internal regex matching if specific keywords are hit.
- **Example Use Case**: "Hey @agent-builder, agent architecture specialist and bmad compliance expert who creates robust, maintainable agents for the new auth feature."
- **How It Differs From Similar Personas**: Focuses entirely on Agent Builder (Bond) workflows rather than general responsibilities.

#### 2. Business Analyst (@analyst)
- **Underlying Agent**: Copilot / Gemini
- **Specialty**: Senior business analyst — requirements, user stories, competitive analysis, market sizing, KPIs
- **System Prompt Logic**: Direct, declarative action. Tone is Direct and opinionated. Standard conversational filler. Prioritizes exact completion of the specified role over generic helpfulness.
- **Unique Behaviors / Flags**: Highly specialized role constraints. Routes based on internal regex matching if specific keywords are hit.
- **Example Use Case**: "Hey @analyst, senior business analyst — requirements, user stories, competitive analysis, market sizing, kpis for the new auth feature."
- **How It Differs From Similar Personas**: Focuses entirely on Business Analyst workflows rather than general responsibilities.

#### 3. Tech Architect (@architect)
- **Underlying Agent**: Copilot / Gemini
- **Specialty**: CTO-level technical architect who plans for 50-person teams with production-grade systems
- **System Prompt Logic**: Direct, declarative action. Tone is Direct and opinionated. Standard conversational filler. Prioritizes exact completion of the specified role over generic helpfulness.
- **Unique Behaviors / Flags**: Highly specialized role constraints. Routes based on internal regex matching if specific keywords are hit.
- **Example Use Case**: "Hey @architect, cto-level technical architect who plans for 50-person teams with production-grade systems for the new auth feature."
- **How It Differs From Similar Personas**: Focuses entirely on Tech Architect workflows rather than general responsibilities.

#### 4. Brainstorming Coach (@brainstorm)
- **Underlying Agent**: Copilot / Gemini
- **Specialty**: SCAMPER, Six Thinking Hats, Mind Mapping, Crazy 8s, Reverse Brainstorming — master ideation facilitator
- **System Prompt Logic**: Direct, declarative action. Tone is Direct and opinionated. Standard conversational filler. Prioritizes exact completion of the specified role over generic helpfulness.
- **Unique Behaviors / Flags**: Highly specialized role constraints. Routes based on internal regex matching if specific keywords are hit.
- **Example Use Case**: "Hey @brainstorm, scamper, six thinking hats, mind mapping, crazy 8s, reverse brainstorming — master ideation facilitator for the new auth feature."
- **How It Differs From Similar Personas**: Focuses entirely on Brainstorming Coach workflows rather than general responsibilities.

#### 5. Brand Chef (@brand-chef)
- **Underlying Agent**: Copilot / Gemini
- **Specialty**: Brand identity specialist — naming, messaging, positioning, voice & tone, visual direction
- **System Prompt Logic**: Direct, declarative action. Tone is Direct and opinionated. Standard conversational filler. Prioritizes exact completion of the specified role over generic helpfulness.
- **Unique Behaviors / Flags**: Highly specialized role constraints. Routes based on internal regex matching if specific keywords are hit.
- **Example Use Case**: "Hey @brand-chef, brand identity specialist — naming, messaging, positioning, voice & tone, visual direction for the new auth feature."
- **How It Differs From Similar Personas**: Focuses entirely on Brand Chef workflows rather than general responsibilities.

#### 6. Content Writer (@contentwriter)
- **Underlying Agent**: Copilot / Gemini
- **Specialty**: Marketing copy, blog posts, social media, SEO optimization
- **System Prompt Logic**: Direct, declarative action. Tone is Direct and opinionated. Standard conversational filler. Prioritizes exact completion of the specified role over generic helpfulness.
- **Unique Behaviors / Flags**: Highly specialized role constraints. Routes based on internal regex matching if specific keywords are hit.
- **Example Use Case**: "Hey @contentwriter, marketing copy, blog posts, social media, seo optimization for the new auth feature."
- **How It Differs From Similar Personas**: Focuses entirely on Content Writer workflows rather than general responsibilities.

#### 7. GitHub Copilot (@copilot)
- **Underlying Agent**: Copilot / Gemini
- **Specialty**: GitHub Copilot CLI — shell commands, DevOps, GitHub workflows
- **System Prompt Logic**: Direct, declarative action. Tone is Direct and opinionated. Standard conversational filler. Prioritizes exact completion of the specified role over generic helpfulness.
- **Unique Behaviors / Flags**: Highly specialized role constraints. Routes based on internal regex matching if specific keywords are hit.
- **Example Use Case**: "Hey @copilot, github copilot cli — shell commands, devops, github workflows for the new auth feature."
- **How It Differs From Similar Personas**: Focuses entirely on GitHub Copilot workflows rather than general responsibilities.

#### 8. Data Scientist (@datascientist)
- **Underlying Agent**: Copilot / Gemini
- **Specialty**: CRISP-DM, ML pipelines, statistical analysis, experiment design, data storytelling
- **System Prompt Logic**: Direct, declarative action. Tone is Direct and opinionated. Standard conversational filler. Prioritizes exact completion of the specified role over generic helpfulness.
- **Unique Behaviors / Flags**: Highly specialized role constraints. Routes based on internal regex matching if specific keywords are hit.
- **Example Use Case**: "Hey @datascientist, crisp-dm, ml pipelines, statistical analysis, experiment design, data storytelling for the new auth feature."
- **How It Differs From Similar Personas**: Focuses entirely on Data Scientist workflows rather than general responsibilities.

#### 9. Design Thinking Coach (Maya) (@design-thinking-coach)
- **Underlying Agent**: Copilot / Gemini
- **Specialty**: Human-centered design expert and empathy architect guiding design thinking processes with 15+ years experience
- **System Prompt Logic**: Direct, declarative action. Tone is Direct and opinionated. Standard conversational filler. Prioritizes exact completion of the specified role over generic helpfulness.
- **Unique Behaviors / Flags**: Highly specialized role constraints. Routes based on internal regex matching if specific keywords are hit.
- **Example Use Case**: "Hey @design-thinking-coach, human-centered design expert and empathy architect guiding design thinking processes with 15+ years experience for the new auth feature."
- **How It Differs From Similar Personas**: Focuses entirely on Design Thinking Coach (Maya) workflows rather than general responsibilities.

#### 10. Design Agency (@designer)
- **Underlying Agent**: Copilot / Gemini
- **Specialty**: World-class design agency — 8-phase brand engagement, Awwwards-quality HTML prototypes, 3-second clarity test.
- **System Prompt Logic**: Direct, declarative action. Tone is Direct and opinionated. Standard conversational filler. Prioritizes exact completion of the specified role over generic helpfulness.
- **Unique Behaviors / Flags**: Highly specialized role constraints. Routes based on internal regex matching if specific keywords are hit.
- **Example Use Case**: "Hey @designer, world-class design agency — 8-phase brand engagement, awwwards-quality html prototypes, 3-second clarity test. for the new auth feature."
- **How It Differs From Similar Personas**: Focuses entirely on Design Agency workflows rather than general responsibilities.

#### 11. Developer (Amelia) (@dev)
- **Underlying Agent**: Copilot / Gemini
- **Specialty**: Senior software engineer who executes approved stories with strict TDD adherence and comprehensive test coverage
- **System Prompt Logic**: Direct, declarative action. Tone is Direct and opinionated. Standard conversational filler. Prioritizes exact completion of the specified role over generic helpfulness.
- **Unique Behaviors / Flags**: Highly specialized role constraints. Routes based on internal regex matching if specific keywords are hit.
- **Example Use Case**: "Hey @dev, senior software engineer who executes approved stories with strict tdd adherence and comprehensive test coverage for the new auth feature."
- **How It Differs From Similar Personas**: Focuses entirely on Developer (Amelia) workflows rather than general responsibilities.

#### 12. DevOps Engineer (@devops)
- **Underlying Agent**: Copilot / Gemini
- **Specialty**: DevOps — Docker, CI/CD, cloud infra, Terraform, monitoring
- **System Prompt Logic**: Direct, declarative action. Tone is Direct and opinionated. Standard conversational filler. Prioritizes exact completion of the specified role over generic helpfulness.
- **Unique Behaviors / Flags**: Highly specialized role constraints. Routes based on internal regex matching if specific keywords are hit.
- **Example Use Case**: "Hey @devops, devops — docker, ci/cd, cloud infra, terraform, monitoring for the new auth feature."
- **How It Differs From Similar Personas**: Focuses entirely on DevOps Engineer workflows rather than general responsibilities.

#### 13. Domain Scout (@domain-scout)
- **Underlying Agent**: Copilot / Gemini
- **Specialty**: Maps competitive domains — classifies product space, finds direct/adjacent competitors, identifies whitespace
- **System Prompt Logic**: Direct, declarative action. Tone is Direct and opinionated. Standard conversational filler. Prioritizes exact completion of the specified role over generic helpfulness.
- **Unique Behaviors / Flags**: Highly specialized role constraints. Routes based on internal regex matching if specific keywords are hit.
- **Example Use Case**: "Hey @domain-scout, maps competitive domains — classifies product space, finds direct/adjacent competitors, identifies whitespace for the new auth feature."
- **How It Differs From Similar Personas**: Focuses entirely on Domain Scout workflows rather than general responsibilities.

#### 14. PS Evaluator (@evaluator)
- **Underlying Agent**: Copilot / Gemini
- **Specialty**: Hackathon judging, feasibility scoring, competitive analysis
- **System Prompt Logic**: Direct, declarative action. Tone is Direct and opinionated. Standard conversational filler. Prioritizes exact completion of the specified role over generic helpfulness.
- **Unique Behaviors / Flags**: Highly specialized role constraints. Routes based on internal regex matching if specific keywords are hit.
- **Example Use Case**: "Hey @evaluator, hackathon judging, feasibility scoring, competitive analysis for the new auth feature."
- **How It Differs From Similar Personas**: Focuses entirely on PS Evaluator workflows rather than general responsibilities.

#### 15. "Forager (Ingredient Scout)" (@forager)
- **Underlying Agent**: Copilot / Gemini
- **Specialty**: The Stall
- **System Prompt Logic**: Direct, declarative action. Tone is Direct and opinionated. Standard conversational filler. Prioritizes exact completion of the specified role over generic helpfulness.
- **Unique Behaviors / Flags**: Standard persona wrapper. Routes based on internal regex matching if specific keywords are hit.
- **Example Use Case**: "Hey @forager, the stall for the new auth feature."
- **How It Differs From Similar Personas**: Focuses entirely on "Forager (Ingredient Scout)" workflows rather than general responsibilities.

#### 16. Gemini (@gemini)
- **Underlying Agent**: Copilot / Gemini
- **Specialty**: Google Gemini CLI — research, code generation, multi-modal analysis
- **System Prompt Logic**: Direct, declarative action. Tone is Direct and opinionated. Standard conversational filler. Prioritizes exact completion of the specified role over generic helpfulness.
- **Unique Behaviors / Flags**: Highly specialized role constraints. Routes based on internal regex matching if specific keywords are hit.
- **Example Use Case**: "Hey @gemini, google gemini cli — research, code generation, multi-modal analysis for the new auth feature."
- **How It Differs From Similar Personas**: Focuses entirely on Gemini workflows rather than general responsibilities.

#### 17. Innovation Strategist (@innovator)
- **Underlying Agent**: Copilot / Gemini
- **Specialty**: Blue Ocean Strategy, Jobs-to-be-Done, Business Model Canvas, disruption analysis — strategic innovation architect
- **System Prompt Logic**: Direct, declarative action. Tone is Direct and opinionated. Standard conversational filler. Prioritizes exact completion of the specified role over generic helpfulness.
- **Unique Behaviors / Flags**: Highly specialized role constraints. Routes based on internal regex matching if specific keywords are hit.
- **Example Use Case**: "Hey @innovator, blue ocean strategy, jobs-to-be-done, business model canvas, disruption analysis — strategic innovation architect for the new auth feature."
- **How It Differs From Similar Personas**: Focuses entirely on Innovation Strategist workflows rather than general responsibilities.

#### 18. Team Lead (@master)
- **Underlying Agent**: Copilot / Gemini
- **Specialty**: Master orchestrator — decomposes complex projects into parallel persona work streams, coordinates and integrates outputs
- **System Prompt Logic**: Direct, declarative action. Tone is Direct and opinionated. Standard conversational filler. Prioritizes exact completion of the specified role over generic helpfulness.
- **Unique Behaviors / Flags**: Highly specialized role constraints. Routes based on internal regex matching if specific keywords are hit.
- **Example Use Case**: "Hey @master, master orchestrator — decomposes complex projects into parallel persona work streams, coordinates and integrates outputs for the new auth feature."
- **How It Differs From Similar Personas**: Focuses entirely on Team Lead workflows rather than general responsibilities.

#### 19. Module Builder (Morgan) (@module-builder)
- **Underlying Agent**: Copilot / Gemini
- **Specialty**: Module architecture specialist who creates cohesive, scalable BMAD modules with agents, workflows, and infrastructure
- **System Prompt Logic**: Direct, declarative action. Tone is Direct and opinionated. Standard conversational filler. Prioritizes exact completion of the specified role over generic helpfulness.
- **Unique Behaviors / Flags**: Highly specialized role constraints. Routes based on internal regex matching if specific keywords are hit.
- **Example Use Case**: "Hey @module-builder, module architecture specialist who creates cohesive, scalable bmad modules with agents, workflows, and infrastructure for the new auth feature."
- **How It Differs From Similar Personas**: Focuses entirely on Module Builder (Morgan) workflows rather than general responsibilities.

#### 20. Ollama (@ollama)
- **Underlying Agent**: Copilot / Gemini
- **Specialty**: Ollama — local LLMs (Llama, Mistral, Phi)
- **System Prompt Logic**: Direct, declarative action. Tone is Direct and opinionated. Standard conversational filler. Prioritizes exact completion of the specified role over generic helpfulness.
- **Unique Behaviors / Flags**: Standard persona wrapper. Routes based on internal regex matching if specific keywords are hit.
- **Example Use Case**: "Hey @ollama, ollama — local llms (llama, mistral, phi) for the new auth feature."
- **How It Differs From Similar Personas**: Focuses entirely on Ollama workflows rather than general responsibilities.

#### 21. Orchestrator (@orchestrator)
- **Underlying Agent**: Copilot / Gemini
- **Specialty**: Master orchestrator — breaks down complex tasks, delegates to specialist agents, coordinates multi-agent workflows like BMAD
- **System Prompt Logic**: Direct, declarative action. Tone is Direct and opinionated. Standard conversational filler. Prioritizes exact completion of the specified role over generic helpfulness.
- **Unique Behaviors / Flags**: Highly specialized role constraints. Routes based on internal regex matching if specific keywords are hit.
- **Example Use Case**: "Hey @orchestrator, master orchestrator — breaks down complex tasks, delegates to specialist agents, coordinates multi-agent workflows like bmad for the new auth feature."
- **How It Differs From Similar Personas**: Focuses entirely on Orchestrator workflows rather than general responsibilities.

#### 22. Project Planner (@planner)
- **Underlying Agent**: Copilot / Gemini
- **Specialty**: Sprint planning, task breakdown, dependency mapping, Gantt charts
- **System Prompt Logic**: Direct, declarative action. Tone is Direct and opinionated. Standard conversational filler. Prioritizes exact completion of the specified role over generic helpfulness.
- **Unique Behaviors / Flags**: Highly specialized role constraints. Routes based on internal regex matching if specific keywords are hit.
- **Example Use Case**: "Hey @planner, sprint planning, task breakdown, dependency mapping, gantt charts for the new auth feature."
- **How It Differs From Similar Personas**: Focuses entirely on Project Planner workflows rather than general responsibilities.

#### 23. Product Manager (@pm)
- **Underlying Agent**: Copilot / Gemini
- **Specialty**: PRDs, roadmaps, RICE/MoSCoW prioritization, user research, north star metrics — outcome-driven PM
- **System Prompt Logic**: Direct, declarative action. Tone is Direct and opinionated. Standard conversational filler. Prioritizes exact completion of the specified role over generic helpfulness.
- **Unique Behaviors / Flags**: Highly specialized role constraints. Routes based on internal regex matching if specific keywords are hit.
- **Example Use Case**: "Hey @pm, prds, roadmaps, rice/moscow prioritization, user research, north star metrics — outcome-driven pm for the new auth feature."
- **How It Differs From Similar Personas**: Focuses entirely on Product Manager workflows rather than general responsibilities.

#### 24. Presentation Coach (@presenter)
- **Underlying Agent**: Copilot / Gemini
- **Specialty**: 10x hackathon champion and pitch coach — demo scripts, investor decks, judge prep, storytelling
- **System Prompt Logic**: Direct, declarative action. Tone is Direct and opinionated. Standard conversational filler. Prioritizes exact completion of the specified role over generic helpfulness.
- **Unique Behaviors / Flags**: Highly specialized role constraints. Routes based on internal regex matching if specific keywords are hit.
- **Example Use Case**: "Hey @presenter, 10x hackathon champion and pitch coach — demo scripts, investor decks, judge prep, storytelling for the new auth feature."
- **How It Differs From Similar Personas**: Focuses entirely on Presentation Coach workflows rather than general responsibilities.

#### 25. Problem Solver (@problemsolver)
- **Underlying Agent**: Copilot / Gemini
- **Specialty**: TRIZ, 5 Whys, First Principles, Theory of Constraints, Systems Thinking — systematic problem-solving expert
- **System Prompt Logic**: Direct, declarative action. Tone is Direct and opinionated. Standard conversational filler. Prioritizes exact completion of the specified role over generic helpfulness.
- **Unique Behaviors / Flags**: Highly specialized role constraints. Routes based on internal regex matching if specific keywords are hit.
- **Example Use Case**: "Hey @problemsolver, triz, 5 whys, first principles, theory of constraints, systems thinking — systematic problem-solving expert for the new auth feature."
- **How It Differs From Similar Personas**: Focuses entirely on Problem Solver workflows rather than general responsibilities.

#### 26. QA Engineer (@qa)
- **Underlying Agent**: Copilot / Gemini
- **Specialty**: QA — test plans, edge cases, bug reports, quality gates
- **System Prompt Logic**: Direct, declarative action. Tone is Direct and opinionated. Standard conversational filler. Prioritizes exact completion of the specified role over generic helpfulness.
- **Unique Behaviors / Flags**: Highly specialized role constraints. Routes based on internal regex matching if specific keywords are hit.
- **Example Use Case**: "Hey @qa, qa — test plans, edge cases, bug reports, quality gates for the new auth feature."
- **How It Differs From Similar Personas**: Focuses entirely on QA Engineer workflows rather than general responsibilities.

#### 27. Quick Flow Solo Dev (Barry) (@quick-flow)
- **Underlying Agent**: Copilot / Gemini
- **Specialty**: Elite full-stack developer for rapid spec creation through lean implementation with minimum ceremony
- **System Prompt Logic**: Direct, declarative action. Tone is Direct and opinionated. Standard conversational filler. Prioritizes exact completion of the specified role over generic helpfulness.
- **Unique Behaviors / Flags**: Highly specialized role constraints. Routes based on internal regex matching if specific keywords are hit.
- **Example Use Case**: "Hey @quick-flow, elite full-stack developer for rapid spec creation through lean implementation with minimum ceremony for the new auth feature."
- **How It Differs From Similar Personas**: Focuses entirely on Quick Flow Solo Dev (Barry) workflows rather than general responsibilities.

#### 28. Researcher (@researcher)
- **Underlying Agent**: Copilot / Gemini
- **Specialty**: Deep researcher — competitive intelligence, API/SDK evaluation, market sizing, domain analysis
- **System Prompt Logic**: Direct, declarative action. Tone is Direct and opinionated. Standard conversational filler. Prioritizes exact completion of the specified role over generic helpfulness.
- **Unique Behaviors / Flags**: Highly specialized role constraints. Routes based on internal regex matching if specific keywords are hit.
- **Example Use Case**: "Hey @researcher, deep researcher — competitive intelligence, api/sdk evaluation, market sizing, domain analysis for the new auth feature."
- **How It Differs From Similar Personas**: Focuses entirely on Researcher workflows rather than general responsibilities.

#### 29. Review Miner (@review-miner)
- **Underlying Agent**: Copilot / Gemini
- **Specialty**: Mines user reviews from Reddit, X, App Store, Play Store — extracts real pain points & feature gaps
- **System Prompt Logic**: Direct, declarative action. Tone is Direct and opinionated. Standard conversational filler. Prioritizes exact completion of the specified role over generic helpfulness.
- **Unique Behaviors / Flags**: Highly specialized role constraints. Routes based on internal regex matching if specific keywords are hit.
- **Example Use Case**: "Hey @review-miner, mines user reviews from reddit, x, app store, play store — extracts real pain points & feature gaps for the new auth feature."
- **How It Differs From Similar Personas**: Focuses entirely on Review Miner workflows rather than general responsibilities.

#### 30. Scrum Master (@scrum)
- **Underlying Agent**: Copilot / Gemini
- **Specialty**: Certified Scrum Master — sprint planning, story preparation, retrospectives, velocity tracking, blocker removal
- **System Prompt Logic**: Direct, declarative action. Tone is Direct and opinionated. Standard conversational filler. Prioritizes exact completion of the specified role over generic helpfulness.
- **Unique Behaviors / Flags**: Highly specialized role constraints. Routes based on internal regex matching if specific keywords are hit.
- **Example Use Case**: "Hey @scrum, certified scrum master — sprint planning, story preparation, retrospectives, velocity tracking, blocker removal for the new auth feature."
- **How It Differs From Similar Personas**: Focuses entirely on Scrum Master workflows rather than general responsibilities.

#### 31. Security Auditor (@security)
- **Underlying Agent**: Copilot / Gemini
- **Specialty**: Security — threat modeling, OWASP, pen test planning, compliance
- **System Prompt Logic**: Direct, declarative action. Tone is Direct and opinionated. Standard conversational filler. Prioritizes exact completion of the specified role over generic helpfulness.
- **Unique Behaviors / Flags**: Highly specialized role constraints. Routes based on internal regex matching if specific keywords are hit.
- **Example Use Case**: "Hey @security, security — threat modeling, owasp, pen test planning, compliance for the new auth feature."
- **How It Differs From Similar Personas**: Focuses entirely on Security Auditor workflows rather than general responsibilities.

#### 32. Storyteller (@storyteller)
- **Underlying Agent**: Copilot / Gemini
- **Specialty**: Hero
- **System Prompt Logic**: Direct, declarative action. Tone is Direct and opinionated. Standard conversational filler. Prioritizes exact completion of the specified role over generic helpfulness.
- **Unique Behaviors / Flags**: Standard persona wrapper. Routes based on internal regex matching if specific keywords are hit.
- **Example Use Case**: "Hey @storyteller, hero for the new auth feature."
- **How It Differs From Similar Personas**: Focuses entirely on Storyteller workflows rather than general responsibilities.

#### 33. Strategist (@strategist)
- **Underlying Agent**: Copilot / Gemini
- **Specialty**: Billionaire-level strategist — market intelligence, brand positioning, investor pitch, GTM, business model
- **System Prompt Logic**: Direct, declarative action. Tone is Direct and opinionated. Standard conversational filler. Prioritizes exact completion of the specified role over generic helpfulness.
- **Unique Behaviors / Flags**: Highly specialized role constraints. Routes based on internal regex matching if specific keywords are hit.
- **Example Use Case**: "Hey @strategist, billionaire-level strategist — market intelligence, brand positioning, investor pitch, gtm, business model for the new auth feature."
- **How It Differs From Similar Personas**: Focuses entirely on Strategist workflows rather than general responsibilities.

#### 34. SVG Artist (@svgart)
- **Underlying Agent**: Copilot / Gemini
- **Specialty**: SVG & CSS art generator — creates ready-to-import SVG files, icons, logos, illustrations, and UI assets
- **System Prompt Logic**: Direct, declarative action. Tone is Direct and opinionated. Standard conversational filler. Prioritizes exact completion of the specified role over generic helpfulness.
- **Unique Behaviors / Flags**: Highly specialized role constraints. Routes based on internal regex matching if specific keywords are hit.
- **Example Use Case**: "Hey @svgart, svg & css art generator — creates ready-to-import svg files, icons, logos, illustrations, and ui assets for the new auth feature."
- **How It Differs From Similar Personas**: Focuses entirely on SVG Artist workflows rather than general responsibilities.

#### 35. Test Architect (Murat) (@tea)
- **Underlying Agent**: Copilot / Gemini
- **Specialty**: Master test architect specializing in risk-based testing, ATDD, test strategy, and CI/CD quality governance
- **System Prompt Logic**: Direct, declarative action. Tone is Direct and opinionated. Standard conversational filler. Prioritizes exact completion of the specified role over generic helpfulness.
- **Unique Behaviors / Flags**: Highly specialized role constraints. Routes based on internal regex matching if specific keywords are hit.
- **Example Use Case**: "Hey @tea, master test architect specializing in risk-based testing, atdd, test strategy, and ci/cd quality governance for the new auth feature."
- **How It Differs From Similar Personas**: Focuses entirely on Test Architect (Murat) workflows rather than general responsibilities.

#### 36. Teaching Assistant (@teacher)
- **Underlying Agent**: Copilot / Gemini
- **Specialty**: Patient expert educator — Bloom
- **System Prompt Logic**: Direct, declarative action. Tone is Direct and opinionated. Standard conversational filler. Prioritizes exact completion of the specified role over generic helpfulness.
- **Unique Behaviors / Flags**: Standard persona wrapper. Routes based on internal regex matching if specific keywords are hit.
- **Example Use Case**: "Hey @teacher, patient expert educator — bloom for the new auth feature."
- **How It Differs From Similar Personas**: Focuses entirely on Teaching Assistant workflows rather than general responsibilities.

#### 37. Tech Writer (@techwriter)
- **Underlying Agent**: Copilot / Gemini
- **Specialty**: READMEs, API docs, tutorials, changelogs, migration guides
- **System Prompt Logic**: Direct, declarative action. Tone is Direct and opinionated. Standard conversational filler. Prioritizes exact completion of the specified role over generic helpfulness.
- **Unique Behaviors / Flags**: Highly specialized role constraints. Routes based on internal regex matching if specific keywords are hit.
- **Example Use Case**: "Hey @techwriter, readmes, api docs, tutorials, changelogs, migration guides for the new auth feature."
- **How It Differs From Similar Personas**: Focuses entirely on Tech Writer workflows rather than general responsibilities.

#### 38. Test Architect (@tester)
- **Underlying Agent**: Copilot / Gemini
- **Specialty**: Test strategy, automation frameworks, quality gates, CI/CD
- **System Prompt Logic**: Direct, declarative action. Tone is Direct and opinionated. Standard conversational filler. Prioritizes exact completion of the specified role over generic helpfulness.
- **Unique Behaviors / Flags**: Highly specialized role constraints. Routes based on internal regex matching if specific keywords are hit.
- **Example Use Case**: "Hey @tester, test strategy, automation frameworks, quality gates, ci/cd for the new auth feature."
- **How It Differs From Similar Personas**: Focuses entirely on Test Architect workflows rather than general responsibilities.

#### 39. UI Builder (@ui-builder)
- **Underlying Agent**: Copilot / Gemini
- **Specialty**: Builds the actual HTML prototypes — GSAP animations, design systems, SVG assets, Awwwards-quality output
- **System Prompt Logic**: Direct, declarative action. Tone is Direct and opinionated. Standard conversational filler. Prioritizes exact completion of the specified role over generic helpfulness.
- **Unique Behaviors / Flags**: Highly specialized role constraints. Routes based on internal regex matching if specific keywords are hit.
- **Example Use Case**: "Hey @ui-builder, builds the actual html prototypes — gsap animations, design systems, svg assets, awwwards-quality output for the new auth feature."
- **How It Differs From Similar Personas**: Focuses entirely on UI Builder workflows rather than general responsibilities.

#### 40. UX Designer (Sally) (@ux-designer)
- **Underlying Agent**: Copilot / Gemini
- **Specialty**: Senior UX designer specializing in user research, interaction design, and human-centered experience strategy
- **System Prompt Logic**: Direct, declarative action. Tone is Direct and opinionated. Standard conversational filler. Prioritizes exact completion of the specified role over generic helpfulness.
- **Unique Behaviors / Flags**: Highly specialized role constraints. Routes based on internal regex matching if specific keywords are hit.
- **Example Use Case**: "Hey @ux-designer, senior ux designer specializing in user research, interaction design, and human-centered experience strategy for the new auth feature."
- **How It Differs From Similar Personas**: Focuses entirely on UX Designer (Sally) workflows rather than general responsibilities.

#### 41. Workflow Builder (Wendy) (@workflow-builder)
- **Underlying Agent**: Copilot / Gemini
- **Specialty**: Workflow architecture specialist and process design expert who creates efficient, scalable BMAD workflows
- **System Prompt Logic**: Direct, declarative action. Tone is Direct and opinionated. Standard conversational filler. Prioritizes exact completion of the specified role over generic helpfulness.
- **Unique Behaviors / Flags**: Highly specialized role constraints. Routes based on internal regex matching if specific keywords are hit.
- **Example Use Case**: "Hey @workflow-builder, workflow architecture specialist and process design expert who creates efficient, scalable bmad workflows for the new auth feature."
- **How It Differs From Similar Personas**: Focuses entirely on Workflow Builder (Wendy) workflows rather than general responsibilities.



## 6. Core Systems — Deep Dive

### 6a. Hooks (Lifecycle)
- **Pre-task**: Intercepted in `src/orchestrator/router.js` (`routeAndRun`). Modifies the prompt via `token-compressor.js`, retrieves historical relevant context via `memoryPool.recall()`, and injects persona logic. Side effect: Context expands.
- **In-task**: Handled by `src/agents/spawner.js`. Spawns `child_process`, captures stdout/stderr, and emits real-time events to the REPL and `stall-monitor.js`. Side effect: Local state mutation and websocket broadcasting.
- **Post-task**: In `router.js`, invokes `_assessQualityAI` to grade the response. Updates the agent's grade in `registry.js`, stores the output trajectory in the `MemoryPool`, and records token usage via `cost-tracker.js`.

### 6b. ContextPantry
Defined in `src/core/context-pantry.js`. It operates as short-term working memory stored in `~/.soupz-agents/pantry/` as JSON. When the active context gets too large, old messages are pushed to the pantry. When new prompts arrive, it uses simple keyword matching to `recall(query)` and prepend relevant old chat blocks into the system prompt lifecycle before calling the LLM.

### 6c. MemoryPool
Defined in `src/memory/pool.js`. It provides episodic persistence using local JSON files in `~/.soupz-agents/memory-pool/`. It triggers a write on successful task completion, saving the prompt, agent, tags, and output. It reads automatically on new tasks, utilizing an AI-enhanced recall (via Copilot/Ollama) to extract relevant chunks to inject into the prompt, enabling cross-session learning. Evicts oldest banks automatically based on max limit.

### 6d. TokenCompressor
Defined in `src/core/token-compressor.js`. Employs three levels of compression (light, medium, aggressive). Triggers automatically on prompts over 30 chars. Drops filler words, normalizes whitespace, abbreviates common technical terms (e.g., 'configuration' to 'config'), and structurally restructures prompts into strict `[TASK] / [CTX] / [OUT]` machine-readable blocks. Uncompresses outputs (expanding abbreviations).

### 6e. AgentSpawner
Defined in `src/agents/spawner.js`. It uses standard `child_process.spawn` rather than full PTY internally to easily parse output via pipes, but the `remote-server` uses `node-pty` for dashboard integration. The spawner streams stdout line-by-line, passing it to `parsers.js` to extract clean text. On crash or non-zero exit, it emits an error event and penalizes the agent's grade.

### 6f. Grading System
Defined in `src/grading/scorer.js` and augmented by `router.js` (`_assessQualityAI`). Criteria include code block presence, length, and overlap with prompt vocabulary. Outputs a 1-5 or 0-100 score which adjusts the agent's lifetime grade. Layered grading uses Copilot `gpt-4o-mini` first, falling back to Ollama, and finally pure regex rules. A high failure rate lowers the grade, effectively demoting the agent from future automatic routing.

### 6g. Plan Mode / Task Decomposition
Flow starts in `src/session.js` where `getTaskComplexity()` analyzes the prompt. If complex (level 1 or 2), it calls `orchestrator.decompose(prompt)` in `router.js`.
1. `decompose()` uses Copilot/Ollama to return a JSON array of sub-tasks.
2. In `session.js` (`orchestrateMultiAgent`), it iterates over the sub-tasks, assigns each to the best agent via `pickAgentForTask()`.
3. Dispatches them via `Promise.allSettled` utilizing `orchestrator.runOn()`.
4. Outputs are aggregated and returned. Highly complex tasks spawn hidden background workers via `spawnFleet()`.

### 6h. MCP Client
Defined in `src/mcp/client.js`. Connects to external Model Context Protocol servers. It spawns the server process and establishes JSON-RPC communication via stdio. Features `register`, `connect`, `callTool`, and `allTools`. If an MCP server times out or crashes during initialization, it is safely unregistered and ignored, keeping the core orchestrator alive.

## 7. The 3-Layer Routing System

Defined in `src/orchestrator/semantic-router.js`.
- **Layer 1 (Copilot Claude/GPT AI)**: Triggered first (if enabled). Makes a smart LLM call to pick the optimal agent ID based on a stringified list of agent capabilities. Output is the exact agent ID.
- **Layer 2 (Local Ollama AI)**: Triggered if Copilot fails or mode is 'ollama'. Fast semantic matching using local `qwen2.5:1.5b`. Output is the exact agent ID.
- **Layer 3 (Rule-based Regex Fallback)**: Triggered if AI fails or is offline. Uses `semanticPatterns` matching keywords like 'ui', 'fix', 'deploy' to specific internal categories, adding numeric weights to available agents and picking the highest score.

```text
User Prompt -> [ 1. Copilot AI Routing (Smartest) ] --(Success)--> Execute
                     |
                 (Fail/Timeout)
                     |
                     v
               [ 2. Ollama Local AI (Fast) ] --(Success)--> Execute
                     |
                 (Fail/Timeout)
                     |
                     v
               [ 3. Regex / Keyword Rules ] --(Success)--> Execute
```

## 8. The Dashboard (packages/dashboard/)
A React 18 / Vite frontend representing the 'Kitchen Control Room'.
- **Components**: Timeline (shows events), Queue Panel, Lanes Panel (visualizing waiter, head-chef, dev-chef, design-chef states), Metrics (success rate, latency), Output Panel, and Changes Drawer (file diffs).
- **Connection**: It polls a REST API exposed by the `remote-server` (e.g., `/api/orders`, `/api/changes`) intervally (every 1.5 - 2.5s) to sync state. 
- **User Actions**: Submitting new orders, changing agent policies, toggling diff views, selecting active terminals.

## 9. The Remote Server (packages/remote-server/)
An Express / WebSocket bridge connecting the web dashboard to the local CLI environment.
- **Endpoints**: Exposes REST endpoints for orders and health checks.
- **WebSockets**: Streams terminal `stdout` via websockets and accepts user input to pipe directly into `node-pty` processes.
- **Auth Flow**: Uses a 6-8 digit OTP generated via `/cloud-kitchen`. The user enters the code on the web/mobile client, hitting `/pair/validate`, which returns a session token. Subsequent WS connections authenticate using this token.

## 10. Placeholder Packages — Honest Assessment

### `packages/mobile-ide/`
- **What code actually exists**: A functioning React Native (Expo) `App.js` with fully styled UI themes (Kitchen, Brutal, Skeuo, Neo, Glass). Contains logic for OTP pairing, WebSocket connection, and terminal emulation stripping ANSI codes.
- **What it's intended to do**: Act as a pocket command center to remote-control the desktop terminal and view active agents.
- **Exact gap**: Code is substantial but lacks deep file-system diff viewing and push notifications. It relies entirely on the `remote-server` being active and accessible over the network/tunnel.

### `packages/browser-extension/`
- **What code actually exists**: A Manifest V3 extension with `content.js` that highlights DOM elements, generates CSS selectors, and summarizes page stats. A basic `popup.html`.
- **What it's intended to do**: Allow agents to inspect live DOM, extract context, and modify UI visually.
- **Exact gap**: It is highly scaffolded but not fully integrated into the CLI's main agent execution loop. The bidirectional communication back to the CLI orchestrator to automatically feed DOM context is incomplete.

## 11. End-to-End Data Flow
1. **Input**: User types prompt in CLI (`src/session.js`).
2. **Analysis**: `getTaskComplexity()` determines if it's a simple task or complex plan.
3. **Routing**: `orchestrator.routeAndRun()` calls `semantic-router.js` to select the best persona/tool.
4. **Context Injection**: `context-pantry.js` and `pool.js` append historical memory to the prompt.
5. **Compression**: `token-compressor.js` minimizes the payload.
6. **Execution**: `spawner.js` launches the binary (e.g., `gh copilot`) with the persona's system prompt.
7. **Streaming**: Output is caught, stripped of ANSI (`parsers.js`), logged to the terminal, and broadcast via WS by `remote-server`.
8. **Persistence**: The result is graded (`scorer.js`) and saved to `MemoryPool`.
9. **UI Update**: `stall-monitor.js` updates state; the React Dashboard fetches and renders the new timeline.

## 12. Honest Feature Status

| Feature | Status | Notes |
|---|---|---|
| CLI REPL & Auto-completion | ✅ Working | Custom dropdown and fuzzy matching implemented. |
| 40+ Persona Injection | ✅ Working | Prompts load correctly based on routing. |
| Semantic Routing (Ollama/Rules) | ✅ Working | 3-layer fallback system is functional. |
| Plan Mode / Task Decomposition | ✅ Working | Breaks down tasks and runs via `/parallel` or `/fleet`. |
| Context Pantry / Memory Pool | ✅ Working | File-system based short/long-term memory is active. |
| Token Compression | ✅ Working | Implemented via regex AST logic. |
| Cloud Kitchen Bridge (OTP & WS) | ✅ Working | Express server establishes PTY and streams safely. |
| Web Dashboard UI | 🔧 Partial | UI exists, but relies on polling rather than full WS event pushes. |
| Mobile IDE | 🔧 Partial | RN App built, but network discovery relies on manual IP entry or `/tunnel`. |
| Browser Extension DOM Bridge | 📋 Planned | Scaffolded scripts exist, missing orchestrator integration. |
| MCP Integration | ✅ Working | `src/mcp/client.js` successfully connects and parses external tools. |

## 13. Top 5 Next Steps (Prioritized by Impact)
1. **Dashboard WebSocket Refactor**: Convert the polling mechanism in `packages/dashboard/src/App.jsx` to consume the WebSocket event stream from `remote-server` directly to lower latency. (Complexity: Low).
2. **Finish Browser Extension Bridge**: Wire the Chrome extension's `element_selected` message directly into the CLI's active session input buffer via a local HTTP endpoint. (Complexity: Medium).
3. **Enhance Fleet Status Observation**: Update `stall-monitor.js` to track granular stdout of background `/fleet` processes, making them visible in the dashboard timeline. (Complexity: Medium).
4. **Global Supabase Sync**: Connect `src/auth/user-auth.js` directly to the `MemoryPool` to backup/restore learned trajectories across devices. (Complexity: High).
5. **AST/WASM Agent Booster**: Implement a local execution path in `router.js` that completely bypasses LLMs for formatting tasks using local formatters (Prettier/ESLint) before making API calls. (Complexity: Medium).

---