# Skill Template for Soupz Agents

Use this template when creating new agent skills. All skills should follow this standardized structure.

---

## Required YAML Frontmatter

```yaml
---
name: [Display Name]
id: [kebab-case-id]
icon: "[emoji]"
color: "[hex color]"
type: persona | agent
uses_tool: auto
headless: false
capabilities:
  - [capability-1]
  - [capability-2]
  - [capability-3]
routing_keywords:
  - [keyword-1]
  - [keyword-2]
  - [keyword-3]
description: "[One-line description - max 100 chars]"
grade: [70-95]
usage_count: 0
system_prompt: |
  [System prompt content - see structure below]
---
```

---

## System Prompt Structure

### 1. Identity Statement (Required)
```
You are a [Role Title] with [X years/level] of experience in [domain].
[1-2 sentences establishing expertise, credentials, and personality.]
Your methodology is grounded in [Book/Framework 1] and [Book/Framework 2].

[Core belief or mantra that defines how this agent operates.]
```

### 2. Phased Methodology (Required for complex skills)
```
═══════════════════════════════════════════════════════════════
PHASE 1: [PHASE NAME]
═══════════════════════════════════════════════════════════════

1.1 — [Section Name]
[Detailed content with frameworks, templates, examples]

1.2 — [Section Name]
[More content]

═══════════════════════════════════════════════════════════════
PHASE 2: [PHASE NAME]
═══════════════════════════════════════════════════════════════
[Continue pattern...]
```

### 3. XML Behavioral Sections (Required)

```xml
<context_gathering>
Before starting work:
1. [Step to understand context]
2. [Step to gather information]
3. [Step to verify understanding]
4. [Step to identify dependencies]

Never [action] without [precondition].
</context_gathering>

<self_verification>
Before marking work complete:
- [ ] [Verification item 1]
- [ ] [Verification item 2]
- [ ] [Verification item 3]
- [ ] [Verification item 4]
</self_verification>

<error_recovery>
When encountering issues:
1. [First step - analyze]
2. [Second step - hypothesize]
3. [Third step - attempt fix]
4. [Fourth step - escalate if needed]
</error_recovery>

<anti_patterns>
NEVER do these:
- [Anti-pattern 1 with brief explanation]
- [Anti-pattern 2 with brief explanation]
- [Anti-pattern 3 with brief explanation]
- [Anti-pattern 4 with brief explanation]
</anti_patterns>
```

### 4. Few-Shot Examples (Required for complex skills)

```xml
<examples>
<example name="[scenario name]">
<user_request>
[Example user request]
</user_request>
<ideal_response>
[How the agent should respond - abbreviated but showing the pattern]
</ideal_response>
</example>
</examples>
```

### 5. Deliverables Section (Required)
```
═══════════════════════════════════════════════════════════════
DELIVERABLES
═══════════════════════════════════════════════════════════════

1. **[Deliverable 1]** — [Brief description]
2. **[Deliverable 2]** — [Brief description]
3. **[Deliverable 3]** — [Brief description]
```

### 6. Multi-Agent Delegation (Required)
```
@DELEGATE[agent-id]: "[Task description for that agent]"
@DELEGATE[agent-id]: "[Task description for that agent]"
```

### 7. Response Format (Required)
```
Start every response with: "[emoji] **[Agent Name]** —" and state [what to state].
[Any additional response format rules]
```

---

## Footer (After frontmatter closing ---)

```markdown
# [Agent Name]

[One paragraph description of the agent's specialization and use cases.]
```

---

## Quality Checklist

Before submitting a new skill, verify:

- [ ] YAML frontmatter is valid and complete
- [ ] Identity statement establishes expertise with book/framework references
- [ ] At least 3 phases for complex skills (or detailed process for simple skills)
- [ ] All 4 XML sections present (context_gathering, self_verification, error_recovery, anti_patterns)
- [ ] At least 1 few-shot example for complex skills
- [ ] Deliverables section with 4-8 concrete outputs
- [ ] Multi-agent delegation with @DELEGATE syntax
- [ ] Response format instruction at the end
- [ ] Grade assigned (70-95 based on completeness)
- [ ] No duplicate content or malformed sections

---

## Grade Guidelines

| Grade | Criteria |
|-------|----------|
| 90-95 | Comprehensive phases, deep expertise, examples, complete XML sections, production-ready |
| 80-89 | Good phases, solid frameworks, XML sections, minor gaps |
| 70-79 | Basic structure, limited depth, some XML sections |
| Below 70 | Incomplete, missing sections, needs enhancement |

---

## Example Skill Categories

| Category | Skills | Typical Complexity |
|----------|--------|-------------------|
| Engineering | dev, architect, devops, security, ai-engineer | High - need detailed phases |
| Design | designer, ux-designer, ui-builder, svgart | High - need visual examples |
| Product | pm, planner, evaluator, growth-hacker | Medium-High - need frameworks |
| Research | researcher, analyst, datascientist | Medium - need methodology |
| Content | contentwriter, techwriter, presenter | Medium - need templates |
| Orchestration | orchestrator, master, hackathon | High - need delegation patterns |
| CLI Wrappers | claude-code, copilot, gemini, kiro, ollama | Low - thin wrappers |
