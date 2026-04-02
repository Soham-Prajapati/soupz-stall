---
name: Codex
id: codex
icon: "C"
color: "#10B981"
binary: codex
headless: true
description: "Codex provider via GitHub Copilot CLI models (coding + refactoring + architecture)"
output_format: text
capabilities:
  - coding
  - refactoring
  - architecture
  - debugging
  - testing
routing_keywords:
  - codex
  - refactor
  - architecture
  - implementation
  - debug
  - test
auth_command: "gh auth login"
logout_command: "gh auth logout"
status_command: "gh auth status"
build_args: ["exec", "--dangerously-bypass-approvals-and-sandbox", "{prompt}"]
free_model: "gpt-5.1-codex-mini"
grade: 82
usage_count: 0
---

# Codex Provider (via GitHub Copilot CLI)

Codex runs through the `gh copilot` extension using Codex-capable models.

## Requirements
- GitHub CLI installed
- `gh` authenticated
- `gh-copilot` extension installed

## Best For
- Multi-file implementation planning
- Refactoring and architecture-heavy coding tasks
- Debugging and code quality improvements

## Notes
- This provider maps to Copilot CLI infrastructure.
- If Codex is not ready, Soupz can fall back to Gemini or Copilot automatically.
