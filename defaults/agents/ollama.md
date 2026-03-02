---
name: Ollama
id: ollama
icon: "🤖"
color: "#888888"
binary: ollama
headless: true
description: "Ollama — local LLMs (Llama, Mistral, Phi)"
output_format: text
capabilities:
  - research
  - offline
  - simple-tasks
routing_keywords:
  - ollama
  - local
  - offline
  - llama
  - mistral
auth_command: ""
logout_command: ""
status_command: "ollama list"
build_args: ["run", "llama3.1", "{prompt}"]
grade: 45
usage_count: 0
---

# Ollama — Local LLM Agent

Run LLMs locally without internet or API costs.

## Strengths
- Completely offline
- No API costs
- Privacy-focused
- Fast for simple tasks

## Best For
- Offline development
- Privacy-sensitive tasks
- Simple coding tasks
- Quick explanations

## Models Available
- Llama 3.1 (8B, 70B)
- Mistral (7B)
- Phi-3 (3.8B)
- CodeLlama

## Usage
Ollama is automatically used when:
- No internet connection
- Explicitly requested (@ollama)
- Simple tasks that don't need cloud models


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
