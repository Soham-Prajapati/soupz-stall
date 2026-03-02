#!/usr/bin/env node

/**
 * Simple routing test for Soupz-Stall
 */

import { SemanticRouter } from './src/orchestrator/semantic-router.js';
import fs from 'fs';
import path from 'path';

console.log('🧪 Testing Soupz-Stall Routing\n');

// Mock registry
const mockRegistry = {
    agents: [],
    headless() {
        return this.agents.filter(a => a.headless && a.available);
    },
    get(id) {
        return this.agents.find(a => a.id === id);
    },
    register(agent) {
        this.agents.push(agent);
    }
};

// Load agents from files
const agentsDir = path.join(process.cwd(), 'defaults/agents');
const agentFiles = fs.readdirSync(agentsDir).filter(f => f.endsWith('.md'));

console.log('📁 Loading agents from:', agentsDir, '\n');

for (const file of agentFiles) {
    const content = fs.readFileSync(path.join(agentsDir, file), 'utf-8');
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (match) {
        const yaml = match[1];
        const agent = {
            capabilities: [],
            routing_keywords: [],
            headless: false,
            available: false,
            grade: 50,
            usage_count: 0
        };
        
        // Parse YAML manually
        const lines = yaml.split('\n');
        let currentArray = null;
        
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.includes(':') && !trimmed.startsWith('-')) {
                const [key, ...valueParts] = trimmed.split(':');
                const value = valueParts.join(':').trim();
                
                if (key === 'name') agent.name = value;
                else if (key === 'id') agent.id = value;
                else if (key === 'icon') agent.icon = value.replace(/"/g, '');
                else if (key === 'binary') agent.binary = value;
                else if (key === 'headless') agent.headless = value === 'true';
                else if (key === 'grade') agent.grade = parseInt(value) || 50;
                else if (key === 'capabilities') currentArray = 'capabilities';
                else if (key === 'routing_keywords') currentArray = 'routing_keywords';
                else currentArray = null;
            } else if (trimmed.startsWith('-') && currentArray) {
                const value = trimmed.replace(/^-\s*/, '').trim();
                if (value) agent[currentArray].push(value);
            }
        }
        
        if (agent.id && agent.headless) {
            agent.available = true;
            mockRegistry.register(agent);
            console.log(`  ✅ ${agent.icon || '🤖'} ${agent.name || agent.id}`);
        }
    }
}

console.log(`\n📊 Loaded ${mockRegistry.headless().length} agents\n`);

// Create router
const router = new SemanticRouter(mockRegistry, null, null);

// Test prompts
const testPrompts = [
    {
        name: 'Build React App',
        prompt: 'Build a simple React todo app: Add/delete tasks, mark complete, localStorage, Tailwind CSS. Use React 18 + Vite. Keep under 200 lines. Use FREE Copilot model (GPT-5 mini). Create files in /Users/shubh/Developer/aiTesting. Start now!',
        expected: 'copilot'
    },
    {
        name: 'Analyze Files',
        prompt: 'analyze the files in this directory',
        expected: 'kiro'
    },
    {
        name: 'Search Code',
        prompt: 'search for useState in all files',
        expected: 'kiro'
    },
    {
        name: 'Design UI',
        prompt: 'design a beautiful user interface',
        expected: 'designer' // Should NOT be antigravity
    },
    {
        name: 'AWS Deploy',
        prompt: 'deploy to AWS Lambda',
        expected: 'kiro'
    }
];

console.log('🎯 Testing Routing:\n');

let passed = 0;
let failed = 0;

for (const test of testPrompts) {
    console.log(`\n📝 Test: ${test.name}`);
    console.log(`   Prompt: "${test.prompt.substring(0, 60)}..."`);
    
    const result = router.route(test.prompt);
    
    if (result) {
        console.log(`   ✅ Routed to: ${result.agent}`);
        console.log(`   Reason: ${result.reason}`);
        console.log(`   Confidence: ${(result.confidence * 100).toFixed(1)}%`);
        
        if (result.scores) {
            console.log(`   Top 3:`);
            result.scores.slice(0, 3).forEach((s, i) => {
                console.log(`     ${i + 1}. ${s.name} (${s.score.toFixed(1)})`);
            });
        }
        
        // Check if it matches expected (if specified)
        if (test.expected) {
            if (result.agent === test.expected || result.scores[0].agent === test.expected) {
                console.log(`   ✅ PASS: Matched expected agent`);
                passed++;
            } else {
                console.log(`   ❌ FAIL: Expected ${test.expected}, got ${result.agent}`);
                failed++;
            }
        } else {
            passed++;
        }
    } else {
        console.log(`   ❌ No agent selected`);
        failed++;
    }
}

console.log(`\n\n📊 Results: ${passed} passed, ${failed} failed\n`);

if (failed === 0) {
    console.log('✅ All routing tests passed!\n');
    process.exit(0);
} else {
    console.log('❌ Some tests failed\n');
    process.exit(1);
}
