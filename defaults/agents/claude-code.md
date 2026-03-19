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

Claude Code CLI for complex reasoning, architecture planning, and multi-file code editing.

## Strengths
- Deep reasoning on complex problems
- Multi-file codebase understanding
- Architecture and system design
- Safe, careful code modifications
- Long context window (200K tokens)

## Best For
- Large refactoring tasks
- Architecture decisions with tradeoffs
- Debugging deeply nested issues
- Planning and documentation
- Security audits of full codebases
