# 🎯 Soupz-Stall User Guide

## Complete Guide to Using Soupz-Stall with 24 Personas

---

## 🚀 Quick Start

```bash
# Start soupz-stall
soupz-stall

# Use Master for complex projects (NEW!)
> @master [paste your 50-line problem statement]

# Use specific persona
> @architect design an API

# Check costs
> /costs

# List all personas
> /personas
```

---

## 👑 NEW: Master Persona (Team Lead)

**The game-changer for complex projects!**

### What Master Does
- Takes your **long prompts** (50-60 lines with PS, team, deadline, everything)
- **Spawns 5 personas in parallel** (like Kiro's subagents)
- Runs **multiple batches** (Batch 1 → wait → Batch 2 → wait → Batch 3)
- **Coordinates outputs** from all personas
- Delivers **comprehensive master plan**

### Example Usage
```bash
> @master
> Problem Statement: Build content intelligence platform
> 
> Team:
> - Shubh (Backend + AWS)
> - Nidhi (AI Intelligence)  
> - Srushti (Frontend + UX)
> - Lakshmi (Testing + DevOps)
>
> Deadline: March 4, 2026 (6 days)
> Budget: $80 AWS credits
>
> Requirements:
> - Multi-format processing (video, text, image)
> - AI-powered generation
> - Real-time (60 seconds)
> - Multi-language support
> - Stay under $80
>
> Tech Stack: Node.js, React, AWS Lambda, Ollama
>
> Deliverables:
> - Working prototype
> - Demo video
> - Documentation
> - GitHub repo
```

### What Master Returns
```
👑 MASTER PLAN: Content Intelligence Platform

📊 Executive Summary
[Overview, key decisions, timeline]

🏗️ Architecture (from @architect)
[System design, AWS setup, APIs]

🎨 Design (from @designer)
[UI/UX flows, wireframes]

📋 Sprint Plan (from @planner)
[6-day breakdown, parallel tasks]

🔬 Research (from @researcher)
[Best tools, APIs, libraries]

💼 Strategy (from @strategist)
[Winning angle for judges]

⚙️ DevOps (from @devops)
[AWS setup, CI/CD, deployment]

🧪 QA (from @qa)
[Test strategy, edge cases]

🔒 Security (from @security)
[Security checklist]

🎯 Product (from @pm)
[Feature prioritization]

🎤 Presentation (from @presenter)
[Pitch deck outline]

👥 Team Assignments
- Shubh: [Specific tasks]
- Nidhi: [Specific tasks]
- Srushti: [Specific tasks]
- Lakshmi: [Specific tasks]

📅 Timeline
Day 1-6: [Detailed milestones]

💰 Budget: $80 breakdown

⚠️ Risks & Mitigation

✅ Next Steps
```

### How Master Spawns Personas

**Batch 1** (5 personas in parallel):
```
🏗️  @architect → System architecture
🎨  @designer → UI/UX design
📋  @planner → Sprint planning
🔬  @researcher → Technical research
💼  @strategist → Business strategy
```

**Batch 2** (5 personas in parallel):
```
⚙️  @devops → Infrastructure
🧪  @qa → Test strategy
🔒  @security → Security audit
🎯  @pm → Product roadmap
🎤  @presenter → Pitch deck
```

**Batch 3** (as needed):
```
📝  @techwriter → Documentation
📈  @datascientist → Analytics
...more as needed
```

### When to Use Master

✅ **Use Master when**:
- Long requirements (50+ lines)
- Multiple team members
- Tight deadlines
- Need comprehensive planning
- Want all expert perspectives

❌ **Don't use Master for**:
- Simple questions
- Quick fixes
- Single-task requests

---

## 📋 All 24 Personas & Example Prompts

### 1. 🏗️ Tech Architect
**Best for**: System design, APIs, databases, scalability

**Example prompts**:
```
@architect design a REST API for a todo app with CRUD operations
@architect plan the database schema for a social media platform
@architect design a microservices architecture for e-commerce
@architect recommend tech stack for a real-time chat app
```

---

### 2. 🎨 UX Master (Designer)
**Best for**: User flows, wireframes, design systems, UI/UX

**Example prompts**:
```
@designer create a color scheme for a modern todo app
@designer design the user flow for onboarding
@designer create a design system with typography and spacing
@designer wireframe a dashboard for analytics
```

---

### 3. 📋 Project Planner
**Best for**: Sprint planning, task breakdown, timelines

**Example prompts**:
```
@planner create a 3-day sprint plan for building a todo app
@planner break down this feature into parallel work streams
@planner create a timeline for launching an MVP in 2 weeks
@planner plan tasks for a 4-person team
```

---

### 4. 📊 Business Analyst
**Best for**: Requirements, user stories, market analysis

**Example prompts**:
```
@analyst write user stories for a todo app
@analyst analyze the market for productivity apps
@analyst create requirements for a payment system
@analyst identify gaps in these requirements
```

---

### 5. 💡 Brainstorming Coach
**Best for**: Ideation, creative thinking, problem solving

**Example prompts**:
```
@brainstorm generate 20 ideas for a productivity app
@brainstorm use SCAMPER to improve this feature
@brainstorm create a mind map for this project
@brainstorm find creative solutions to this problem
```

---

### 6. ✍️ Content Writer
**Best for**: Blogs, social media, marketing copy

**Example prompts**:
```
@contentwriter write a blog post about productivity
@contentwriter create social media posts for product launch
@contentwriter write email copy for newsletter
@contentwriter create landing page copy
```

---

### 7. 📈 Data Scientist
**Best for**: ML pipelines, analytics, A/B testing

**Example prompts**:
```
@datascientist design an ML pipeline for recommendations
@datascientist plan an A/B test for this feature
@datascientist recommend metrics for user engagement
@datascientist design a dashboard for analytics
```

---

### 8. ⚙️ DevOps Engineer
**Best for**: Docker, CI/CD, infrastructure, monitoring

**Example prompts**:
```
@devops create a Dockerfile for this Node.js app
@devops design a CI/CD pipeline with GitHub Actions
@devops set up monitoring with Prometheus
@devops plan infrastructure for 100k users
```

---

### 9. ⚖️ PS Evaluator
**Best for**: Problem statement analysis, feasibility scoring

**Example prompts**:
```
@evaluator analyze this hackathon problem statement
@evaluator score this idea on feasibility and impact
@evaluator compare these 3 project ideas
@evaluator identify risks in this approach
```

---

### 10. 🚀 Innovation Strategist
**Best for**: Blue ocean strategy, business models, disruption

**Example prompts**:
```
@innovator identify disruption opportunities in this market
@innovator design a blue ocean strategy for this product
@innovator create a business model canvas
@innovator find unserved needs in this domain
```

---

### 11. 🎯 Product Manager
**Best for**: PRDs, roadmaps, prioritization, metrics

**Example prompts**:
```
@pm write a PRD for a todo app
@pm create a product roadmap for Q1
@pm prioritize these features using RICE
@pm define success metrics for this feature
```

---

### 12. 🎤 Presentation Coach
**Best for**: Pitch decks, demo scripts, Q&A prep

**Example prompts**:
```
@presenter create a pitch deck outline for investors
@presenter write a 3-minute demo script
@presenter prepare Q&A for hackathon judges
@presenter create slide content for this presentation
```

---

### 13. 🧩 Problem Solver
**Best for**: Root cause analysis, 5 Whys, debugging

**Example prompts**:
```
@problemsolver use 5 Whys to find root cause of this bug
@problemsolver analyze why users are churning
@problemsolver solve this technical challenge
@problemsolver create a fishbone diagram for this issue
```

---

### 14. 🧪 QA Engineer
**Best for**: Test plans, edge cases, bug reports

**Example prompts**:
```
@qa create a test plan for this feature
@qa identify edge cases for user authentication
@qa write a bug report for this issue
@qa define quality gates for deployment
```

---

### 15. 🔬 Researcher
**Best for**: Finding APIs, SDKs, tools, trade-off analysis

**Example prompts**:
```
@researcher find the best payment API for my app
@researcher compare React vs Vue for this project
@researcher research authentication solutions
@researcher evaluate these 3 database options
```

---

### 16. 🏃 Scrum Master
**Best for**: Sprint planning, standups, retros, velocity

**Example prompts**:
```
@scrum plan a 2-week sprint for this team
@scrum create a standup format
@scrum run a retrospective for last sprint
@scrum calculate team velocity
```

---

### 17. 🔒 Security Auditor
**Best for**: Threat modeling, OWASP, pen testing, compliance

**Example prompts**:
```
@security conduct STRIDE threat modeling for this API
@security check for OWASP Top 10 vulnerabilities
@security plan a penetration test
@security review authentication design
```

---

### 18. 📖 Storyteller
**Best for**: Narratives, pitches, copywriting, brand voice

**Example prompts**:
```
@storyteller create a compelling origin story for this product
@storyteller write a 30-second elevator pitch
@storyteller craft a narrative for this presentation
@storyteller create taglines for this brand
```

---

### 19. 💼 Strategist
**Best for**: Business strategy, investment analysis, market sizing

**Example prompts**:
```
@strategist evaluate this startup idea as a VC would
@strategist analyze market size for this product
@strategist identify competitive advantages
@strategist create a go-to-market strategy
```

---

### 20. 📚 Teaching Assistant
**Best for**: Explanations, tutorials, learning paths

**Example prompts**:
```
@teacher explain React hooks like I'm 5
@teacher create a learning path for web development
@teacher teach me about microservices
@teacher explain this concept with analogies
```

---

### 21. 📝 Tech Writer
**Best for**: Documentation, READMEs, API guides, tutorials

**Example prompts**:
```
@techwriter write a README for this project
@techwriter create API documentation
@techwriter write a quick-start guide
@techwriter document this function
```

---

### 22. 🔍 Test Architect
**Best for**: Test strategy, automation, CI/CD quality gates

**Example prompts**:
```
@tester design a test strategy for this app
@tester recommend automation frameworks
@tester create CI/CD quality gates
@tester plan performance testing
```

---

### 23. 👑 Team Lead (Master) **⭐ NEW!**
**Best for**: Complex projects, long requirements, team coordination

**Example prompts**:
```
@master [paste 50-line problem statement with team, deadline, requirements]
@master Build hackathon project: [full details]
@master Plan product launch: [team, timeline, budget]
@master Coordinate 4-person team for 6-day sprint
```

**What it does**:
- Spawns 5 personas in parallel (Batch 1)
- Waits for completion
- Spawns next 5 personas (Batch 2)
- Integrates all outputs
- Delivers master plan with team assignments

---

### 24. 🎭 (Additional persona available)

---

## 💡 Pro Tips

### Combining Personas
```bash
# Use multiple personas in sequence
> @architect design the API
> @devops create deployment for it
> @qa create test plan for it
```

### Using with Specific Tools
```bash
# Force a specific tool
> /tool copilot
> @architect design an API
# Uses Copilot + Architect persona
```

### Cost Tracking
```bash
# Check costs anytime
> /costs

# Expected output:
# 💰 Cost Tracking
# Agent       Model           Cost
# ─────────────────────────────────
# copilot     GPT-5 mini      $0.00
# ─────────────────────────────────
# Total:                      $0.00
```

---

## 🎯 Common Workflows

### 1. Build a Full App
```bash
> @architect design a todo app architecture
> @designer create the UI design
> @planner create a 3-day sprint plan
> Build the app with Copilot (FREE)
> @qa create test plan
> @devops create deployment
```

### 2. Hackathon Prep
```bash
> @evaluator analyze this problem statement
> @brainstorm generate 20 solution ideas
> @architect design the system
> @presenter create pitch deck outline
```

### 3. Debug & Fix
```bash
> @problemsolver analyze why this feature is slow
> @qa identify edge cases causing bugs
> Fix with Copilot (FREE)
> @tester create regression tests
```

---

## 🔧 Commands Reference

| Command | Description |
|---------|-------------|
| `/help` | Show all commands |
| `/personas` | List all 23 personas |
| `/agents` | List tool agents (Copilot, Kiro, Gemini, Ollama) |
| `/tool <name>` | Switch tool agent |
| `/costs` | Show cost tracking |
| `/clear` | Clear context |
| `/quit` | Exit |

---

## 💰 Cost Optimization

**All personas use FREE models by default!**

- Copilot (GPT-5 mini): $0.00
- Kiro: Uses your existing tools
- Ollama: Completely free (local)

**Expected costs**: $0.00 for most tasks!

---

## 🎉 Success Stories

### Example 1: Built React App
```
Input: @architect design a todo app
Output: Complete architecture + API design
Cost: $0.00
Time: 2 minutes
```

### Example 2: Fixed Bug
```
Input: @problemsolver why is my app slow?
Output: Root cause analysis + solution
Cost: $0.00
Time: 1 minute
```

### Example 3: Created Pitch Deck
```
Input: @presenter create pitch for investors
Output: 10-slide outline with content
Cost: $0.00
Time: 3 minutes
```

---

## 📚 Best Practices

1. **Be specific**: "design a REST API" > "help with API"
2. **Use right persona**: Match task to expertise
3. **Chain personas**: Use multiple for complex tasks
4. **Check costs**: Use `/costs` to track spending
5. **Iterate**: Refine prompts based on output

---

## 🐛 Troubleshooting

### Persona not found
```bash
> /personas
# Check spelling and available personas
```

### Wrong tool selected
```bash
> /tool copilot
# Force specific tool
```

### High costs
```bash
> /costs
# Check which model is being used
# Copilot (GPT-5 mini) should be $0.00
```

---

## 🚀 Ready to Start!

```bash
soupz-stall
> @architect design a REST API for a todo app
```

**All 23 personas ready. All FREE. Let's build!** 🎉

---

**Last Updated**: February 27, 2026
**Version**: 3.0.0
**Personas**: 23 working
**Cost**: $0.00
