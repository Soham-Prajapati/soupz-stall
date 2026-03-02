#!/usr/bin/env node

/**
 * Fix personas by moving system_prompt from frontmatter to body
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const brokenPersonas = [
    'devops.md',
    'pm.md',
    'presenter.md',
    'qa.md',
    'researcher.md',
    'security.md',
    'strategist.md',
    'teacher.md'
];

console.log('🔧 Fixing persona structure...\n');

for (const file of brokenPersonas) {
    const path = join(process.cwd(), 'defaults/agents', file);
    
    try {
        let content = readFileSync(path, 'utf-8');
        
        // Find the frontmatter
        const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
        if (!match) {
            console.log(`  ⚠️  ${file}: No frontmatter found`);
            continue;
        }
        
        let [, frontmatter, body] = match;
        
        // Remove system_prompt from frontmatter and extract it
        const lines = frontmatter.split('\n');
        const newFrontmatter = [];
        let inSystemPrompt = false;
        let systemPromptContent = '';
        
        for (const line of lines) {
            if (line.startsWith('system_prompt:')) {
                inSystemPrompt = true;
                continue;
            }
            
            if (inSystemPrompt) {
                if (line.startsWith('  ') || line.trim() === '') {
                    // Part of system_prompt
                    systemPromptContent += line.substring(2) + '\n';
                } else {
                    // End of system_prompt
                    inSystemPrompt = false;
                    newFrontmatter.push(line);
                }
            } else {
                newFrontmatter.push(line);
            }
        }
        
        // Prepend system prompt to body
        const newBody = systemPromptContent.trim() + '\n\n' + body.trim();
        
        // Reconstruct
        const newContent = `---\n${newFrontmatter.join('\n')}\n---\n\n${newBody}\n`;
        
        writeFileSync(path, newContent, 'utf-8');
        console.log(`  ✅ Fixed: ${file}`);
        
    } catch (err) {
        console.log(`  ❌ Error fixing ${file}: ${err.message}`);
    }
}

console.log('\n✅ All personas fixed!\n');
