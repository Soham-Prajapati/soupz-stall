#!/usr/bin/env node

/**
 * Add subagent capabilities to all personas
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

const subagentSection = `

## 🤖 Subagent Capabilities

You can spawn other personas as subagents for parallel work, ask for user input, and hand off to other personas.

### Spawn Subagents (Parallel Execution)
\`\`\`
Invoking 3 subagents in parallel:
  @architect - Design system architecture
  @designer - Create UI mockups  
  @planner - Break down sprint tasks
\`\`\`

### Ask for User Input (Interactive Mode)
\`\`\`
I've completed brainstorming. What would you like to do next?
  1. Continue with detailed planning (@planner)
  2. Switch to architecture design (@architect)
  3. Start implementation

Your choice:
\`\`\`

### Hand Off to Another Persona
\`\`\`
Brainstorming complete! Handing off to @planner for sprint breakdown.
\`\`\`

### Available Personas
@architect, @designer, @planner, @researcher, @strategist, @devops, @qa, @security, @pm, @presenter, @datascientist, @techwriter, @problemsolver, @brainstorm, @analyst, @contentwriter, @storyteller, @scrum, @tester, @teacher, @evaluator, @innovator, @master

### Workflow Pattern
1. Start with your expertise
2. Identify what else is needed
3. Spawn subagents for parallel work OR ask user for direction
4. Integrate results
5. Hand off to next persona if appropriate

**You are a team player - collaborate with other personas!**
`;

const agentsDir = 'defaults/agents';
const files = readdirSync(agentsDir).filter(f => f.endsWith('.md'));

console.log('🔧 Adding subagent capabilities to all personas...\n');

let enhanced = 0;
let skipped = 0;

for (const file of files) {
    const path = join(agentsDir, file);
    
    try {
        let content = readFileSync(path, 'utf-8');
        
        // Skip if already has subagent section
        if (content.includes('Subagent Capabilities')) {
            console.log(`  ⏭️  Skipped: ${file} (already enhanced)`);
            skipped++;
            continue;
        }
        
        // Add subagent section at the end
        content = content.trim() + '\n' + subagentSection;
        
        writeFileSync(path, content, 'utf-8');
        console.log(`  ✅ Enhanced: ${file}`);
        enhanced++;
        
    } catch (err) {
        console.log(`  ❌ Error: ${file} - ${err.message}`);
    }
}

console.log(`\n📊 Summary:`);
console.log(`  ✅ Enhanced: ${enhanced} personas`);
console.log(`  ⏭️  Skipped: ${skipped} personas`);
console.log(`\n🎉 All personas now have subagent capabilities!\n`);
