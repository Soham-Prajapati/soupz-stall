---
name: Kiro
id: kiro
icon: "⚡"
color: "#F59E0B"
binary: kiro-cli
headless: true
description: "Kiro AI CLI — spec-driven development, autonomous coding agent"
output_format: text
capabilities:
  - code
  - spec-driven
  - autonomous
  - multi-file-editing
  - testing
routing_keywords:
  - kiro
  - spec
  - specification
  - autonomous build
  - auto code
auth_command: "kiro auth login"
logout_command: "kiro auth logout"
status_command: "kiro --version"
build_args: ["{prompt}"]
grade: 80
usage_count: 0
---

# Kiro — AWS AI Coding Agent

Kiro CLI for spec-driven, autonomous development workflows.

## Strengths
- Spec-first development (hooks, steering files)
- Autonomous multi-step coding
- AWS ecosystem integration
- Agent-driven code generation
- Built-in testing and validation

## Best For
- Building features from specifications
- Autonomous project scaffolding
- AWS-integrated workflows
- Multi-file feature implementation

## When to Use
- Building features from detailed specifications
- AWS infrastructure and Lambda functions
- Autonomous multi-step development
- When you have clear requirements documents

## When NOT to Use
- Quick one-off tasks → Use Copilot instead
- Exploratory coding without specs → Use Claude Code or Copilot
- Non-AWS workflows → Use Claude Code or Copilot
- Simple bug fixes → Copilot is faster
- When reliability is critical → See reliability notes below

## IMPORTANT: Reliability Warning
**Kiro is less reliable than Claude Code or Copilot for general tasks.**

Use Kiro ONLY when:
- You have detailed specs that Kiro's spec-driven approach benefits from
- You're working heavily with AWS services
- The autonomous workflow fits your needs

**For most tasks, prefer:**
- Claude Code (best overall quality)
- Copilot (best speed + reliability balance)
- Gemini (best for research/understanding)

## If Kiro Is Your ONLY Agent (Not Recommended)
If you must use Kiro as your primary agent:

**For General Coding (normally Claude Code/Copilot):**
- Create minimal spec files even for simple tasks
- Use steering files to constrain behavior
- Verify output more carefully than with other agents
- Break tasks into very small, specific chunks

**For Research (normally Gemini):**
- Kiro is NOT designed for research — limited capability
- Frame questions as "implementation specifications"
- Consider using web search alongside

**Mitigation Strategies:**
- Always review generated code carefully
- Run tests on all generated code
- Keep tasks small and focused
- Have a backup plan (another agent or manual coding)

## When Kiro Shines
Despite reliability concerns, Kiro excels at:
- AWS Lambda function scaffolding
- Infrastructure-as-code generation
- Feature implementation from detailed PRDs
- Test generation from specifications
- Automated refactoring with clear specs

## Spec-Driven Development
Kiro works best with:
1. Clear feature specifications (the more detailed, the better)
2. Defined acceptance criteria
3. Test cases or expected behavior (Kiro generates tests well)
4. AWS service requirements (its sweet spot)

## Integration Tips
- Create `.kiro/` directory with spec files
- Use steering files to guide behavior
- Combine with Claude Code for architecture decisions
- Use Copilot for quick fixes, Kiro for spec'd features

## Comparison with Other Agents
| Capability | Kiro | Claude Code | Copilot |
|------------|------|-------------|---------|
| Spec-driven | Excellent | Good | Limited |
| AWS integration | Excellent | Good | Good |
| General coding | Medium | Excellent | Very Good |
| Reliability | Medium | High | High |
| Speed | Medium | Medium | Fast |
| Autonomous multi-file | Good | Excellent | Limited |

## Reliability by Task Type
**High reliability:**
- AWS Lambda generation
- Spec-to-code conversion
- Test generation

**Medium reliability:**
- General code generation
- Refactoring

**Lower reliability:**
- Exploratory coding
- Complex reasoning
- Tasks without clear specs
