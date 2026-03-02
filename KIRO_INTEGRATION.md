# Kiro Integration Guide for Soupz-Agents

## Overview

This guide shows how to use Soupz personas within Kiro CLI and how they work together.

---

## Quick Start

### 1. Import Personas to BMAD
```bash
cd /Users/shubh/Developer/soupz-agents
cp bmad-export/*.md ~/.bmad/custom/
```

### 2. Use in Kiro
```bash
kiro-cli chat
# Then type:
/bmad-agent-soupz-designer
```

---

## How It Works

### Architecture
```
Kiro CLI
  ↓
BMAD System
  ↓
Soupz Personas (as BMAD agents)
  ↓
Underlying AI (Gemini/Copilot/etc.)
```

### Workflow
1. **Kiro** provides the interface and tools
2. **BMAD** manages agent lifecycle
3. **Soupz Personas** provide specialized thinking frameworks
4. **AI** executes with persona context

---

## Available Personas in Kiro

All 22 Soupz personas are available as BMAD agents:

### Business & Strategy
- `/bmad-agent-soupz-strategist` - Business strategy
- `/bmad-agent-soupz-analyst` - Requirements analysis
- `/bmad-agent-soupz-pm` - Product management
- `/bmad-agent-soupz-innovator` - Innovation strategy

### Technical
- `/bmad-agent-soupz-architect` - System architecture
- `/bmad-agent-soupz-planner` - Sprint planning
- `/bmad-agent-soupz-devops` - Infrastructure
- `/bmad-agent-soupz-security` - Security auditing
- `/bmad-agent-soupz-tester` - Test strategy
- `/bmad-agent-soupz-datascientist` - ML/Data

### Design
- `/bmad-agent-soupz-designer` - UX/UI design

### Content
- `/bmad-agent-soupz-presenter` - Pitch decks
- `/bmad-agent-soupz-storyteller` - Narratives
- `/bmad-agent-soupz-contentwriter` - Marketing copy
- `/bmad-agent-soupz-techwriter` - Documentation

### Learning & Research
- `/bmad-agent-soupz-teacher` - Teaching/explaining
- `/bmad-agent-soupz-researcher` - Tool research
- `/bmad-agent-soupz-evaluator` - Idea evaluation

### Process
- `/bmad-agent-soupz-qa` - Quality assurance
- `/bmad-agent-soupz-scrum` - Scrum master
- `/bmad-agent-soupz-brainstorm` - Ideation
- `/bmad-agent-soupz-problemsolver` - Root cause analysis

---

## Example Workflows

### Hackathon Sprint in Kiro
```bash
kiro-cli chat

# Evaluate problem statement
/bmad-agent-soupz-evaluator
> Compare these 3 problem statements: [paste]

# Design system
/bmad-agent-soupz-architect
> Design a scalable architecture for [idea]

# Plan UX
/bmad-agent-soupz-designer
> Create user flow for [feature]

# Create pitch
/bmad-agent-soupz-presenter
> Create pitch deck outline
```

### Development Workflow
```bash
# Architecture
/bmad-agent-soupz-architect
> Design API for social network

# Implementation planning
/bmad-agent-soupz-planner
> Break this into tasks for 4 developers

# Code review
/bmad-agent-soupz-qa
> Review this code for edge cases

# Documentation
/bmad-agent-soupz-techwriter
> Write README for this API
```

---

## Benefits of Using Soupz in Kiro

### 1. Specialized Thinking
Each persona has frameworks and methodologies:
- Designer: Jobs-to-be-Done, Kano Model, Nielsen's Heuristics
- Architect: CAP theorem, SOLID, 12-Factor App
- PM: RICE, MoSCoW, OKRs

### 2. Consistent Deliverables
Each persona provides structured output:
- Designer: User flows, wireframes, design tokens
- Architect: Architecture diagrams, tech stack, API contracts
- PM: PRDs, roadmaps, success metrics

### 3. Context Awareness
Personas remember conversation context within Kiro session.

### 4. Tool Integration
Personas work with Kiro's tools:
- File operations
- Code analysis
- Web search
- AWS operations

---

## Advanced Usage

### Chaining Personas
```bash
# In Kiro, use subagents
/bmad-agent-soupz-architect
> Design system architecture

# Then in same session
/bmad-agent-soupz-designer
> Design UI for the architecture we just discussed
```

### Using with Kiro Tools
```bash
/bmad-agent-soupz-architect
> Design API, then use Kiro's fs_write to create the files
```

### Combining with BMAD Workflows
```bash
# Use Soupz personas within BMAD workflows
/bmad-bmm-create-architecture
# This workflow can call soupz-architect internally
```

---

## Configuration

### Customize Persona Behavior
Edit persona files in `~/.bmad/custom/bmad-agent-soupz-*.md`:

```xml
<persona>
    <role>UX Master</role>
    <identity>Senior UX/UI designer</identity>
    <communication_style>
        [Customize thinking style here]
    </communication_style>
</persona>
```

### Add Custom Menu Items
```xml
<menu>
    <item cmd="CH">[CH] Chat</item>
    <item cmd="CU">[CU] Create UX Design</item>
    <item cmd="DA">[DA] Dismiss</item>
</menu>
```

---

## Troubleshooting

### Persona Not Found
```bash
# Check if imported
ls ~/.bmad/custom/ | grep soupz

# Re-import if needed
cp /Users/shubh/Developer/soupz-agents/bmad-export/*.md ~/.bmad/custom/
```

### Persona Not Responding
- Verify BMAD config exists: `~/.bmad/bmm/config.yaml`
- Check Kiro logs for errors
- Try dismissing and re-activating: `[DA]` then re-invoke

### Context Not Passing
- Ensure you're in the same Kiro session
- Use `/context` to check conversation history
- Personas share context within a session

---

## Performance Tips

### Use Free Models for Redundant Tasks
Soupz routing automatically uses GPT-5 mini (0x cost) for:
- Simple explanations
- Documentation
- Brainstorming
- Basic Q&A

### Use Smart Models for Complex Tasks
Automatically routes to Claude Opus or Gemini Pro for:
- Code generation
- Architecture design
- Complex analysis

### Cost Tracking
```bash
# In Soupz standalone
/costs

# Shows breakdown by model and savings from free models
```

---

## Comparison: Soupz Standalone vs Kiro Integration

| Feature | Soupz Standalone | Soupz in Kiro |
|---------|------------------|---------------|
| Personas | ✅ 22 personas | ✅ 22 personas (via BMAD) |
| Tools | ❌ Limited | ✅ Full Kiro toolset |
| File ops | ❌ Basic | ✅ Advanced (fs_read, fs_write) |
| Code analysis | ❌ No | ✅ Yes (code tool) |
| AWS ops | ❌ No | ✅ Yes (use_aws) |
| Web search | ❌ No | ✅ Yes (web_search) |
| Subagents | ⏳ Coming | ✅ Yes (use_subagent) |
| Cost tracking | ✅ Yes | ⏳ Via Soupz |
| Colored output | ✅ Yes | ✅ Yes |

**Recommendation**: Use Soupz in Kiro for full power!

---

## Next Steps

1. **Import all personas**: `cp bmad-export/*.md ~/.bmad/custom/`
2. **Test in Kiro**: Try `/bmad-agent-soupz-designer`
3. **Create workflows**: Combine personas with Kiro tools
4. **Share with team**: Commit BMAD exports to git

---

## Support

- **Soupz Issues**: `/Users/shubh/Developer/soupz-agents/`
- **BMAD Issues**: Check BMAD docs
- **Kiro Issues**: Check Kiro docs

---

Made with ❤️ by Kiro AI
