#!/usr/bin/env node

/**
 * Non-interactive test mode for Soupz-Stall
 * Usage: node test-mode.js "your prompt here"
 */

import { Router } from './src/orchestrator/router.js';
import { AgentRegistry } from './src/core/registry.js';
import { ContextManager } from './src/core/context.js';
import { MemoryManager } from './src/core/memory.js';
import { CostTracker } from './src/core/cost-tracker.js';
import fs from 'fs';
import path from 'path';

const testDir = '/Users/shubh/Developer/aiTesting';

// Initialize components
const registry = new AgentRegistry();
const context = new ContextManager();
const memory = new MemoryManager();
const costTracker = new CostTracker();
const router = new Router(registry, context, memory);

// Load agents
const agentsDir = path.join(process.cwd(), 'defaults/agents');
const agentFiles = fs.readdirSync(agentsDir).filter(f => f.endsWith('.md'));

console.log('🔄 Loading agents...\n');
for (const file of agentFiles) {
    const content = fs.readFileSync(path.join(agentsDir, file), 'utf-8');
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (match) {
        const yaml = match[1];
        const lines = yaml.split('\n');
        const agent = { capabilities: [], routing_keywords: [] };
        
        for (const line of lines) {
            if (line.includes(':')) {
                const [key, value] = line.split(':').map(s => s.trim());
                if (key === 'name') agent.name = value;
                if (key === 'id') agent.id = value;
                if (key === 'icon') agent.icon = value.replace(/"/g, '');
                if (key === 'binary') agent.binary = value;
                if (key === 'headless') agent.headless = value === 'true';
                if (key === 'grade') agent.grade = parseInt(value);
            }
            if (line.includes('- ') && !line.includes(':')) {
                const value = line.replace('- ', '').trim();
                if (lines[lines.indexOf(line) - 1]?.includes('capabilities')) {
                    agent.capabilities.push(value);
                }
                if (lines[lines.indexOf(line) - 1]?.includes('routing_keywords')) {
                    agent.routing_keywords.push(value);
                }
            }
        }
        
        if (agent.id && agent.headless) {
            agent.available = true;
            registry.register(agent);
            console.log(`  ✅ ${agent.icon || '🤖'} ${agent.name || agent.id}`);
        }
    }
}

console.log('\n📊 Loaded agents:', registry.headless().length);
console.log('');

// Get prompt from command line
const prompt = process.argv[2] || 'Build a simple React todo app: Add/delete tasks, mark complete, localStorage, Tailwind CSS. Use React 18 + Vite. Keep under 200 lines. Use FREE Copilot model (GPT-5 mini). Create files in /Users/shubh/Developer/aiTesting. Start now!';

console.log('📝 Prompt:', prompt.substring(0, 100) + '...\n');

// Route the prompt
console.log('🎯 Routing...\n');
const result = router.route(prompt);

if (result) {
    console.log(`✅ Selected Agent: ${result.agent}`);
    console.log(`   Reason: ${result.reason}`);
    console.log(`   Confidence: ${(result.confidence * 100).toFixed(1)}%`);
    
    if (result.alternatives) {
        console.log('\n   Alternatives:');
        result.alternatives.forEach(alt => {
            console.log(`     - ${alt.agent} (score: ${alt.score.toFixed(1)})`);
        });
    }
    
    if (result.scores) {
        console.log('\n📊 All Scores:');
        result.scores.slice(0, 5).forEach(s => {
            console.log(`   ${s.name}: ${s.score.toFixed(1)}`);
        });
    }
    
    console.log('\n✅ Routing test passed!');
    console.log(`\n💡 To actually run this, use: soupz-stall`);
    console.log(`   Then paste the prompt above.`);
} else {
    console.log('❌ No agent selected');
    process.exit(1);
}
