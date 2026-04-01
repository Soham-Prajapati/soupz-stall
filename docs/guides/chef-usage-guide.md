# 🧑‍🍳 Chef Usage Guide — All 38 Chefs

> **How and when to call each chef**, organized by workflow phase.
> Every chef is summoned with `@chefid` in the Soupz Stall session.

---

## 🚦 Recommended Workflow Order

For a **new project from scratch**, call chefs in this order:

```
Phase 1: DISCOVER    → @researcher → @analyst → @domain-scout → @review-miner
Phase 2: STRATEGIZE  → @strategist → @innovator → @pm → @brainstorm
Phase 3: PLAN        → @master → @architect → @planner → @scrum
Phase 4: DESIGN      → @design-thinking-coach → @ux-designer → @designer → @ui-builder
Phase 5: BUILD       → @dev → @quick-flow → @svgart → @forager
Phase 6: TEST        → @qa → @tester → @tea → @security
Phase 7: SHIP        → @devops → @techwriter → @contentwriter → @storyteller
Phase 8: PITCH       → @presenter → @evaluator → @brand-chef
Phase 9: LEARN       → @teacher → @problemsolver → @datascientist
```

You don't need all phases for every project. Pick what you need.

---

## Phase 1: 🔍 DISCOVER — Understand the landscape

| Chef | Summon | When to Use | What You Get |
|------|--------|-------------|--------------|
| 🔬 Researcher | `@researcher` | Starting a new project, evaluating tools/APIs, competitive analysis | Tool comparison tables, API evaluations, market sizing, competitor maps |
| 📊 Business Analyst | `@analyst` | Turning a vague idea into structured requirements | User stories, SWOT analysis, gap analysis, KPI definitions, PRD skeleton |
| 🗺️ Domain Scout | `@domain-scout` | Understanding where your product fits in the market | Competitive domain maps, product classification, whitespace identification |
| ⛏️ Review Miner | `@review-miner` | Finding real user pain points from existing products | Sentiment analysis from Reddit/X/App Store, feature gaps, pain point clusters |

**Example workflow:**
```bash
@researcher "Find the best free AI coding assistants — compare features, limits, pricing"
@analyst "Turn this research into requirements for building our own AI assistant"
@domain-scout "Map the competitive landscape for AI-powered CLI tools"
```

---

## Phase 2: 💡 STRATEGIZE — Define the vision

| Chef | Summon | When to Use | What You Get |
|------|--------|-------------|--------------|
| 💼 Strategist | `@strategist` | Building business model, investor pitch, go-to-market | Porter's Five Forces analysis, unit economics, TAM/SAM/SOM, GTM plan |
| 🚀 Innovation Strategist | `@innovator` | Finding disruption opportunities, Blue Ocean thinking | Blue Ocean Strategy Canvas, Jobs-to-be-Done analysis, pivot options |
| 🎯 Product Manager | `@pm` | Writing PRDs, prioritizing features, defining MVP | PRD, RICE-scored backlog, user personas, north star metric, roadmap |
| 💡 Brainstorming Coach | `@brainstorm` | Generating creative solutions, breaking mental blocks | SCAMPER output, Six Thinking Hats analysis, prioritized idea matrix |

**Example workflow:**
```bash
@brainstorm "Generate 20 ideas for reducing AI token costs"
@strategist "Evaluate the top 3 ideas — which has the best market opportunity?"
@pm "Write a PRD for the winning idea with RICE prioritization"
```

---

## Phase 3: 📋 PLAN — Structure the work

| Chef | Summon | When to Use | What You Get |
|------|--------|-------------|--------------|
| 👑 Team Lead | `@master` | Complex projects needing full coordination — dump everything, get everything back | Executive summary, multi-persona delegation, integrated master plan |
| 🏗️ Tech Architect | `@architect` | System design decisions, tech stack selection | Architecture diagrams (Mermaid), API contracts, database schemas, ADRs |
| 📋 Project Planner | `@planner` | Sprint planning, parallel work lanes, task breakdown | Phase-by-phase Gantt charts, file ownership maps, anti-collision rules |
| 🏃 Scrum Master | `@scrum` | Sprint ceremonies, story preparation, retrospectives | Sprint backlog, acceptance criteria, velocity tracking, retro action items |

**Example workflow:**
```bash
@master "Build an AI-powered CLI tool. Team: 2 devs, 1 designer. Deadline: 2 weeks"
# Master spawns architect, planner, strategist, designer, researcher in parallel
# Then integrates outputs into a comprehensive plan
```

---

## Phase 4: 🎨 DESIGN — Shape the experience

| Chef | Summon | When to Use | What You Get |
|------|--------|-------------|--------------|
| 💡 Design Thinking Coach | `@design-thinking-coach` | Human-centered design process, empathy mapping | Empathy maps, "How Might We" statements, prototype plans |
| 🎯 UX Designer | `@ux-designer` | User flows, wireframes, interaction design | User journey maps, wireframe descriptions, usability heuristic reviews |
| 🎨 Design Agency | `@designer` | Full brand + UI design, landing pages, design systems | 8-phase brand engagement, HTML prototypes, color palettes, typography |
| 🏗️ UI Builder | `@ui-builder` | Building actual HTML/CSS prototypes | GSAP animations, responsive layouts, design system components |

**Example workflow:**
```bash
@design-thinking-coach "Map the user journey for a student trying to learn coding"
@ux-designer "Create wireframes for the top 3 screens"
@designer "Full visual design — brand identity, color palette, landing page"
@ui-builder "Build the HTML prototype with GSAP animations"
```

---

## Phase 5: 💻 BUILD — Write the code

| Chef | Summon | When to Use | What You Get |
|------|--------|-------------|--------------|
| 💻 Developer | `@dev` | Executing approved stories with TDD | Production code with full test coverage, story checklist progress |
| ⚡ Quick Flow | `@quick-flow` | Rapid solo development, minimum ceremony | Lean specs, fast implementation, working code ASAP |
| 🖼️ SVG Artist | `@svgart` | Creating SVG icons, logos, illustrations, CSS art | Ready-to-import SVG files, CSS artwork, icon sets |
| 🧺 Forager | `@forager` | Finding stock images, icons, visual assets | Curated image links from Unsplash/Pexels, quality-assessed assets |

**Example workflow:**
```bash
@dev "Implement the authentication module — story file: docs/stories/auth.md"
@svgart "Create an SVG logo for Soupz Stall — soup pot with steam, modern flat style"
@forager "Find 12 high-quality product photos for an ecommerce clothing store"
```

---

## Phase 6: 🧪 TEST — Ensure quality

| Chef | Summon | When to Use | What You Get |
|------|--------|-------------|--------------|
| 🧪 QA Engineer | `@qa` | Test plans, edge case identification, bug reports | Test plan document, edge case matrix, bug report templates |
| 🔍 Test Architect | `@tester` | Test strategy, automation framework design | Test pyramid, automation strategy, CI/CD quality gates |
| 🧪 Test Architect (Mahir) | `@tea` | Risk-based testing, ATDD, CI/CD quality governance | Risk matrices, acceptance test specs, quality gate definitions |
| 🔒 Security Auditor | `@security` | Threat modeling, OWASP checks, security hardening | STRIDE threat model, OWASP Top 10 audit, pen test plan |

**Example workflow:**
```bash
@qa "Write a test plan for the authentication module — cover edge cases"
@security "Perform STRIDE threat modeling on our API endpoints"
@tester "Design the test automation framework — what tools, what coverage targets?"
```

---

## Phase 7: 🚀 SHIP — Deploy and document

| Chef | Summon | When to Use | What You Get |
|------|--------|-------------|--------------|
| ⚙️ DevOps Engineer | `@devops` | Docker, CI/CD, infrastructure, monitoring | Dockerfiles, GitHub Actions, Terraform configs, monitoring dashboards |
| 📝 Tech Writer | `@techwriter` | READMEs, API docs, tutorials, changelogs | Structured documentation, migration guides, API reference |
| ✍️ Content Writer | `@contentwriter` | Blog posts, marketing copy, social media | SEO-optimized blogs, landing page copy, social media campaigns |
| 📖 Storyteller | `@storyteller` | Brand narrative, origin story, pitch copy | Hero's Journey narratives, elevator pitches, taglines |

**Example workflow:**
```bash
@devops "Create a Dockerfile and GitHub Actions CI/CD pipeline for our Node.js app"
@techwriter "Write a README with installation, usage, and API reference"
@contentwriter "Write a launch blog post announcing our new AI CLI tool"
```

---

## Phase 8: 🎤 PITCH — Present and evaluate

| Chef | Summon | When to Use | What You Get |
|------|--------|-------------|--------------|
| 🎤 Presentation Coach | `@presenter` | Hackathon pitches, investor decks, demo scripts | 5-minute pitch structure, demo choreography, objection handling |
| ⚖️ PS Evaluator | `@evaluator` | Hackathon judging criteria, feasibility scoring | Scoring rubrics, competitive analysis, feasibility matrices |
| 🧑‍🍳 Brand Chef | `@brand-chef` | Brand identity, naming, messaging, positioning | Brand names, taglines, voice & tone guides, positioning statements |

**Example workflow:**
```bash
@presenter "Prepare a 5-minute hackathon pitch for our AI CLI tool"
@evaluator "Score our project against typical hackathon judging criteria"
@brand-chef "Create 5 brand name options with taglines for our product"
```

---

## Phase 9: 📚 LEARN — Grow and solve

| Chef | Summon | When to Use | What You Get |
|------|--------|-------------|--------------|
| 📚 Teaching Assistant | `@teacher` | Learning new concepts, tutorials, explanations | ELI5 + deep-dive explanations, exercises, further reading |
| 🧩 Problem Solver | `@problemsolver` | Stuck on a hard problem, debugging, root cause analysis | 5 Whys analysis, TRIZ solutions, first-principles breakdown |
| 📈 Data Scientist | `@datascientist` | ML pipelines, data analysis, experiment design | CRISP-DM process, model selection, A/B test plans, dashboards |

**Example workflow:**
```bash
@teacher "Explain how LLM tokenization works — I'm intermediate level"
@problemsolver "Our app is slow under load. Help me find the root cause"
@datascientist "Design an A/B test to measure if our new UI increases conversions"
```

---

## 🏗️ SOUPZ Module Builders (Advanced)

These chefs are for building the Soupz Stall system itself or similar agent architectures:

| Chef | Summon | When to Use |
|------|--------|-------------|
| 🔧 Agent Builder | `@agent-builder` | Creating new chef personas with proper SOUPZ structure |
| 📦 Module Builder | `@module-builder` | Building cohesive Soupz modules (agents + workflows) |
| 🔄 Workflow Builder | `@workflow-builder` | Designing multi-step workflows for agent coordination |
| 🎯 Orchestrator | `@orchestrator` | Complex multi-agent task coordination |

---

## 🔑 Quick Reference — One-Line Summaries

```
@researcher    — "What tools/APIs exist for X?"
@analyst       — "Turn this idea into requirements"
@domain-scout  — "Map the competitive landscape for X"
@review-miner  — "What do users hate about existing X solutions?"
@strategist    — "Is this business viable? What's the GTM?"
@innovator     — "Where's the Blue Ocean opportunity?"
@pm            — "Write a PRD for X with RICE prioritization"
@brainstorm    — "Generate 20 creative ideas for X"
@master        — "Here's everything — give me a full plan"
@architect     — "Design the system architecture for X"
@planner       — "Break this into sprint tasks with parallel lanes"
@scrum         — "Write user stories with acceptance criteria"
@design-thinking-coach — "Run a design thinking session for X"
@ux-designer   — "Create user flows and wireframes for X"
@designer      — "Full brand + visual design for X"
@ui-builder    — "Build the HTML prototype for X"
@dev           — "Implement story X with TDD"
@quick-flow    — "Build X fast with minimum ceremony"
@svgart        — "Create SVG icon/logo for X"
@forager       — "Find stock images for X"
@qa            — "Write test plan for X"
@tester        — "Design test automation framework"
@tea           — "Risk-based test strategy for X"
@security      — "STRIDE threat model for X"
@devops        — "Dockerfile + CI/CD for X"
@techwriter    — "Write README/docs for X"
@contentwriter — "Write blog post / marketing copy for X"
@storyteller   — "Create brand narrative for X"
@presenter     — "Prepare hackathon pitch for X"
@evaluator     — "Score X against judging criteria"
@brand-chef    — "Create brand identity for X"
@teacher       — "Explain X at my level"
@problemsolver — "Debug / root cause analysis for X"
@datascientist — "ML pipeline / A/B test design for X"
@agent-builder — "Create a new chef persona"
@module-builder — "Build a Soupz module"
@workflow-builder — "Design agent workflow"
@orchestrator  — "Coordinate multi-agent task"
```

---

*38 chefs. 9 phases. One stall. 🫕*
