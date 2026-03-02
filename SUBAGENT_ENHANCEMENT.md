# Soupz-Stall Enhancement: Subagent System for All Personas

## Overview

Make ALL personas work like Kiro - with subagent spawning, interactive mode, and dynamic switching.

---

## Required Changes

### 1. Add Subagent Support to Session

**File**: `src/session.js`

Add after line ~1180 (in `runPersona` method):

```javascript
async runPersona(personaId, prompt) {
    const persona = this.registry.get(personaId);
    if (!persona || persona.type !== 'persona') {
        const a = this.registry.get(personaId);
        if (a?.headless && a?.available) { 
            await this.orchestrator.runOn(personaId, prompt, this.cwd); 
            return; 
        }
        console.log(chalk.red(`  Unknown: @${personaId}. /personas`));
        return;
    }
    
    this.addActivePersona(personaId);
    
    // Get tool to use
    const toolId = persona.uses_tool === 'auto' 
        ? this.orchestrator.route(prompt)?.agent || 'copilot'
        : persona.uses_tool;
    
    this.conversationLog.push({ role: 'user', persona: personaId, text: prompt, ts: Date.now() });
    console.log(chalk.hex(persona.color)(`  ${persona.icon} ${persona.name}`) +
        chalk.dim(` via ${toolId}`));
    
    // NEW: Enhanced prompt with subagent capabilities
    const enhancedPrompt = `${persona.body}

SUBAGENT CAPABILITIES:
You can spawn other personas as subagents for parallel work:
- Use: "Invoking N subagents: @architect, @designer, @planner"
- They run in parallel and return results
- You coordinate and integrate outputs

INTERACTIVE MODE:
You can ask user for input/confirmation:
- "Continue with brainstorming? Or switch to @planner?"
- "Should I spawn @devops for deployment?"
- Wait for user response before proceeding

PERSONA SWITCHING:
You can hand off to other personas:
- "Handing off to @architect for system design"
- "Switching to @developer mode for implementation"

User: ${prompt}`;
    
    try { 
        await this.orchestrator.runOn(toolId, enhancedPrompt, this.cwd); 
    } catch (err) { 
        console.error(chalk.red(`  Error: ${err.message}`)); 
    }
    
    this.removeActivePersona(personaId);
}
```

---

### 2. Add Interactive Prompt Handler

**File**: `src/session.js`

Add new method after `runPersona`:

```javascript
async handlePersonaQuestion(question, options) {
    console.log(chalk.yellow(`\n  ${question}`));
    
    if (options && options.length > 0) {
        options.forEach((opt, i) => {
            console.log(chalk.cyan(`    ${i + 1}. ${opt}`));
        });
    }
    
    console.log(chalk.dim(`\n  Your choice: `));
    
    // Wait for user input
    return new Promise((resolve) => {
        this.rl.question('', (answer) => {
            resolve(answer.trim());
        });
    });
}
```

---

### 3. Add Subagent Spawning Logic

**File**: `src/orchestrator/router.js`

Add new method:

```javascript
async spawnSubagents(personas, prompt, cwd) {
    console.log(chalk.cyan(`\n  Invoking ${personas.length} subagents in parallel`));
    
    const results = await Promise.all(
        personas.map(async (personaId) => {
            const persona = this.registry.get(personaId);
            if (!persona) return null;
            
            console.log(chalk.dim(`    ✓ ${persona.icon} @${personaId}: ${prompt.substring(0, 60)}...`));
            
            const startTime = Date.now();
            
            // Run persona
            const toolId = persona.uses_tool === 'auto' 
                ? this.route(prompt)?.agent || 'copilot'
                : persona.uses_tool;
            
            const result = await this.runOn(toolId, `${persona.body}\n\nUser: ${prompt}`, cwd);
            
            const duration = ((Date.now() - startTime) / 1000).toFixed(2);
            console.log(chalk.green(`    ↳ done (${duration}s)`));
            
            return { persona: personaId, result, duration };
        })
    );
    
    const totalTime = results.reduce((sum, r) => sum + parseFloat(r.duration), 0).toFixed(2);
    console.log(chalk.dim(`\n  - Completed in ${totalTime}s\n`));
    
    return results.filter(r => r !== null);
}
```

---

### 4. Update All Persona Templates

Add to **every persona file** (after the main description):

```markdown
## Subagent Capabilities

You can spawn other personas as subagents for parallel work:

### Example: Spawn Multiple Personas
```
Invoking 3 subagents in parallel:
  @architect - Design system architecture
  @designer - Create UI mockups
  @planner - Break down sprint tasks
```

### Example: Ask for User Input
```
I've completed brainstorming. What would you like to do next?
  1. Continue with detailed planning (@planner)
  2. Switch to architecture design (@architect)
  3. Start implementation (@developer)
  
Your choice:
```

### Example: Hand Off to Another Persona
```
Brainstorming complete! Handing off to @planner for sprint breakdown.
```

## Available Personas to Spawn

- @architect - System architecture, APIs, databases
- @designer - UI/UX, wireframes, design systems
- @planner - Sprint planning, task breakdown
- @researcher - Find tools, APIs, compare options
- @strategist - Business strategy, market analysis
- @devops - Infrastructure, CI/CD, deployment
- @qa - Test strategy, edge cases
- @security - Security audit, threat modeling
- @pm - Product roadmap, prioritization
- @presenter - Pitch decks, demo scripts
- @datascientist - ML pipelines, analytics
- @techwriter - Documentation, READMEs
- @problemsolver - Root cause analysis
- @brainstorm - Ideation, creative thinking
- @analyst - Requirements, user stories
- @contentwriter - Blogs, marketing copy
- @storyteller - Narratives, pitches
- @scrum - Sprint planning, standups
- @tester - Test automation, quality gates
- @teacher - Explanations, tutorials
- @evaluator - Problem statement analysis
- @innovator - Blue ocean strategy
- @master - Orchestrate all personas

## Interactive Workflow

1. **Start with your expertise**
2. **Identify what else is needed**
3. **Spawn subagents for parallel work**
4. **Ask user for confirmation if needed**
5. **Integrate results**
6. **Hand off to next persona if appropriate**
```

---

### 5. Add Thinking Process Toggle

**File**: `src/session.js`

Add to constructor:

```javascript
constructor(registry, orchestrator, cwd) {
    // ... existing code ...
    
    this.showThinking = false; // Toggle with arrow keys
    
    // Add keyboard listener
    process.stdin.on('keypress', (str, key) => {
        if (key.name === 'up' || key.name === 'down') {
            this.showThinking = !this.showThinking;
            console.log(chalk.dim(`\n  [Thinking process: ${this.showThinking ? 'ON' : 'OFF'}]\n`));
        }
    });
}
```

Add thinking output in `runPersona`:

```javascript
if (this.showThinking) {
    console.log(chalk.dim(`\n  💭 Thinking: Analyzing prompt and determining approach...\n`));
}
```

---

## Implementation Script

Create `enhance-personas.js`:

```javascript
#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { readdirSync } from 'fs';

const subagentSection = `

## 🤖 Subagent Capabilities

You can spawn other personas as subagents for parallel work:

**Example: Spawn Multiple Personas**
\`\`\`
Invoking 3 subagents in parallel:
  @architect - Design system architecture
  @designer - Create UI mockups  
  @planner - Break down sprint tasks
\`\`\`

**Example: Ask for User Input**
\`\`\`
I've completed brainstorming. What would you like to do next?
  1. Continue with detailed planning (@planner)
  2. Switch to architecture design (@architect)
  3. Start implementation
  
Your choice:
\`\`\`

**Example: Hand Off**
\`\`\`
Brainstorming complete! Handing off to @planner for sprint breakdown.
\`\`\`

**Available Personas**: @architect, @designer, @planner, @researcher, @strategist, @devops, @qa, @security, @pm, @presenter, @datascientist, @techwriter, @problemsolver, @brainstorm, @analyst, @contentwriter, @storyteller, @scrum, @tester, @teacher, @evaluator, @innovator, @master
`;

const agentsDir = 'defaults/agents';
const files = readdirSync(agentsDir).filter(f => f.endsWith('.md'));

console.log('🔧 Adding subagent capabilities to all personas...\n');

for (const file of files) {
    const path = join(agentsDir, file);
    let content = readFileSync(path, 'utf-8');
    
    // Skip if already has subagent section
    if (content.includes('Subagent Capabilities')) {
        console.log(`  ⏭️  Skipped: ${file} (already has subagents)`);
        continue;
    }
    
    // Add subagent section before the last line
    content = content.trim() + subagentSection;
    
    writeFileSync(path, content, 'utf-8');
    console.log(`  ✅ Enhanced: ${file}`);
}

console.log('\n✅ All personas enhanced with subagent capabilities!\n');
```

---

## Usage Examples

### Example 1: Brainstorm with Subagents

```bash
$ soupz-stall

> @brainstorm generate ideas for a productivity app

💭 Thinking: I'll generate ideas, then spawn @evaluator to score them

Invoking 2 subagents in parallel:
  ✓ @brainstorm: Generate 20 creative ideas
  ↳ done (15.2s)
  
  ✓ @evaluator: Score ideas on feasibility
  ↳ done (12.5s)

- Completed in 27.7s

Here are the top 5 ideas with scores...

What would you like to do next?
  1. Continue with detailed planning (@planner)
  2. Design the architecture (@architect)
  3. Create UI mockups (@designer)

Your choice: _
```

### Example 2: Architect with Parallel Design

```bash
> @architect design a todo app

💭 Thinking: I'll design architecture and spawn @designer for UI in parallel

Invoking 2 subagents in parallel:
  ✓ @architect: System architecture + database schema
  ↳ done (18.3s)
  
  ✓ @designer: UI/UX flows + wireframes
  ↳ done (16.7s)

- Completed in 35.0s

Architecture complete! Should I spawn @devops for deployment setup?
  1. Yes, spawn @devops
  2. No, I'll handle it
  3. Spawn @planner for sprint breakdown

Your choice: _
```

### Example 3: Master with Full Orchestration

```bash
> @master [paste 50-line problem statement]

💭 Thinking: Complex project. Spawning 5 personas in Batch 1...

Batch 1 - Invoking 5 subagents in parallel:
  ✓ @architect: System design
  ↳ done (22.1s)
  
  ✓ @designer: UI/UX design
  ↳ done (19.5s)
  
  ✓ @planner: Sprint breakdown
  ↳ done (25.3s)
  
  ✓ @researcher: Tool recommendations
  ↳ done (18.7s)
  
  ✓ @strategist: Winning strategy
  ↳ done (21.2s)

- Batch 1 completed in 106.8s

Batch 2 - Invoking 5 subagents in parallel:
  ✓ @devops: Infrastructure setup
  ✓ @qa: Test strategy
  ✓ @security: Security audit
  ✓ @pm: Feature prioritization
  ✓ @presenter: Pitch deck

- Batch 2 completed in 98.4s

Master plan complete! Total time: 205.2s
```

---

## Keyboard Controls

- **↑/↓ arrows**: Toggle thinking process display
- **Ctrl+C**: Cancel current operation
- **Enter**: Confirm choice/continue

---

## Benefits

✅ **All personas** can spawn subagents (not just Master)
✅ **Interactive mode** - personas can ask for input
✅ **Dynamic switching** - hand off between personas
✅ **Parallel execution** - multiple personas at once
✅ **Thinking process** - toggle visibility
✅ **Human-like workflow** - just like Kiro!

---

## Next Steps

1. Run `node enhance-personas.js` to add subagent capabilities to all personas
2. Update `src/session.js` with interactive handlers
3. Update `src/orchestrator/router.js` with subagent spawning
4. Test with `@brainstorm` or `@architect`

---

**Every persona is now a team player!** 🤖🤝🤖
