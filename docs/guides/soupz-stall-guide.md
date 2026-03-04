# Soupz-Stall v0.1-alpha — Guide

> Your personal Jarvis CLI — orchestrates multiple AI agents with 22 expert personas, smart task management, context sharding, and developer-first UX. Now called **Soupz-Stall** 🫡

---

## 🚀 Quick Start

```bash
soupz-stall                     # Launch (or soupz-agents — both work)
soupz-agents --yolo              # YOLO mode
soupz-agents add ollama          # Add new CLI agent
```

---

## 🏗️ Architecture

```
soupz-stall
├── 🚀 Antigravity ── 22 personas (VS Code · handles UI/browse tasks)
├── 🐙 Copilot ────── 22 personas (GitHub Copilot CLI · GPT-4.1)
├── 🔮 Gemini ─────── 22 personas (switchable: 2.5-pro, 2.5-flash)
├── 🎯 Kiro ───────── 22 personas (Kiro CLI · file ops, AWS, subagents)
├── 🤖 Ollama ─────── 22 personas (local LLMs)
├── 🎯 AUTO ────────── picks best tool + persona per prompt
└── 🧩 SHARDS ─────── 7 memory slots (auto-offload context overflow)
```

Every tool × persona combo gets a grade. The auto-router uses grades to pick the best agent.

---

## 🎮 Interactive Mode

### Navigation
| Key | Action |
|-----|--------|
| `/` | Opens command dropdown |
| `@` | Opens persona dropdown |
| `#` | Opens file picker dropdown |
| `↑ ↓` | Navigate dropdown |
| `Tab` or `Enter` | Select item from dropdown |
| `Esc` | Close dropdown |
| `Shift+Enter` | New line (multiline prompts) |
| `Enter` | Submit prompt |
| `Ctrl+C` | Exit |
| `Ctrl+L` | Clear screen |

### All Commands
| Command | What It Does |
|---------|-------------|
| `/help` | Show all commands |
| `/agents` | List tool agents |
| `/personas` | List all 22 personas |
| `/tool <id>` | Lock to specific tool |
| `/auto` | Full auto mode |
| `/model` | Show/switch model |
| `/yolo` | Toggle YOLO mode |
| `/browse [url]` | Screenshot via Antigravity |
| `/todo` | Show visual task card |
| `/do <n>` | Execute task #n |
| `/do all` | Execute all pending tasks |
| `/tokens` | Token usage breakdown |
| `/grades` | Report cards grid |
| `/shards` | Memory shards status |
| `/shard store <text>` | Store context |
| `/shard recall <query>` | Search shards |
| `/sandbox` | Toggle ~/Developer lock |
| `/clear` | Clear context |
| `/rename <name>` | Name session |
| `/sessions` | List sessions |
| `/load <name>` | Load session |
| `/login <agent>` | Agent auth |
| `/logout <agent>` | Agent logout |
| `/quit` | Exit |

---

## 🧠 Smart Features

### Multi-Step Detection (5 Heuristics)
The CLI detects multi-step prompts using 5 pattern matchers:

| # | Pattern | Example |
|---|---------|---------|
| 1 | **Comma-separated action verbs** (≥3) | `create login, add OAuth, write tests, deploy` |
| 2 | **Numbered items** | `1. build X  2. test Y  3. deploy Z` |
| 3 | **Sequential markers** (≥3 of: then/next/also/finally) | `first set up DB, then add routes, also write tests, finally deploy` |
| 4 | **Semicolons** (≥3 segments) | `fix UI; add tests; deploy to prod` |
| 5 | **Bullet points** (≥3 lines starting with -, *, •) | markdown-style lists |

When triggered, renders a **visual task card**:
```
  ╭────────────────────────────────────────────────────────╮
  │  📋 Tasks                                  0/5 done   │
  │────────────────────────────────────────────────────────│
  │  🔵  1. Create login page with OAuth                   │
  │  🔵  2. Add protected routes                           │
  │  🔵  3. Set up PostgreSQL database                     │
  │  🔵  4. Write unit tests                               │
  │  🔵  5. Deploy to Vercel                               │
  │────────────────────────────────────────────────────────│
  │  ░░░░░░░░░░░░░░░░░░░░░░░░  0%                         │
  ╰────────────────────────────────────────────────────────╯
```

Icons update as tasks run:
- 🔵 pending → 🟡 running → ✅ done (with timing) → ❌ failed

### Auto-Route → Antigravity
Prompts mentioning `UI`, `interface`, `wireframe`, `layout`, `screenshot`, or `localhost` auto-route to **Antigravity** (unless you've locked to a specific tool with `/tool`).

### Auto-Browse
`check localhost:3000` → Antigravity opens Chrome headlessly, screenshots the page, and returns a preview.

### Shift+Enter (Multiline)
Press `Shift+Enter` to add a new line so you can write longer, more detailed prompts:
```
> Build a dashboard with…  [Shift+Enter]
  … dark mode, charts…     [Shift+Enter]
  … and authentication     [Enter to submit]
```

### File References
Type `#` to see a file picker. `#filename.js` attaches the file's content (first 5000 chars) to your prompt.

---

## 🧩 Context Sharding (Expanded Memory)

### What Problem It Solves
AI agents have limited context windows. Once the conversation gets too long, old messages are lost. Sharding solves this by storing context across 7 persistent memory slots.

### How It Works
```
You type a prompt
     │
     ├── 1. Auto-offload: if conversation > 50 messages,
     │      oldest 20 are compressed and stored in a shard
     │
     ├── 2. Pre-query: before sending to agent,
     │      all shards are searched for relevant context
     │      and injected into the prompt
     │
     └── 3. Agent gets: recalled shard context + your prompt
```

### Storage
Shards are JSON files in `~/.soupz-agents/shards/`:
```
~/.soupz-agents/shards/
├── shard-1.json   ← auto-context (oldest messages)
├── shard-2.json   ← auto-context (batch 2)
├── shard-3.json   ← manual store
└── ...            ← up to 7 shards
```

Each shard stores ~4000 tokens. When all 7 are full, the oldest shard is evicted (circular buffer).

### Commands
| Command | What It Does |
|---------|-------------|
| `/shards` | Visual status card showing all shards |
| `/shard store <text>` | Manually store important context |
| `/shard recall <query>` | Search shards by keyword |

### Future: ChatGPT 4.1 Shards
In the next version, shards will be backed by live **GPT-4.1** instances via Copilot CLI. Each shard will be a separate conversation with a ChatGPT instance that can answer queries about its stored context. This effectively multiplies your context window by 7x.

---

## 🏆 Report Cards

`/grades` shows a grid:
```
                  🐙 copilot    🔮 gemini     🤖 ollama
  ──────────────────────────────────────────────────────
  💼 @strategist   B 70          A 85          C 55
  🏗️ @architect    A 82          B 75          D 48
  🎨 @designer     B 72          A 88          C 52
```

Grades: `A+ (90+)` → `A (80-89)` → `B (70-79)` → `C (60-69)` → `D (50-59)` → `F (<50)`. Based on success/failure and API speed.

---

## 🎭 All 22 Personas (Detailed)

### 💼 Business & Strategy

**@strategist** — Billionaire-level business strategist. Analyzes ideas through investor, entrepreneur, and critic lenses. Gives feasibility scores, market sizing, competitive moats. Use for: startup ideas, pivot decisions, investor prep.

**@analyst** — Requirements and business analyst. Creates user stories, acceptance criteria, market research. Breaks down problem statements into actionable requirements with RICE/MoSCoW prioritization.

**@pm** — Product Manager. Creates PRDs, roadmaps, feature specs. Prioritizes backlogs, defines KPIs, runs stakeholder alignment. Thinks in sprints and OKRs.

**@innovator** — Innovation strategist. Uses Blue Ocean Strategy, Disruption Theory, Business Model Canvas. Finds whitespace in markets. Use for: new product ideas, "what if" scenarios, competitive disruption.

### 🏗️ Technical

**@architect** — System architect. Designs APIs, database schemas, microservice boundaries, event systems. Creates architecture decision records (ADRs). Handles: monolith vs micro, caching strategies, scaling.

**@planner** — Sprint planner and project manager. Creates parallel work plans, file ownership maps, dependency graphs. Breaks epics into stories and tasks. Use for: hackathon planning, sprint capacity.

**@devops** — DevOps + infrastructure. Docker, CI/CD, Terraform, Kubernetes, monitoring. Creates Dockerfiles, GitHub Actions, deployment scripts. Use for: infra setup, deployment automation.

**@security** — Security engineer. STRIDE threat modeling, OWASP Top 10, pen test checklists, compliance (SOC2, GDPR). Reviews code for vulnerabilities. Use for: auth design, input validation.

**@tester** — QA engineer. Test pyramid strategy, automation frameworks (Jest, Cypress, Playwright). Creates test plans, edge cases, regression suites. Thinks in: happy path, error path, boundary conditions.

**@datascientist** — ML and data engineer. Designs data pipelines, ML models, A/B tests, evaluation metrics. Creates Jupyter notebooks, feature engineering, model selection.

### 🎨 Design

**@designer** — UX/UI designer. Creates user flows, wireframes, information architecture, micro-interactions. Accessibility-first. Can generate HTML wireframes with inline CSS on request.

### 📝 Content

**@presenter** — Hackathon pitch expert. Creates slide decks, demo scripts, Q&A prep, elevator pitches. Structures talks for maximum impact. 3-minute pitch format specialist.

**@storyteller** — Narrative designer. Hero's Journey, AIDA, problem→solution→impact. Creates compelling origin stories for products. Use for: About pages, pitch narratives.

**@contentwriter** — Content strategist. Blog posts, social media, marketing copy, landing pages. SEO-aware writing. Creates content calendars and headline variations.

**@techwriter** — Technical writer. READMEs, API docs, changelogs, tutorials, migration guides. Clear, structured, with code examples. Creates: getting started guides, reference docs.

### 📚 Learning & Research

**@teacher** — Instructor. ELI5 explanations, deep dives, exercises with solutions. Socratic method. Adapts to your level. Use for: learning new tech, understanding concepts.

**@researcher** — API/SDK/tool researcher. Finds and compares tools, SDKs, services with comparison tables. Evaluates: pricing, developer experience, documentation quality.

**@evaluator** — Hackathon judge. Scores problem statements on: innovation, feasibility, market potential, technical difficulty. Creates scoring rubrics and competitive analysis.

### 🎯 Process

**@qa** — Quality assurance. Test plans, acceptance criteria, edge cases, bug templates. Thinks in: "what could go wrong?" Regression-focused.

**@scrum** — Scrum master. Sprint capacity planning, velocity tracking, blockers, retrospectives. Daily standup facilitation. Use for: team coordination.

**@brainstorm** — Idea generator. SCAMPER, Six Thinking Hats, Crazy 8s, Brainwriting. Generates 20+ ideas, then filters to top 3 with rationale.

**@problemsolver** — Root cause analyst. 5 Whys, Fishbone/Ishikawa, First Principles, MECE. Breaks complex problems into structured decision trees.

---

## ✏️ Editing Agents

### File Locations
```
~/.soupz-agents/agents/     # Your overrides (highest priority)
~/Developer/soupz-agents/defaults/agents/   # Defaults
```

### Tool Agent Format
```yaml
---
name: Gemini
id: gemini
icon: "🔮"
color: "#4285F4"
binary: gemini
headless: true
output_format: stream-json   # text | stream-json | json
capabilities: [research, code]
routing_keywords: [explain, analyze]
auth_command: "gemini auth"
build_args: ["-p", "{prompt}", "--output-format", "stream-json"]
grade: 50
---
```

### Persona Format
```yaml
---
name: Strategist
id: strategist
icon: "💼"
color: "#FFD700"
type: persona
uses_tool: auto
system_prompt: |
  You are a world-class business strategist...
routing_keywords: [idea, business, startup]
grade: 70
---
```

---

## ➕ Adding New CLIs

```bash
soupz-agents add aider      # Auto-creates .md file
```

Common `build_args`:
| Tool | Args |
|------|------|
| Gemini | `["-p", "{prompt}", "--output-format", "stream-json"]` |
| Copilot | `["copilot", "-p", "{prompt}"]` |
| Ollama | `["run", "llama3.1", "{prompt}"]` |

---

## 📂 Data Directory

```
~/.soupz-agents/
├── agents/         # Agent overrides
├── sessions/       # Named sessions (YourBuilder is here)
├── shards/         # Memory shard JSON files
├── auth/           # Login state
├── context/        # Conversation context
├── memory/         # Routing patterns
├── analytics/      # Grade data
└── screenshot-*.png
```

---

## 🔮 Future Features (Planned)

### v2.6 — Live Shards via GPT-4.1
Replace file-based shards with live ChatGPT 4.1 instances via Copilot CLI. Each shard becomes a persistent conversation that can be queried.

### v2.7 — Agent Chaining
Chain agents: `@architect → @planner → @devops`. Output of one feeds into the next. Auto-chains based on task type.

### v2.8 — Visual Browser Dashboard
Replace puppeteer screenshots with a live browser dashboard. Antigravity opens Chrome with a custom overlay showing task progress, errors, and site preview side-by-side.

### v2.9 — Team Mode
Multiple users share a session. Real-time updates on who's doing what. Task assignment by user.

### Roadmap — Plugin System (planned)
Community plugins: `.soupz-plugin.js` files that add commands, personas, or tools. npm registry integration.

### v3.1 — Voice Input
`/listen` — speech-to-text for hands-free prompting.

### v3.2 — Colored Output
Syntax highlighting for code in agent responses. File names, commands, and URLs auto-colored in conversation output.

### v3.3 — Diff Preview
Before agents write code, show a diff preview. Accept/reject individual changes.

### v3.4 — Cost Tracking
Track real API costs per agent. Monthly budgets, alerts when approaching limits.

---

## 🎮 Example Workflows

### Hackathon Sprint
```
@evaluator compare PS 1, PS 2, PS 3
@strategist evaluate the winning idea
@architect design the system
@planner sprint plan for 4 people, 36 hours
@designer create user flow
check localhost:3000              ← auto-routes to Antigravity!
@presenter create pitch deck
```

### Dev with Smart Todos
```
Build a React dashboard, add JWT auth,    [Shift+Enter]
create Express API, PostgreSQL schema,    [Shift+Enter]
write unit tests, deploy to Vercel        [Enter]
                                          ← auto-detects tasks!
/do 1                                     ← execute first
/do all                                   ← run all
/todo                                     ← visual progress
```

### Continue Building Soupz-Stall
```
/load YourBuilder                         ← loads build context
add a /ux command that generates wireframes
/shards                                   ← check memory
```

---

## 💰 Model Selection

Models are available via `/utensil` — switch at any time. Cost multipliers are shown in the picker. Copilot and Ollama are subscription/free. Gemini charges per token.

Pick based on your task and budget — there are no rigid rules. Run `/utensil` to see the full list with pricing.

---

## 🎨 Hackathon Designer Mega-Prompt

Paste this into soupz-stall when starting a hackathon project:

```
@orchestrator I'm building [PROJECT_NAME] for a hackathon. 
Here's the concept: [ONE SENTENCE DESCRIPTION]
Target users: [WHO]
Core value prop: [WHAT PROBLEM DOES IT SOLVE]
Time: 24 hours. Team: [N] people.

I need you to:
1. Define the visual identity (colors, typography, mood)
2. Create the hero section HTML/CSS/JS (Awwwards quality, GSAP animations)
3. Design the core product UI (the main screen users see)
4. Create an SVG logo mark
5. Write the 3-second elevator pitch for judges

Prioritize: visual impact > feature completeness. Judges decide in 30 seconds.
```

**Or go directly to the designer:**
```
@designer Create a complete landing page for [PROJECT].
The aesthetic should feel like [lusion.co / linear.app / stripe / etc].
Key sections: hero with GSAP scroll animation, features grid, CTA.
Use CSS custom properties, include GSAP CDN, full production HTML.
Color palette: [dark/light/colorful]. Typography mood: [bold/elegant/technical].
Output: single complete HTML file, copy-paste ready.
```

**For SVG logo/brand assets:**
```
@svgart Create a logo mark for [PROJECT NAME].
It represents: [concept].
Style: [geometric/organic/wordmark/abstract].
Colors: [primary color] on [background].
Output: complete SVG code (3 variants: full color, mono, reversed).
Also create: app icon (rounded square, 512x512), favicon (32x32).
```

**For tech architecture:**
```
@architect I need a hackathon-ready tech stack for [PROJECT].
It needs: [real-time/AI/auth/payments/etc].
Team skills: [React/Python/etc].
Target: deployed in < 2 hours.
Give me: stack decision, folder structure, 5 core API routes, DB schema.
```

---

## 🔗 Multi-Agent Chains

**Design → SVG → Code pipeline:**
```
/chain designer→svgart "Create complete brand for a [project]: landing page + logo SVG + icon set"
```

**Research → Design → Present:**
```
/chain researcher→designer→presenter "Research top fintech apps, design a dashboard UI, create pitch slides"
```

**Orchestrate everything:**
```
@orchestrator Run full hackathon mode for [PROJECT]:
- Research competitors
- Define brand identity  
- Create prototype HTML
- Design SVG assets
- Write pitch deck outline
Coordinate all agents and give me a complete package.
```

---

## 🛠️ Skills in GitHub Copilot CLI

Your soupz agents are now also available as Copilot CLI skills (in `/skills` panel):

| Skill | Description |
|-------|-------------|
| `soupz-designer` | Full design agency — Awwwards-quality UI, GSAP, brand |
| `soupz-svgart` | SVG logo/icon/illustration generator |
| `soupz-orchestrator` | BMAD-style coordinator for complex tasks |
| `soupz-architect` | Tech stack, system design, API schemas |
| `soupz-researcher` | Competitive analysis, design inspiration |

To use in Copilot CLI: toggle them on in `/skills` panel, then just ask naturally.
The skill context is automatically injected when it's active.
