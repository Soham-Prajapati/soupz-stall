# Soupz-Agents — Documentation

## What Is This?

Soupz-Agents is your personal Jarvis — a CLI tool that orchestrates multiple AI agents from one place. Instead of switching between Gemini, Copilot, and other CLIs, just type `soupz-agents` and talk.

It has **22 built-in personas** (business strategist, architect, QA engineer, presentation coach, etc.) that transform how the AI responds. It learns from your usage, grades agents, and gets smarter over time.

---

## Quick Start

```bash
soupz-agents              # Start interactive session
soupz-agents --yolo        # YOLO mode (agents auto-approve everything)
soupz-agents agents        # List all agents
soupz-agents --help        # Full CLI usage
```

---

## Interactive Commands

| Command | What It Does |
|---------|-------------|
| `/help` | Show all commands |
| `/agents` | List every agent and persona with descriptions |
| `/agent gemini` | Lock all prompts to Gemini |
| `/agent auto` | Back to auto-routing (AI picks the best agent) |
| `/model` | Show which agent is active + current mode |
| `/yolo` | Toggle YOLO mode (dangerous permissions, no confirmations) |
| `/grades` | Show agent report cards (A+ to F) |
| `/memory` | Show learned patterns and routing stats |
| `/compress` | Compress context to save tokens |
| `/quit` | Exit |

---

## @Personas — Your Expert Team

Type `@persona <prompt>` to activate a persona. Each one transforms the underlying AI into a specialist:

### 💼 Business & Strategy
| Persona | Activate | What They Do |
|---------|---------|-------------|
| Strategist | `@strategist` | Evaluates ideas from investor, entrepreneur, critic perspectives |
| Analyst | `@analyst` | Requirements gathering, market sizing, user stories |
| PM | `@pm` | PRDs, roadmaps, prioritization, metrics definition |
| Innovator | `@innovator` | Blue ocean strategy, disruption, business models |

### 🏗️ Technical
| Persona | Activate | What They Do |
|---------|---------|-------------|
| Architect | `@architect` | System design for 50-person teams, tech stack, parallel work |
| Planner | `@planner` | Sprint planning, task breakdown, anti-collision file ownership |
| DevOps | `@devops` | Docker, CI/CD, Terraform, cloud infra, monitoring |
| Security | `@security` | Threat modeling, OWASP, pen testing, compliance |
| Tester | `@tester` | Test strategy, automation, quality gates |
| Data Scientist | `@datascientist` | ML pipelines, analytics, A/B testing |

### 🎨 Design & UX
| Persona | Activate | What They Do |
|---------|---------|-------------|
| Designer | `@designer` | User flows, wireframes, micro-interactions, accessibility |

### 📝 Content & Communication
| Persona | Activate | What They Do |
|---------|---------|-------------|
| Presenter | `@presenter` | Hackathon pitches, judge perspective, demo scripts, Q&A prep |
| Storyteller | `@storyteller` | Narratives, pitches, elevator pitches, brand voice |
| Content Writer | `@contentwriter` | Slides, marketing copy, blogs, social media |
| Tech Writer | `@techwriter` | READMEs, API docs, tutorials, changelogs |

### 📚 Learning & Analysis
| Persona | Activate | What They Do |
|---------|---------|-------------|
| Teacher | `@teacher` | Explains anything with ELI5 + deep dive + exercises |
| Researcher | `@researcher` | Finds APIs, SDKs, tools with comparison tables |
| Evaluator | `@evaluator` | Hackathon PS scoring, feasibility analysis, idea ranking |

### 🎯 Process
| Persona | Activate | What They Do |
|---------|---------|-------------|
| QA | `@qa` | Test plans, edge cases, bug reports |
| Scrum | `@scrum` | Sprint planning, standups, retros, velocity |
| Brainstorm | `@brainstorm` | SCAMPER, Six Hats, ideation, mind mapping |
| Problem Solver | `@problemsolver` | 5 Whys, root cause analysis, first principles |

---

## Hackathon Workflow

A complete zero-to-winning flow:

```
1. @evaluator compare these 3 problem statements: [paste PS]
2. @strategist evaluate the winning idea from investor perspective
3. @architect plan the system architecture and team structure
4. @planner create sprint plan for 4 people, 2 days
5. @designer plan the user flow and key screens
6. @researcher find the APIs and SDKs we need
7. [BUILD THE PROJECT]
8. @presenter create the pitch deck outline with judge Q&A prep
9. @contentwriter write the slide content
10. @qa create acceptance criteria and test plan
```

---

## YOLO Mode

Agents run with maximum permissions — no confirmation prompts:

| Agent | YOLO Flag |
|-------|-----------|
| Gemini | `--yolo` |
| Copilot | `--allow-all-tools` |

Toggle: `/yolo` in interactive mode or `soupz-agents --yolo`.

---

## Adding Custom Agents

Drop a `.md` file in `~/.soupz-agents/agents/`:

```yaml
---
name: My Custom Agent
id: mycustom
icon: "🤖"
color: "#FF0000"
type: persona
uses_tool: gemini
headless: false
description: "What it does in one line"
system_prompt: |
  You are... [describe the persona fully]
grade: 50
usage_count: 0
---
```

Restart soupz-agents and it's available as `@mycustom`.

---

## Adding New Tool Agents

To add a new CLI tool (like Claude Code, Ollama, etc.):

```yaml
---
name: My Tool
id: mytool
icon: "🤖"
binary: mytool-cli
headless: true
description: "What it does"
output_format: text
build_args: ["-p", "{prompt}"]
auth_command: "mytool auth"
grade: 50
---
```

---

## How Routing Works

In AUTO mode, soupz-agents scores each agent:
- **Keyword matching**: "fix bug" → coding agent, "explain" → research agent
- **Capability matching**: agent's capabilities vs prompt type
- **Grades**: agents with higher success rates get priority
- **Memory**: if you always use X for Y tasks, it learns that

Score formula: `base_grade + keyword_matches * 20 + capability_bonus * 15`
