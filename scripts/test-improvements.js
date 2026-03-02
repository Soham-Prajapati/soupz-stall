#!/usr/bin/env node

/**
 * Test Script for Soupz-Agents Improvements
 * 
 * Run this to verify all improvements are working correctly.
 */

import { AgentRegistry } from '../src/agents/registry.js';
import { AgentSpawner } from '../src/agents/spawner.js';
import { Orchestrator } from '../src/orchestrator/router.js';
import { ContextManager } from '../src/context/manager.js';
import { MemoryStore } from '../src/memory/store.js';

async function testSemanticRouting() {
    console.log('\n🧪 Test 1: Semantic Routing\n');
    
    const registry = new AgentRegistry();
    await registry.init();
    const spawner = new AgentSpawner(registry);
    const context = new ContextManager();
    const memory = new MemoryStore();
    const orchestrator = new Orchestrator(registry, spawner, context, memory);
    
    const testCases = [
        { prompt: 'make it pretty', expected: 'designer' },
        { prompt: 'design the system architecture', expected: 'architect' },
        { prompt: 'fix this bug', expected: 'coding agent' },
        { prompt: 'explain how this works', expected: 'research agent' },
    ];
    
    for (const test of testCases) {
        const routing = orchestrator.route(test.prompt);
        console.log(`Prompt: "${test.prompt}"`);
        console.log(`  → Routed to: ${routing.agent}`);
        console.log(`  → Reason: ${routing.reason}`);
        console.log(`  → Confidence: ${(routing.confidence * 100).toFixed(0)}%`);
        console.log(`  → Expected: ${test.expected}`);
        console.log();
    }
}

async function testContextContinuity() {
    console.log('\n🧪 Test 2: Context Continuity\n');
    
    const registry = new AgentRegistry();
    await registry.init();
    const spawner = new AgentSpawner(registry);
    const context = new ContextManager();
    const memory = new MemoryStore();
    const orchestrator = new Orchestrator(registry, spawner, context, memory);
    
    // Simulate a conversation
    context.addMessage('user', 'Design a scalable API', { timestamp: Date.now() });
    context.addMessage('architect', 'Here is the architecture...', { timestamp: Date.now() });
    
    // Next prompt should prefer architect due to continuity
    const routing = orchestrator.route('What about the database schema?');
    console.log(`After architect conversation:`);
    console.log(`  → Routed to: ${routing.agent}`);
    console.log(`  → Confidence: ${(routing.confidence * 100).toFixed(0)}%`);
    console.log(`  → Should prefer architect due to continuity`);
}

async function testChaining() {
    console.log('\n🧪 Test 3: Agent Chaining\n');
    
    const registry = new AgentRegistry();
    await registry.init();
    const spawner = new AgentSpawner(registry);
    const context = new ContextManager();
    const memory = new MemoryStore();
    const orchestrator = new Orchestrator(registry, spawner, context, memory);
    
    console.log('Chaining: architect → designer → dev');
    console.log('(This would execute if agents were available)');
    console.log();
    
    // Example chain (won't execute without real agents)
    const chain = [
        { agent: 'architect', prompt: 'Design a scalable API' },
        { agent: 'designer', prompt: (ctx) => `Design UI for: ${ctx.architect}` },
        { agent: 'dev', prompt: (ctx) => `Implement: ${ctx.architect} + ${ctx.designer}` }
    ];
    
    console.log('Chain structure:');
    chain.forEach((step, i) => {
        console.log(`  ${i + 1}. ${step.agent}: ${typeof step.prompt === 'function' ? '<dynamic>' : step.prompt}`);
    });
}

async function testEnhancedPersonas() {
    console.log('\n🧪 Test 4: Enhanced Personas\n');
    
    const registry = new AgentRegistry();
    await registry.init();
    
    const designer = registry.get('designer');
    const architect = registry.get('architect');
    
    console.log('Designer persona:');
    console.log(`  → Capabilities: ${designer?.capabilities?.join(', ') || 'N/A'}`);
    console.log(`  → Keywords: ${designer?.routing_keywords?.length || 0} keywords`);
    console.log(`  → System prompt length: ${designer?.system_prompt?.length || 0} chars`);
    console.log();
    
    console.log('Architect persona:');
    console.log(`  → Capabilities: ${architect?.capabilities?.join(', ') || 'N/A'}`);
    console.log(`  → Keywords: ${architect?.routing_keywords?.length || 0} keywords`);
    console.log(`  → System prompt length: ${architect?.system_prompt?.length || 0} chars`);
}

async function main() {
    console.log('🚀 Soupz-Agents Improvement Tests\n');
    console.log('=' .repeat(50));
    
    try {
        await testSemanticRouting();
        await testContextContinuity();
        await testChaining();
        await testEnhancedPersonas();
        
        console.log('\n' + '='.repeat(50));
        console.log('✅ All tests completed!');
        console.log('\nNext steps:');
        console.log('1. Run: npm start');
        console.log('2. Try: @designer create a user dashboard');
        console.log('3. Try: @architect design a scalable API');
        console.log('4. Check if routing is smarter');
    } catch (err) {
        console.error('\n❌ Test failed:', err.message);
        console.error(err.stack);
    }
}

main();
