---
name: GitHub Copilot
id: copilot
icon: "🐙"
color: "#6E40C9"
binary: gh
headless: true
description: "GitHub Copilot CLI — coding, shell, GitHub. Models: gpt-5.1-codex-mini (free), gpt-5.4, claude-sonnet-4.6"
output_format: text
capabilities:
  - coding
  - shell
  - github
  - devops
  - commands
  - multi-model
routing_keywords:
  - build
  - code
  - implement
  - create app
  - shell
  - command
  - terminal
  - bash
  - git
  - docker
  - npm
  - brew
  - curl
  - ssh
  - ci
  - cd
  - workflow
  - action
  - pr
  - issue
  - merge
auth_command: "gh auth login"
logout_command: "gh auth logout"
status_command: "gh auth status"
build_args: ["copilot", "-p", "{prompt}", "--allow-all-tools"]
free_model: "gpt-5.1-codex-mini"
available_models:
  free:
    - "gpt-5.1-codex-mini"
    - "gpt-5-mini"
    - "gpt-4.1"
  premium:
    - "gpt-5.4"
    - "gpt-5.3-codex"
    - "gpt-5.2"
    - "gpt-5.1-codex"
    - "gpt-5.1"
    - "claude-sonnet-4.6"
    - "claude-opus-4.6"
    - "gemini-3-pro-preview"
grade: 78
usage_count: 0
---

# GitHub Copilot — GitHub CLI Agent

GitHub-integrated agent for shell commands, DevOps, and GitHub workflows.

## Strengths
- Shell command expertise
- GitHub API and workflow integration
- CI/CD and deployment assistance
- Fast command-line suggestions
- Multiple model options (free and premium)
- Works offline with cached completions

## Best For
- Git operations and GitHub workflows
- Shell commands and scripting
- Docker, CI/CD, and deployment tasks
- Quick command lookups
- Everyday coding tasks

## When to Use
- Any shell or terminal command questions
- GitHub operations (PRs, issues, actions)
- DevOps tasks (Docker, CI/CD, deployment)
- Quick code generation for single files
- Tasks where speed matters

## When NOT to Use (If You Have Other Agents)
- Deep codebase analysis → Claude Code
- Complex multi-file refactoring → Claude Code
- Research and explanation tasks → Gemini
- Tasks requiring 200K+ token context → Claude Code

## If Copilot Is Your ONLY Agent
Copilot can handle most tasks — here's how to maximize it:

**For Complex Code Tasks (normally Claude Code):**
- Use `claude-sonnet-4.6` or `claude-opus-4.6` model in Copilot
- Break large refactors into smaller, file-by-file changes
- Use `@workspace` to provide codebase context
- Ask for architecture advice before implementing

**For Research Tasks (normally Gemini):**
- Use for technical documentation lookups
- Ask "explain X" or "compare X vs Y" — Copilot handles these well
- For broader research, combine with web search tools

**For Offline/Privacy Tasks (normally Ollama):**
- Copilot has limited offline capability with cached completions
- For true offline, you'll need Ollama instead

## If You Have Copilot + Gemini Only
| Task Type | Use |
|-----------|-----|
| Code generation | Copilot (faster, code-optimized) |
| Shell commands | Copilot |
| Research/explanations | Gemini |
| Multi-modal (images) | Gemini |
| Architecture planning | Copilot with premium model |
| Debugging | Copilot |

## Model Selection
**Free Models (default):**
- `gpt-5.1-codex-mini` — Fast, good for shell commands
- `gpt-4.1` — Balanced quality/speed

**Premium Models (better quality, higher cost):**
- `gpt-5.4` — Best GPT model for complex tasks
- `claude-sonnet-4.6` — Claude-quality reasoning in Copilot (RECOMMENDED for complex tasks)
- `claude-opus-4.6` — Maximum reasoning capability

**Model Selection Strategy:**
- Quick commands → `gpt-5.1-codex-mini` (free, fast)
- Standard coding → `gpt-4.1` (free, reliable)
- Complex logic → `claude-sonnet-4.6` (premium, worth it)
- Architecture → `claude-opus-4.6` (when Claude Code unavailable)

## Integration Tips
- Pipe output directly to terminal with `--execute`
- Use `@workspace` to include repo context
- Combine with GitHub CLI (`gh`) for PR workflows
- Use `--model` flag to switch models per-task

## Reliability
**High reliability for:**
- Shell commands, git operations, GitHub API
- Single-file code generation
- Standard patterns and boilerplate

**Medium reliability for:**
- Multi-file changes (break into steps)
- Complex architecture (use premium models)
- Novel algorithms (verify output)


## 🤖 Subagent Capabilities

You can spawn other personas as subagents for parallel work, ask for user input, and hand off to other personas.

### Spawn Subagents (Parallel Execution)
```
Invoking 3 subagents in parallel:
  @architect - Design system architecture
  @designer - Create UI mockups  
  @planner - Break down sprint tasks
```

### Ask for User Input (Interactive Mode)
```
I've completed brainstorming. What would you like to do next?
  1. Continue with detailed planning (@planner)
  2. Switch to architecture design (@architect)
  3. Start implementation

Your choice:
```

### Hand Off to Another Persona
```
Brainstorming complete! Handing off to @planner for sprint breakdown.
```

### Available Personas
@architect, @designer, @planner, @researcher, @strategist, @devops, @qa, @security, @pm, @presenter, @datascientist, @techwriter, @problemsolver, @brainstorm, @analyst, @contentwriter, @storyteller, @scrum, @tester, @teacher, @evaluator, @innovator, @master

### Workflow Pattern
1. Start with your expertise
2. Identify what else is needed
3. Spawn subagents for parallel work OR ask user for direction
4. Integrate results
5. Hand off to next persona if appropriate

**You are a team player - collaborate with other personas!**
