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
build_args: ["run", "qwen2.5:1.5b", "{prompt}"]
grade: 45
usage_count: 0
---

# Ollama — Local LLM Agent

Run LLMs locally without internet or API costs.

## Strengths
- Completely offline (works without internet)
- No API costs ($0 per query, unlimited usage)
- Privacy-focused (data never leaves your machine)
- Fast for simple tasks (no network latency)
- Wide model selection
- Works anywhere (planes, remote locations, air-gapped networks)

## Best For
- Offline development
- Privacy-sensitive tasks
- Simple coding tasks
- Quick explanations
- High-volume operations where cost matters
- Agent routing and classification
- Sensitive codebases that can't be sent to cloud

## When to Use
- No internet connection
- Privacy-critical tasks (sensitive code, credentials, proprietary algorithms)
- High-volume queries where API costs would add up
- Simple tasks that don't need frontier models
- Preprocessing/routing before calling expensive models
- Air-gapped environments

## When NOT to Use (If You Have Other Agents)
- Complex reasoning tasks → Claude Code
- Tasks requiring large context windows → Gemini (1M) or Claude (200K)
- Production-critical code → Claude Code or Copilot
- Tasks where accuracy is paramount → Use cloud models

## If Ollama Is Your ONLY Agent
Ollama can handle a lot more than people think:

**For Complex Tasks (normally Claude Code):**
- Use Llama 3.1 70B or Qwen 2.5 72B for Claude-like quality
- Break complex tasks into smaller steps
- Use chain-of-thought prompting ("Think step by step")
- Run multiple passes and compare outputs
- Context is limited — summarize long files before including

**For Code Generation (normally Copilot):**
- CodeLlama 34B is excellent for code
- DeepSeek Coder 33B rivals cloud models for code
- Qwen 2.5 Coder 32B — new strong option
- Specify language and include examples in prompt

**For Research (normally Gemini):**
- Knowledge cutoff varies by model (check model card)
- For current info, you'll need internet access
- Good for explaining concepts, patterns, and techniques
- Use Mixtral 8x7B for broad knowledge

**Maximizing Local Performance:**
- Invest in hardware: M2/M3 Mac or RTX 4090 unlocks 70B models
- Use quantized models (Q4_K_M is good quality/speed balance)
- Keep context short — local models have 4-8K limit typically
- Use system prompts to focus the model

## If You Have Ollama + One Cloud Agent
| If You Also Have | Use Ollama For | Use Cloud For |
|------------------|----------------|---------------|
| + Copilot | Routing, preprocessing, privacy | Code execution, complex code |
| + Gemini | Privacy, offline, high-volume | Research, multi-modal, long context |
| + Claude Code | Cost savings, privacy | Complex reasoning, multi-file edits |

## Models Available
| Model | Parameters | Best For | Quality |
|-------|------------|----------|---------|
| Llama 3.1 8B | 8B | Fast general purpose | Good |
| Llama 3.1 70B | 70B | Complex tasks | Excellent |
| Mixtral 8x7B | 47B | Broad knowledge | Very Good |
| CodeLlama 34B | 34B | Code generation | Excellent |
| DeepSeek Coder 33B | 33B | Code (rivals GPT-4) | Excellent |
| Qwen 2.5 72B | 72B | Multilingual, code | Excellent |
| Qwen 2.5 Coder 32B | 32B | Code generation | Excellent |
| Phi-3 Medium | 14B | Balanced | Very Good |
| Mistral 7B | 7B | Lightweight coding | Good |

## Model Selection by Task
```
Simple chat/Q&A     → Llama 3.1 8B (fast)
Code generation     → DeepSeek Coder 33B or Qwen Coder 32B
Complex reasoning   → Llama 3.1 70B or Qwen 2.5 72B
Multilingual        → Qwen 2.5 (any size)
Broad knowledge     → Mixtral 8x7B
Resource-limited    → Phi-3 Medium or Mistral 7B
```

## Cost Optimization Strategy
Use Ollama as the first tier in your model cascade:
1. Simple routing → Ollama (free)
2. Basic tasks → Ollama or Gemini Flash (cheap)
3. Standard tasks → Copilot or Sonnet
4. Complex tasks → Claude Code (premium)

At high volume, Ollama saves serious money:
- 1000 queries/day × 30 days = 30,000 queries/month
- Cloud cost: ~$50-500/month depending on model
- Ollama cost: $0 (after hardware investment)

## Hardware Requirements
| Model Size | RAM (CPU) | VRAM (GPU) | Recommended Hardware |
|------------|-----------|------------|---------------------|
| 7-8B | 8GB | 6GB | Any modern computer |
| 13-14B | 16GB | 10GB | M1/M2 Mac, RTX 3060 |
| 33-34B | 32GB | 24GB | M2 Pro/Max, RTX 4090 |
| 70-72B | 64GB | 48GB+ | M3 Max, 2x RTX 4090 |

**Best Performance:**
- Apple Silicon (M1/M2/M3): Unified memory makes large models accessible
- NVIDIA GPUs (RTX 3090/4090): Fast inference, CUDA optimized
- CPU-only: Works but 3-10x slower than GPU

## Reliability
**High reliability for:**
- Simple code generation
- Explanations and Q&A
- Text transformation
- Routing and classification

**Medium reliability for:**
- Complex multi-step reasoning
- Novel algorithm design
- Tasks requiring recent knowledge

**Lower reliability for:**
- Tasks needing 10K+ context
- Cutting-edge techniques (training data cutoff)
- Enterprise-grade accuracy requirements


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
