---
name: Gemini
id: gemini
icon: "🔮"
color: "#4285F4"
binary: gemini
headless: true
description: "Google Gemini CLI — research, code generation, multi-modal analysis"
output_format: stream-json
capabilities:
  - research
  - analysis
  - code
  - explanation
  - multi-modal
routing_keywords:
  - explain
  - research
  - analyze
  - compare
  - summarize
  - what is
  - how does
  - why
auth_command: "gemini auth"
logout_command: "gemini auth revoke"
status_command: "gemini auth status"
build_args: ["-p", "{prompt}", "--output-format", "stream-json"]
grade: 50
usage_count: 0
---

# Gemini — Google AI Agent

Google Gemini CLI for research, code generation, and multi-modal analysis.

## Strengths
- Broad knowledge and research capabilities
- Multi-modal understanding (images, video, text)
- Fast response times
- Google ecosystem integration
- Large context window (1M+ tokens on Pro)
- Free tier with generous limits

## Best For
- Explaining concepts and technologies
- Research and comparison tasks
- Analyzing codebases and architectures
- Multi-modal content processing
- Long document analysis

## When to Use
- Research and explanation tasks
- Comparing technologies or approaches
- Understanding new codebases
- Processing images, PDFs, or documents
- Quick Q&A on any topic

## When NOT to Use (If You Have Other Agents)
- Code generation requiring file editing → Claude Code or Copilot
- Shell commands and DevOps → Copilot
- Tasks requiring file system access → Claude Code
- Production code changes → Claude Code or Copilot

## If Gemini Is Your ONLY Agent
Gemini is surprisingly capable as a solo agent:

**For Code Tasks (normally Claude Code/Copilot):**
- Gemini CAN generate high-quality code — just copy/paste the output
- Ask for "complete, runnable code" with all imports
- Request code review and improvements iteratively
- For multi-file projects, ask for file-by-file output with clear filenames
- Use the 1M token context to paste your entire codebase for analysis

**For Shell Commands (normally Copilot):**
- Ask "What's the shell command to..." — Gemini knows shell well
- Request explanation of commands before running
- Ask for scripts with error handling

**For Architecture (normally Claude Code):**
- Gemini excels at architecture analysis and recommendations
- Paste system designs and ask for critique
- Request diagrams in ASCII or Mermaid format

**Limitations as solo agent:**
- Cannot directly edit files
- Cannot run shell commands
- You'll need to copy/paste output manually

## If You Have Gemini + Copilot Only
| Task Type | Use |
|-----------|-----|
| Code generation | Copilot (can edit files directly) |
| Shell commands | Copilot (can execute) |
| Research/explanations | Gemini (broader knowledge) |
| Multi-modal (images) | Gemini (only option) |
| Architecture planning | Gemini (better reasoning) |
| Long documents | Gemini (1M context) |
| Quick fixes | Copilot (faster) |
| Understanding code | Gemini (better explanations) |

## Multi-Modal Capabilities
Gemini excels at processing:
- Images (screenshots, diagrams, UI mockups)
- PDFs and documents (up to 1000 pages)
- Video content (up to 1 hour)
- Mixed media analysis
- Handwritten notes and sketches

## Context Window Advantage
Gemini Pro has 1M+ token context — use it:
- Paste entire codebases for analysis
- Upload long documents for summarization
- Provide extensive context without truncation
- Analyze multiple files together

## Integration Tips
- Use `--output-format stream-json` for streaming responses
- Attach images/files for visual analysis
- Best for exploratory research before implementation
- Use for code review by pasting code directly

## Reliability
**High reliability for:**
- Research and explanations
- Code review and analysis
- Multi-modal processing
- Long document analysis

**Medium reliability for:**
- Code generation (produces good code, but verify)
- Architecture recommendations (solid but get second opinion)
- Shell commands (knows them, but Copilot is better)

## Free Tier
Gemini has a generous free tier — ideal for:
- Cost-conscious development
- Research-heavy workflows
- When API costs need to be minimized
- Prototyping before using premium agents


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
