# 🤖 Subagent Examples - Real Outputs

Complete examples showing how personas spawn subagents, ask for input, and collaborate.

---

## Example 1: Brainstorm with Evaluator

### Input
```bash
$ soupz-stall
> @brainstorm generate 10 ideas for a productivity app
```

### Output
```
  💡 Brainstorming Coach via copilot

  💭 Thinking: I'll generate creative ideas, then spawn @evaluator to score them on feasibility and impact.

  Invoking 2 subagents in parallel (using tool: subagent)

    ✓ copilot: Generate 20 creative productivity ideas
    ↳ done (0 tool uses · 18.42s)

    ✓ copilot: Evaluate ideas on feasibility (1-10) and impact (1-10)
    ↳ done (0 tool uses · 15.73s)

  - Completed in 34.15s

  📊 Top 10 Productivity App Ideas (Scored):

  1. **AI Task Prioritizer** (Feasibility: 9, Impact: 9)
     - Uses ML to auto-prioritize tasks based on deadlines, importance
     - Learns from your behavior patterns

  2. **Focus Mode with Gamification** (Feasibility: 8, Impact: 8)
     - Pomodoro timer with RPG-style rewards
     - Level up by completing focus sessions

  3. **Voice-to-Task Converter** (Feasibility: 7, Impact: 9)
     - Speak your tasks, AI converts to structured todo items
     - Integrates with calendar

  4. **Collaborative Task Board** (Feasibility: 9, Impact: 7)
     - Real-time team task management
     - Slack/Discord integration

  5. **Habit Tracker with AI Insights** (Feasibility: 8, Impact: 8)
     - Track habits, get AI-powered suggestions
     - Identifies patterns and blockers

  6. **Time Blocking Assistant** (Feasibility: 9, Impact: 7)
     - Auto-schedules tasks in your calendar
     - Respects your energy levels

  7. **Distraction Blocker** (Feasibility: 8, Impact: 6)
     - Blocks distracting websites during focus time
     - Gentle reminders to stay on track

  8. **Goal Decomposer** (Feasibility: 7, Impact: 8)
     - Breaks big goals into actionable steps
     - Tracks progress visually

  9. **Meeting Summarizer** (Feasibility: 6, Impact: 9)
     - AI summarizes meetings into action items
     - Auto-creates tasks

  10. **Energy Level Tracker** (Feasibility: 7, Impact: 7)
      - Tracks when you're most productive
      - Suggests optimal work times

  ✅ Analysis complete!

  What would you like to do next?
    1. Continue with detailed planning for top idea (@planner)
    2. Design UI/UX for top 3 ideas (@designer)
    3. Create architecture for #1 idea (@architect)
    4. Analyze market competition (@strategist)

  Your choice: _
```

---

## Example 2: Architect with Parallel Design

### Input
```bash
> @architect design a todo app with real-time sync
```

### Output
```
  🏗️ Tech Architect via copilot

  💭 Thinking: I'll design the system architecture and spawn @designer for UI/UX in parallel to save time.

  Invoking 2 subagents in parallel (using tool: subagent)

    ✓ copilot: Design system architecture with real-time sync
    ↳ done (0 tool uses · 24.18s)

    ✓ copilot: Create UI/UX flows and wireframes
    ↳ done (0 tool uses · 19.52s)

  - Completed in 43.70s

  ## 🏗️ System Architecture

  ### Tech Stack
  - **Frontend**: React + Vite + Tailwind CSS
  - **Backend**: Node.js + Express + Socket.io
  - **Database**: PostgreSQL (primary) + Redis (cache)
  - **Real-time**: WebSocket (Socket.io)
  - **Hosting**: AWS Lambda + RDS + ElastiCache

  ### Architecture Diagram
  ```
  [Client Apps]
       ↓
  [CloudFront CDN]
       ↓
  [API Gateway]
       ↓
  [Load Balancer]
       ↓
  ┌─────────────────────────┐
  │   App Servers (ECS)     │
  │   - REST API            │
  │   - WebSocket Server    │
  └─────────────────────────┘
       ↓           ↓
  [Redis Cache]  [PostgreSQL]
  ```

  ### Database Schema
  ```sql
  CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE,
    name VARCHAR(255),
    created_at TIMESTAMP
  );

  CREATE TABLE todos (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    title VARCHAR(500),
    completed BOOLEAN DEFAULT false,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
  );

  CREATE INDEX idx_todos_user ON todos(user_id);
  ```

  ### Real-time Sync Strategy
  - WebSocket connection per client
  - Broadcast changes to all connected clients
  - Conflict resolution: Last-write-wins
  - Offline support: Queue changes, sync on reconnect

  ## 🎨 UI/UX Design (from @designer)

  ### User Flow
  1. Login → 2. Dashboard → 3. Add Task → 4. Mark Complete → 5. Real-time Sync

  ### Wireframes
  ```
  ┌─────────────────────────────────┐
  │ [Logo]              [User Menu] │
  ├─────────────────────────────────┤
  │                                 │
  │  My Tasks                       │
  │  ┌───────────────────────────┐  │
  │  │ ☐ Buy groceries           │  │
  │  │ ☑ Finish report           │  │
  │  │ ☐ Call dentist            │  │
  │  └───────────────────────────┘  │
  │                                 │
  │  [+ Add Task]                   │
  │                                 │
  └─────────────────────────────────┘
  ```

  ### Design System
  - **Colors**: #6C63FF (primary), #4ECDC4 (secondary)
  - **Typography**: Inter, 16px base
  - **Spacing**: 8px grid

  ✅ Architecture and design complete!

  Should I spawn @devops for deployment setup?
    1. Yes, spawn @devops for AWS infrastructure
    2. No, I'll handle deployment
    3. Spawn @planner for sprint breakdown
    4. Spawn @qa for test strategy

  Your choice: _
```

---

## Example 3: Master Orchestrating Full Project

### Input
```bash
> @master
> Problem Statement: Build content intelligence platform for AI for Bharat hackathon
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
> - AI-powered generation (60 seconds)
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

### Output
```
  👑 Team Lead via copilot

  💭 Thinking: Complex hackathon project with 4-person team and tight deadline. 
  I'll spawn 5 personas in Batch 1 for comprehensive planning.

  ═══════════════════════════════════════════════════════════════
  BATCH 1: Strategic Planning & Design
  ═══════════════════════════════════════════════════════════════

  Invoking 5 subagents in parallel (using tool: subagent)

    ✓ copilot: Design system architecture with AWS Lambda + Ollama
    ↳ done (0 tool uses · 28.34s)

    ✓ copilot: Create UI/UX flows and design system
    ↳ done (0 tool uses · 22.17s)

    ✓ copilot: Break down 6-day sprint with parallel work streams
    ↳ done (0 tool uses · 25.89s)

    ✓ copilot: Research best AI tools and cost optimization
    ↳ done (0 tool uses · 19.42s)

    ✓ copilot: Identify winning angle for hackathon judges
    ↳ done (0 tool uses · 21.56s)

  - Batch 1 completed in 117.38s

  ═══════════════════════════════════════════════════════════════
  BATCH 2: Implementation Planning
  ═══════════════════════════════════════════════════════════════

  Invoking 5 subagents in parallel (using tool: subagent)

    ✓ copilot: AWS infrastructure setup with LocalStack for dev
    ↳ done (0 tool uses · 18.73s)

    ✓ copilot: Test strategy with edge cases
    ↳ done (0 tool uses · 16.24s)

    ✓ copilot: Security checklist and threat modeling
    ↳ done (0 tool uses · 15.91s)

    ✓ copilot: Feature prioritization using RICE framework
    ↳ done (0 tool uses · 17.38s)

    ✓ copilot: Pitch deck outline and demo script
    ↳ done (0 tool uses · 19.12s)

  - Batch 2 completed in 87.38s

  ═══════════════════════════════════════════════════════════════
  INTEGRATION & MASTER PLAN
  ═══════════════════════════════════════════════════════════════

  💭 Integrating outputs from 10 personas...

  # 👑 MASTER PLAN: Content Intelligence Platform

  ## 📊 Executive Summary
  6-day sprint to build AI-powered content platform for hackathon.
  Team of 4 working in parallel streams.
  Key decision: Use Ollama (FREE) for dev, AWS only for final testing.
  Expected cost: $20-40 (well under $80 budget).

  ## 🏗️ Architecture (from @architect)
  ### System Design
  - Microservices: Content Processor, AI Engine, API Gateway
  - AWS Lambda for serverless compute
  - S3 for storage, CloudWatch for monitoring
  - Ollama for local AI (Llama 3.1 8B - FREE)

  ### API Endpoints
  - POST /api/content/upload
  - POST /api/content/analyze
  - POST /api/content/generate
  - GET  /api/content/:id

  ## 🎨 Design (from @designer)
  ### User Flow
  Upload → Select Domain → Generate → Review → Approve

  ### Design System
  - Colors: #6C63FF (primary), #4ECDC4 (secondary)
  - Typography: Inter, 16px base
  - Components: Upload card, Generation preview, Approval modal

  ## 📋 Sprint Plan (from @planner)
  ### Day 1 (Feb 26): Foundation
  - Shubh: LocalStack setup, API structure
  - Nidhi: Ollama setup, test Llama 3.1
  - Srushti: React + Vite setup, design system
  - Lakshmi: Testing framework, CI/CD

  ### Day 2 (Feb 27): Integration
  - Shubh: Content processor API
  - Nidhi: AI generation pipeline
  - Srushti: Upload UI + domain selection
  - Lakshmi: Integration tests

  ### Day 3-6: [Full breakdown provided]

  ## 🔬 Research (from @researcher)
  ### Recommended Tools
  - Ollama: FREE local AI (Llama 3.1 8B)
  - Supabase: FREE database (500MB)
  - LocalStack: FREE AWS emulation
  - Vite: Fast React builds

  ### Cost Analysis
  - Dev (Days 1-4): $0 (all free tools)
  - Testing (Day 5): $10-20
  - Demo (Day 6): $10-20
  - Total: $20-40 ✅

  ## 💼 Strategy (from @strategist)
  ### Winning Angle
  "AI-powered content generation in 60 seconds - 10x faster than competitors"

  ### Judge Appeal
  - Solves real problem (80% time saved)
  - Production-ready architecture
  - Under budget (smart optimization)

  ## ⚙️ DevOps (from @devops)
  ### Infrastructure
  ```yaml
  dev: LocalStack (local, FREE)
  staging: AWS (Day 5, $10-15)
  prod: AWS (Day 6, $10-15)
  ```

  ## 🧪 QA (from @qa)
  ### Test Strategy
  - Unit: Jest
  - Integration: Supertest
  - E2E: Playwright
  - Load: k6 (Day 5)

  ### Edge Cases
  - Large files (>100MB)
  - Unsupported formats
  - API rate limits
  - Network failures

  ## 🔒 Security (from @security)
  ### Checklist
  - [x] Input validation
  - [x] File type verification
  - [x] Rate limiting
  - [x] API authentication

  ## 🎯 Product (from @pm)
  ### Feature Prioritization (RICE)
  1. Content upload (Score: 150)
  2. AI generation (Score: 48)
  3. Multi-language (Score: 20)

  ### MVP Scope
  - Must-have: Upload, generate, approve
  - Nice-to-have: Multi-language
  - Won't-have: User accounts

  ## 🎤 Presentation (from @presenter)
  ### Pitch Deck (10 slides)
  1. Hook: "80% time wasted on content repurposing"
  2. Problem: Manual, slow, expensive
  3. Solution: AI generates 8+ formats in 60s
  4. Demo: Live generation
  5. Tech: Scalable architecture
  6. Team: 4 experts
  7. Timeline: 6-day sprint
  8. Budget: $20-40 (under $80)
  9. Impact: 10x faster
  10. Ask: WIN! 🏆

  ## 👥 Team Assignments

  ### Shubh (Backend + AWS)
  - Day 1: LocalStack, API structure
  - Day 2: Content processor
  - Day 3: AI integration
  - Day 4: Lambda deployment
  - Day 5: AWS testing
  - Day 6: Final polish

  ### Nidhi (AI Intelligence)
  - Day 1: Ollama setup
  - Day 2: Generation pipeline
  - Day 3: Domain intelligence
  - Day 4: Multi-language
  - Day 5: Optimization
  - Day 6: Demo prep

  ### Srushti (Frontend + UX)
  - Day 1: React setup
  - Day 2: Upload UI
  - Day 3: Generation UI
  - Day 4: Approval workflow
  - Day 5: Polish
  - Day 6: Demo prep

  ### Lakshmi (Testing + DevOps)
  - Day 1: Testing framework
  - Day 2: Integration tests
  - Day 3: E2E tests
  - Day 4: Load testing
  - Day 5: AWS testing
  - Day 6: Final QA

  ## 📅 Timeline
  Day 1: Foundation ✅
  Day 2: Integration (TODAY)
  Day 3: Features
  Day 4: Polish
  Day 5: AWS Testing
  Day 6: Demo Prep

  ## 💰 Budget Breakdown
  - Development: $0
  - Testing: $10-20
  - Demo: $10-20
  - Total: $20-40 ✅
  - Savings: $40-60 🎉

  ## ⚠️ Risks & Mitigation
  1. AWS costs exceed budget → Use LocalStack for dev
  2. Ollama too slow → Optimize prompts, use Phi-3
  3. Integration issues → Daily integration tests
  4. Demo fails → Practice 10+ times

  ## ✅ Next Steps (Immediate)
  1. Shubh: Setup LocalStack (30 min)
  2. Nidhi: Install Ollama + test Llama 3.1 (30 min)
  3. Srushti: Create React app with Vite (30 min)
  4. Lakshmi: Setup GitHub repo + CI/CD (30 min)

  ═══════════════════════════════════════════════════════════════
  MASTER PLAN COMPLETE
  ═══════════════════════════════════════════════════════════════

  Total time: 204.76s (3m 24s)
  Personas used: 10
  Cost: $0.00

  Status: READY TO START! 🚀
  Confidence: HIGH (85%)
  Expected Outcome: WIN! 🏆

  What would you like to do next?
    1. Start implementation (all team members begin Day 2 tasks)
    2. Review and adjust plan
    3. Spawn @techwriter for documentation structure
    4. Export plan to Markdown file

  Your choice: _
```

---

## Example 4: Designer with Interactive Choices

### Input
```bash
> @designer create UI for a dashboard
```

### Output
```
  🎨 UX Master via copilot

  💭 Thinking: I'll create wireframes and design system, then ask what level of detail you need.

  ## 🎨 Dashboard UI Design

  ### User Flow
  Login → Dashboard → View Analytics → Drill Down → Export

  ### Wireframes (High-Level)
  ```
  ┌─────────────────────────────────────────────────────┐
  │ [Logo]  Dashboard  Reports  Settings  [User Menu]  │
  ├─────────────────────────────────────────────────────┤
  │                                                     │
  │  📊 Overview                                        │
  │  ┌──────────┐ ┌──────────┐ ┌──────────┐           │
  │  │ Users    │ │ Revenue  │ │ Growth   │           │
  │  │ 12,543   │ │ $45.2K   │ │ +23%     │           │
  │  └──────────┘ └──────────┘ └──────────┘           │
  │                                                     │
  │  📈 Analytics Chart                                 │
  │  ┌─────────────────────────────────────────────┐   │
  │  │ [Line chart showing growth over time]       │   │
  │  └─────────────────────────────────────────────┘   │
  │                                                     │
  │  📋 Recent Activity                                 │
  │  • User signed up (2 min ago)                      │
  │  • Payment received (5 min ago)                    │
  │  • Report generated (10 min ago)                   │
  │                                                     │
  └─────────────────────────────────────────────────────┘
  ```

  ### Design System
  - **Colors**: 
    - Primary: #6C63FF
    - Secondary: #4ECDC4
    - Success: #6BCB77
    - Background: #F8F9FA
  - **Typography**: 
    - Headings: Inter Bold, 24px/32px/40px
    - Body: Inter Regular, 16px
  - **Spacing**: 8px grid (8, 16, 24, 32, 40)

  ✅ Initial design complete!

  What level of detail would you like?
    1. Continue with detailed mockups (high-fidelity)
    2. Create component library (buttons, cards, inputs)
    3. Hand off to @developer for implementation
    4. Spawn @qa for usability testing
    5. Export design system to Figma format

  Your choice: _
```

---

## Example 5: Planner with Dynamic Handoff

### Input
```bash
> @planner create a 3-day sprint plan for building a todo app
```

### Output
```
  📋 Project Planner via copilot

  💭 Thinking: I'll create the sprint plan, then hand off to @architect for technical design.

  ## 📋 3-Day Sprint Plan: Todo App

  ### Team Structure
  - 1 Full-stack developer
  - Working solo, 8 hours/day

  ### Day 1: Foundation (8 hours)
  **Morning (4h)**
  - [ ] Setup: React + Vite + Tailwind (1h)
  - [ ] Design: Wireframes + color scheme (1h)
  - [ ] Backend: Node.js + Express setup (1h)
  - [ ] Database: PostgreSQL schema (1h)

  **Afternoon (4h)**
  - [ ] API: CRUD endpoints (2h)
  - [ ] Frontend: Basic UI components (2h)

  **Deliverable**: Working skeleton

  ### Day 2: Features (8 hours)
  **Morning (4h)**
  - [ ] Add task functionality (1h)
  - [ ] Delete task functionality (1h)
  - [ ] Mark complete functionality (1h)
  - [ ] localStorage integration (1h)

  **Afternoon (4h)**
  - [ ] Styling with Tailwind (2h)
  - [ ] Responsive design (1h)
  - [ ] Error handling (1h)

  **Deliverable**: Functional todo app

  ### Day 3: Polish (8 hours)
  **Morning (4h)**
  - [ ] Testing: Unit + integration (2h)
  - [ ] Bug fixes (1h)
  - [ ] Performance optimization (1h)

  **Afternoon (4h)**
  - [ ] Documentation (1h)
  - [ ] Deployment setup (2h)
  - [ ] Final testing (1h)

  **Deliverable**: Production-ready app

  ### Dependencies
  ```
  Day 1 → Day 2 → Day 3 (sequential)
  ```

  ### Risks
  - Database setup might take longer (buffer: 30 min)
  - Styling could be time-consuming (use template)

  ✅ Sprint plan complete!

  💭 Thinking: This plan needs technical architecture. Handing off to @architect...

  Handing off to @architect for system design...

  [Spawning @architect subagent]

    ✓ copilot: Design technical architecture for todo app
    ↳ done (0 tool uses · 16.82s)

  ## 🏗️ Technical Architecture (from @architect)

  ### Tech Stack
  - Frontend: React 18 + Vite + Tailwind CSS
  - Backend: Node.js + Express
  - Database: PostgreSQL
  - Hosting: Vercel (frontend) + Railway (backend)

  ### API Design
  - GET    /api/todos
  - POST   /api/todos
  - PATCH  /api/todos/:id
  - DELETE /api/todos/:id

  ### Database Schema
  ```sql
  CREATE TABLE todos (
    id SERIAL PRIMARY KEY,
    title VARCHAR(500),
    completed BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
  );
  ```

  ✅ Complete plan with architecture ready!

  What would you like to do next?
    1. Start Day 1 tasks
    2. Spawn @designer for detailed UI mockups
    3. Spawn @devops for deployment setup
    4. Export plan to project management tool

  Your choice: _
```

---

## Key Patterns

### 1. Parallel Spawning
```
Invoking N subagents in parallel:
  ✓ @persona1: Task description
  ↳ done (time)
  
  ✓ @persona2: Task description
  ↳ done (time)

- Completed in total_time
```

### 2. Interactive Choices
```
What would you like to do next?
  1. Option A
  2. Option B
  3. Option C

Your choice: _
```

### 3. Dynamic Handoff
```
Handing off to @persona for [specific task]...

[Spawning @persona subagent]
  ✓ @persona: Task
  ↳ done (time)
```

---

## Cost Summary

All examples: **$0.00** (FREE models)

---

**Last Updated**: February 27, 2026
