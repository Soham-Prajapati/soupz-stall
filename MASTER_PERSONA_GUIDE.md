# 👑 Master Persona - Quick Reference

## What is Master?

**Master** is a team lead persona that orchestrates multiple personas in parallel to handle complex projects.

---

## When to Use

✅ **Perfect for**:
- Hackathon projects with full requirements
- Long prompts (50-60 lines)
- Team coordination (multiple members)
- Tight deadlines
- Need comprehensive planning

❌ **Don't use for**:
- Simple questions
- Quick fixes
- Single-task requests

---

## How It Works

```
Your Long Prompt (50+ lines)
         ↓
    👑 Master
         ↓
   Batch 1 (5 personas in parallel)
   🏗️ architect  🎨 designer  📋 planner  🔬 researcher  💼 strategist
         ↓
   Wait for completion
         ↓
   Batch 2 (5 personas in parallel)
   ⚙️ devops  🧪 qa  🔒 security  🎯 pm  🎤 presenter
         ↓
   Wait for completion
         ↓
   Batch 3 (as needed)
   📝 techwriter  📈 datascientist  ...
         ↓
   Integration & Coordination
         ↓
   Comprehensive Master Plan
```

---

## Example Input

```bash
$ soupz-stall

> @master
> Problem Statement: Build content intelligence platform for AI for Bharat hackathon
> 
> Team:
> - Shubh (Backend + AWS)
> - Nidhi (AI Intelligence)
> - Srushti (Frontend + UX)
> - Lakshmi (Testing + DevOps)
>
> Deadline: March 4, 2026 (6 days left)
> Budget: $80 AWS credits (use wisely!)
>
> Requirements:
> - Multi-format content processing (video, text, image)
> - AI-powered content generation (8+ outputs in 60 seconds)
> - Domain intelligence (Education, Food, Travel, Product Reviews)
> - Multi-language support (Hindi, English, Tamil, etc.)
> - Smart thumbnails + SEO optimization
> - Human-in-the-loop approval workflow
> - Real-time generation
> - Cost: Stay under $80 (use Ollama for dev, AWS only for final testing)
>
> Tech Stack:
> - Backend: Node.js + Express
> - Frontend: React + Vite + Tailwind CSS
> - AI: Ollama (local - Llama 3.1, Mistral, Phi-3)
> - Cloud: AWS Lambda, S3, CloudWatch
> - Database: Supabase (free tier)
> - Testing: LocalStack (AWS emulation)
>
> Deliverables:
> - Working prototype (live demo)
> - Demo video (YouTube/Drive)
> - Documentation (README + architecture)
> - GitHub repository
> - Presentation deck
>
> Constraints:
> - No AWS usage during development (use free tools)
> - AWS only for final testing (Days 5-6)
> - Expected AWS cost: $20-40 (save $40-60 buffer)
> - Must be scalable (design for 10k+ users)
> - Must be production-ready
>
> Success Criteria:
> - All features working
> - Demo runs smoothly
> - Under budget
> - Judges impressed
> - WIN the hackathon! 🏆
```

---

## Example Output

```markdown
# 👑 MASTER PLAN: Content Intelligence Platform

## 📊 Executive Summary
6-day sprint to build AI-powered content platform. Team of 4 working in parallel.
Key decision: Use Ollama (free) for dev, AWS only for final testing.
Expected cost: $20-40 (well under $80 budget).

## 🏗️ Architecture (from @architect)
### System Design
- Microservices: Content Processor, AI Engine, API Gateway
- AWS Lambda for serverless compute
- S3 for storage, CloudWatch for monitoring
- Supabase for database (free tier)

### Tech Stack Justification
- Node.js: Fast, async, same language as frontend
- Ollama: FREE local AI (Llama 3.1 8B)
- AWS Lambda: Pay per use, scales automatically
- React + Vite: Fast dev, modern tooling

### API Design
POST /api/content/process
POST /api/content/generate
GET  /api/content/:id
...

## 🎨 Design (from @designer)
### User Flow
1. Upload content → 2. Select domain → 3. Generate → 4. Review → 5. Approve

### Design System
Colors: #6C63FF (primary), #4ECDC4 (secondary)
Typography: Inter, 16px base
Spacing: 8px grid

### Wireframes
[Text-based wireframes for key screens]

## 📋 Sprint Plan (from @planner)
### Day 1 (Feb 26): Foundation
- Shubh: AWS setup (LocalStack), API structure
- Nidhi: Ollama setup, test models
- Srushti: React setup, design system
- Lakshmi: Testing framework, CI/CD

### Day 2 (Feb 27): Integration
- Shubh: Content processor API
- Nidhi: AI generation pipeline
- Srushti: Upload UI + domain selection
- Lakshmi: Integration tests

### Day 3-6: [Detailed breakdown]

## 🔬 Research (from @researcher)
### Recommended Tools
- Ollama: FREE, local AI (Llama 3.1 8B - 4.5GB)
- Supabase: FREE tier (500MB database)
- LocalStack: FREE AWS emulation
- Vite: Fast React builds

### Cost Analysis
- Development: $0 (all free tools)
- Testing: $10-20 (AWS Days 5-6)
- Demo: $10-20 (AWS live demo)
- Total: $20-40 ✅

## 💼 Strategy (from @strategist)
### Winning Angle
"AI-powered content generation in 60 seconds - 10x faster than competitors"

### Competitive Advantage
- Multi-format support (video, text, image)
- Domain intelligence (not generic AI)
- Human-in-the-loop (quality control)

### Judge Appeal
- Solves real problem (80% time saved)
- Production-ready (scalable architecture)
- Under budget (smart cost optimization)

## ⚙️ DevOps (from @devops)
### Infrastructure
- LocalStack for dev (FREE)
- AWS Lambda + S3 for prod
- GitHub Actions for CI/CD

### Deployment
```yaml
dev: LocalStack (local)
staging: AWS (Day 5)
prod: AWS (Day 6)
```

## 🧪 QA (from @qa)
### Test Strategy
- Unit tests: Jest
- Integration tests: Supertest
- E2E tests: Playwright
- Load tests: k6 (Day 5)

### Edge Cases
- Large files (>100MB)
- Unsupported formats
- API rate limits
- Network failures

## 🔒 Security (from @security)
### Security Checklist
- [ ] Input validation
- [ ] File type verification
- [ ] Rate limiting
- [ ] API authentication
- [ ] HTTPS only

## 🎯 Product (from @pm)
### Feature Prioritization (RICE)
1. Content upload (Reach: 100, Impact: 3, Confidence: 100%, Effort: 2) = 150
2. AI generation (Reach: 100, Impact: 3, Confidence: 80%, Effort: 5) = 48
3. Multi-language (Reach: 50, Impact: 2, Confidence: 60%, Effort: 3) = 20

### MVP Scope
Must-have: Upload, generate, approve
Nice-to-have: Multi-language, thumbnails
Won't-have: User accounts, payment

## 🎤 Presentation (from @presenter)
### Pitch Deck Outline
1. Hook: "Content creators spend 80% time repurposing"
2. Problem: Manual work, slow, expensive
3. Solution: AI generates 8+ formats in 60 seconds
4. Demo: Live generation
5. Tech: Scalable architecture
6. Impact: 10x faster, $0 cost
7. Ask: WIN! 🏆

### Demo Script (3 minutes)
0:00-0:30: Problem statement
0:30-1:30: Live demo (upload → generate → show results)
1:30-2:30: Architecture + tech stack
2:30-3:00: Impact + next steps

## 👥 Team Assignments

### Shubh (Backend + AWS)
Day 1: LocalStack setup, API structure
Day 2: Content processor API
Day 3: AI integration
Day 4: AWS Lambda deployment
Day 5: Testing on AWS
Day 6: Final polish

### Nidhi (AI Intelligence)
Day 1: Ollama setup, model testing
Day 2: Generation pipeline
Day 3: Domain intelligence
Day 4: Multi-language support
Day 5: Optimization
Day 6: Demo prep

### Srushti (Frontend + UX)
Day 1: React setup, design system
Day 2: Upload UI
Day 3: Generation UI
Day 4: Approval workflow
Day 5: Polish
Day 6: Demo prep

### Lakshmi (Testing + DevOps)
Day 1: Testing framework, CI/CD
Day 2: Integration tests
Day 3: E2E tests
Day 4: Load testing
Day 5: AWS testing
Day 6: Final QA

## 📅 Timeline

### Day 1 (Feb 26): Foundation ✅
- Setup complete
- Tools installed
- Architecture defined

### Day 2 (Feb 27): Integration
- APIs working
- AI generating
- UI functional

### Day 3 (Feb 28): Features
- Multi-format support
- Domain intelligence
- Approval workflow

### Day 4 (Mar 1): Polish
- Bug fixes
- Performance optimization
- Documentation

### Day 5 (Mar 2): AWS Testing
- Deploy to AWS
- Load testing
- Cost verification

### Day 6 (Mar 3): Demo Prep
- Final polish
- Demo video
- Presentation deck

## 💰 Budget Breakdown

Development (Days 1-4): $0
- Ollama: FREE
- Supabase: FREE
- LocalStack: FREE

Testing (Day 5): $10-20
- AWS Lambda: $5-10
- S3: $2-5
- CloudWatch: $3-5

Demo (Day 6): $10-20
- Live demo: $10-15
- Buffer: $5

Total: $20-40 ✅
Savings: $40-60 🎉

## ⚠️ Risks & Mitigation

### Risk 1: AWS costs exceed budget
Mitigation: Use LocalStack for dev, AWS only Days 5-6

### Risk 2: Ollama too slow
Mitigation: Optimize prompts, use smaller models (Phi-3)

### Risk 3: Integration issues
Mitigation: Daily integration tests, clear API contracts

### Risk 4: Demo fails
Mitigation: Practice 10+ times, have backup video

## ✅ Next Steps

1. **Immediate** (Next 30 min):
   - Shubh: Setup LocalStack
   - Nidhi: Install Ollama + test Llama 3.1
   - Srushti: Create React app with Vite
   - Lakshmi: Setup GitHub repo + CI/CD

2. **Today** (Next 6 hours):
   - Complete Day 1 tasks
   - Daily standup at 6 PM
   - Commit all code

3. **Tomorrow** (Day 2):
   - Integration testing
   - First working demo
   - Adjust plan if needed

---

**Status**: READY TO START! 🚀
**Confidence**: HIGH (80%)
**Expected Outcome**: WIN! 🏆
```

---

## Configuration

**Batch size**: 5 personas (configurable to 4-6 based on system)
**Sequential**: Next batch starts when previous completes
**Total capacity**: Unlimited (runs in waves)

---

## Cost

**Master itself**: $0.00 (uses FREE Copilot)
**All spawned personas**: $0.00 (all use FREE models)
**Total**: $0.00 ✅

---

## Pro Tips

1. **Paste everything**: Don't summarize - paste your full 50-60 line prompt
2. **Include all details**: Team names, exact deadlines, budget numbers
3. **Be specific**: The more context, the better the plan
4. **Trust the process**: Master coordinates everything automatically
5. **Review outputs**: Check each persona's contribution
6. **Use for hackathons**: Perfect for time-constrained team projects

---

## Comparison

| Approach | Time | Quality | Cost |
|----------|------|---------|------|
| Manual planning | 4-6 hours | Medium | $0 |
| Single persona | 30 min | Good | $0 |
| **Master (5x5)** | **10 min** | **Excellent** | **$0** |

---

**Master = Your AI team lead. Dump everything, get everything back.** 👑
