# Kiro Inside Soupz-Stall

## Overview

Kiro is now a **tool agent** inside Soupz-Stall, just like Gemini, Copilot, and Antigravity. You can use Kiro's powerful features (file ops, code analysis, AWS, subagents) through Soupz-Stall's interface.

---

## Architecture

```
Soupz-Stall (Orchestrator)
    ↓
┌───────────────────────────────────────────────┐
│  Tool Agents (with 22 personas each)         │
├───────────────────────────────────────────────┤
│  🚀 Antigravity  - VS Code, UI, screenshots  │
│  🐙 Copilot      - GitHub Copilot CLI        │
│  🔮 Gemini       - Google Gemini API         │
│  🎯 Kiro         - File ops, AWS, subagents  │ ← NEW!
│  🤖 Ollama       - Local LLMs                │
└───────────────────────────────────────────────┘
    ↓
Smart Routing (picks best tool + persona)
```

---

## How It Works

### 1. Auto-Routing to Kiro

Soupz-Stall automatically routes to Kiro when you need:
- **File operations**: read, write, search, grep
- **Code analysis**: LSP, symbol search, refactoring
- **AWS operations**: deploy, manage infrastructure
- **Web search**: research, documentation lookup
- **Subagents**: complex multi-step workflows

**Example**:
```bash
soupz-stall
> analyze the codebase structure
# Auto-routes to Kiro (file-operations capability)

> deploy to AWS Lambda
# Auto-routes to Kiro (aws-operations capability)
```

### 2. Manual Selection

Force Kiro for any task:
```bash
soupz-stall
/tool kiro
> your prompt here
```

Or use persona with Kiro:
```bash
@architect design API
# If Kiro is best tool, uses Kiro + Architect persona
```

### 3. Kiro's Unique Capabilities

**File Operations**:
```bash
> read all TypeScript files in src/
> search for "TODO" comments
> create a new component file
```

**Code Analysis**:
```bash
> find all references to this function
> analyze code complexity
> suggest refactoring opportunities
```

**AWS Operations**:
```bash
> list all Lambda functions
> deploy to S3
> check CloudWatch logs
```

**Subagents** (Kiro's superpower):
```bash
> spawn 3 subagents to analyze frontend, backend, and database separately
> use subagent to research best practices while I continue coding
```

---

## Routing Logic

### When Soupz-Stall Picks Kiro

```javascript
// In semantic-router.js
if (prompt.includes('file') || prompt.includes('analyze')) {
    // Kiro gets +25 points
}

if (prompt.includes('aws') || prompt.includes('deploy')) {
    // Kiro gets +25 points
}

if (prompt.includes('subagent') || prompt.includes('parallel')) {
    // Kiro gets +35 points (Kiro's unique feature)
}
```

### Routing Priority

1. **Kiro** - File ops, code analysis, AWS, subagents
2. **Copilot** - General coding, GPT-5 mini (free)
3. **Gemini** - Research, explanations, complex reasoning
4. **Antigravity** - UI screenshots, browser automation
5. **Ollama** - Local, offline tasks

---

## Example Workflows

### 1. Codebase Analysis (Kiro)
```bash
soupz-stall
> analyze the project structure
# Kiro: Uses file operations + code analysis
# Output: Directory tree, file count, tech stack detected
```

### 2. AWS Deployment (Kiro)
```bash
> deploy the API to AWS Lambda
# Kiro: Uses AWS operations
# Output: Lambda created, API Gateway configured, URL provided
```

### 3. Multi-Step with Subagents (Kiro)
```bash
> spawn subagent to research React best practices
> while that runs, help me refactor this component
# Kiro: Spawns subagent for research, continues with main task
# Output: Research results + refactored code
```

### 4. Combined Workflow (Multiple Tools)
```bash
> @architect design API
# Soupz routes to Kiro (best for code/architecture)
# Kiro + Architect persona = detailed API design

> @designer create UI mockup
# Soupz routes to Gemini or Copilot (design persona)
# Output: UI wireframes, design tokens

> deploy to AWS
# Soupz routes to Kiro (AWS operations)
# Output: Deployed!
```

---

## Comparison: Kiro vs Other Tools

| Feature | Kiro | Copilot | Gemini | Antigravity |
|---------|------|---------|--------|-------------|
| File ops | ✅ Advanced | ❌ No | ❌ No | ❌ No |
| Code analysis | ✅ LSP | ⚠️ Basic | ⚠️ Basic | ❌ No |
| AWS ops | ✅ Full | ❌ No | ❌ No | ❌ No |
| Web search | ✅ Yes | ❌ No | ⚠️ Limited | ❌ No |
| Subagents | ✅ Yes | ❌ No | ❌ No | ❌ No |
| Browser | ❌ No | ❌ No | ❌ No | ✅ Yes |
| Cost | Free | Free/Paid | Paid | Free |

**Use Kiro when**: You need file ops, code analysis, AWS, or subagents
**Use Copilot when**: General coding, free GPT-5 mini
**Use Gemini when**: Research, explanations
**Use Antigravity when**: Browser automation, screenshots

---

## Configuration

### Kiro Agent File
Location: `defaults/agents/kiro.md`

```yaml
---
name: Kiro
id: kiro
icon: "🎯"
binary: kiro-cli
capabilities:
  - coding
  - file-operations
  - code-analysis
  - aws-operations
  - web-search
  - subagent
routing_keywords:
  - kiro
  - file
  - analyze
  - aws
  - subagent
---
```

### Customize Routing

Edit `src/orchestrator/semantic-router.js`:

```javascript
// Boost Kiro for specific tasks
if (prompt.includes('your-keyword')) {
    if (agent.id === 'kiro') score += 50;
}
```

---

## Testing

### 1. Verify Kiro is Available
```bash
soupz-stall
/agents
# Should show: 🎯 Kiro
```

### 2. Test Auto-Routing
```bash
> analyze this codebase
# Should route to Kiro
# Check: "🎯 Routing: kiro"
```

### 3. Test Manual Selection
```bash
/tool kiro
> your prompt
# Forces Kiro
```

### 4. Test with Persona
```bash
@architect design API
# Should use Kiro + Architect if Kiro is best tool
```

---

## Troubleshooting

### Kiro Not Showing
```bash
# Check if kiro-cli is installed
which kiro-cli

# If not, install Kiro CLI first
# Then restart soupz-stall
```

### Routing to Wrong Tool
```bash
# Check routing decision
> your prompt
# Look for: "🎯 Routing: [tool]"
# If wrong, use /tool kiro to force
```

### Kiro Not Working
```bash
# Test Kiro directly
kiro-cli chat
# If works, issue is with Soupz integration

# Check agent file
cat defaults/agents/kiro.md
```

---

## Advanced: Kiro + Personas

### Example 1: Architect + Kiro
```bash
@architect design a scalable API
# Soupz: Routes to Kiro (best for code/architecture)
# Kiro: Uses Architect persona
# Output: System architecture + API contracts + file structure
```

### Example 2: DevOps + Kiro
```bash
@devops deploy to AWS
# Soupz: Routes to Kiro (AWS operations)
# Kiro: Uses DevOps persona
# Output: Infrastructure as code + deployment steps
```

### Example 3: QA + Kiro
```bash
@qa analyze test coverage
# Soupz: Routes to Kiro (code analysis)
# Kiro: Uses QA persona
# Output: Coverage report + missing tests + recommendations
```

---

## Benefits of Kiro in Soupz-Stall

1. **Unified Interface**: Access Kiro through Soupz-Stall's orchestrator
2. **Smart Routing**: Auto-picks Kiro when needed
3. **Persona Support**: Use all 22 personas with Kiro
4. **Cost Tracking**: Track Kiro usage with `/costs`
5. **Memory Shards**: Kiro benefits from Soupz's memory system
6. **Grading**: Kiro gets graded and improves over time

---

## Next Steps

1. **Install Kiro CLI** (if not already):
   ```bash
   # Install Kiro
   npm install -g kiro-cli
   ```

2. **Start Soupz-Stall**:
   ```bash
   soupz-stall
   ```

3. **Test Kiro**:
   ```bash
   > analyze the codebase
   # Should route to Kiro
   ```

4. **Use with Personas**:
   ```bash
   @architect design API
   # Uses Kiro + Architect
   ```

---

**Made with ❤️ by Kiro AI**
**Kiro is now part of Soupz-Stall! 🎉**
