---
name: Claude Code
id: claude-code
icon: "🧠"
color: "#D97706"
binary: claude
headless: true
description: "Claude Code CLI — complex reasoning, code generation, architecture, multi-file editing"
output_format: text
capabilities:
  - code
  - reasoning
  - architecture
  - debugging
  - refactoring
  - multi-file-editing
  - planning
  - analysis
routing_keywords:
  - claude
  - complex
  - reason
  - architecture
  - multi file
  - refactor large
  - debug hard
  - plan
  - analyze codebase
auth_command: "claude auth"
logout_command: "claude auth logout"
status_command: "claude --version"
build_args: ["--print", "{prompt}"]
grade: 95
usage_count: 0
---

# Claude Code — Anthropic Claude CLI

Claude Code CLI for complex reasoning, architecture planning, and multi-file code editing. **The most capable general-purpose coding agent.**

## Strengths
- Deep reasoning on complex problems
- Multi-file codebase understanding
- Architecture and system design
- Safe, careful code modifications
- Long context window (200K tokens)
- Tool use (file editing, shell, web search)
- Plans before executing (reduces errors)

## Best For
- Large refactoring tasks
- Architecture decisions with tradeoffs
- Debugging deeply nested issues
- Planning and documentation
- Security audits of full codebases
- When quality matters more than speed

## When to Use
- Complex multi-file changes requiring understanding of the entire codebase
- Architecture decisions with significant tradeoffs
- Tasks requiring chain-of-thought reasoning
- Code review at the system level
- When other agents produce subpar results
- Sensitive codebases requiring careful changes

## When NOT to Use (If You Have Other Agents)
- Simple, single-file changes → Copilot (faster)
- Quick shell commands → Copilot
- Tasks where speed matters more than depth → Copilot
- Simple explanations or Q&A → Gemini
- When API costs need to be minimized → Ollama or Gemini
- Multi-modal tasks (images) → Gemini

## If Claude Code Is Your ONLY Agent
**Congratulations — you have the best general-purpose agent.** Claude Code can handle essentially any coding task.

**For Shell Commands (normally Copilot):**
- Claude Code has full shell access — it works great
- Slightly slower than Copilot but more thoughtful
- Better at complex shell pipelines

**For Research (normally Gemini):**
- Claude Code can search the web
- Good at explaining concepts
- Lacks multi-modal (can't process images)

**For Cost-Sensitive Tasks (normally Ollama):**
- No free tier — every query costs
- Minimize context size to reduce costs
- Use for high-value tasks only

**For Quick Tasks (normally Copilot):**
- Claude Code works but is slower
- It "thinks" before acting — slower but safer
- For truly quick tasks, the latency may feel excessive

## If You Have Claude Code + One Other Agent
| If You Also Have | Use Claude Code For | Use Other For |
|------------------|---------------------|---------------|
| + Copilot | Complex reasoning, multi-file, architecture | Quick edits, shell commands, speed |
| + Gemini | Code generation, debugging, refactoring | Research, images, explanations |
| + Ollama | Quality-critical work | High-volume, privacy, cost savings |
| + Kiro | General coding, architecture | AWS-specific specs (if reliable for you) |

## Model Capabilities
- **Context Window:** 200K tokens (can read entire codebases)
- **Reasoning:** Deep chain-of-thought, planning-before-execution
- **Code Quality:** Conservative, safety-first modifications
- **Tool Use:** File editing, shell commands, web search
- **Memory:** Maintains context across conversation
- **Planning:** Creates plans before implementing

## Cost Considerations
Claude Code is a premium agent. Use when:
- Task complexity justifies the cost
- Other agents have failed or produced suboptimal results
- Codebase requires deep understanding
- Quality is more important than cost

**Cost-Saving Tips:**
- Use Copilot for quick tasks, Claude for complex ones
- Minimize context by excluding irrelevant files
- Be specific in prompts to reduce back-and-forth

## Reliability
**Highest reliability of any agent for:**
- Multi-file refactoring
- Architecture decisions
- Complex debugging
- Code generation with constraints
- Safety-critical changes

Claude Code's "think before acting" approach means:
- Fewer errors than faster agents
- Better at catching edge cases
- More consistent code quality
- Explains its reasoning

## Why Claude Code Is Often the Default Choice
When in doubt, Claude Code is the safest choice because:
1. Highest reasoning capability
2. Plans before executing (catches issues early)
3. Conservative approach (won't break things)
4. 200K context (understands full codebases)
5. Explains its decisions

Only choose other agents when:
- Speed matters more than quality → Copilot
- Cost matters more than quality → Ollama/Gemini
- You need multi-modal → Gemini
- You need offline → Ollama
