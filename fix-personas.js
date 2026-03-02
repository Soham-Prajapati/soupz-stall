#!/usr/bin/env node

/**
 * Fix YAML errors in persona files
 * Issue: Colons in list items break YAML parsing
 * Fix: Quote strings that contain colons
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const brokenPersonas = [
    'datascientist.md',
    'devops.md',
    'pm.md',
    'presenter.md',
    'qa.md',
    'researcher.md',
    'security.md',
    'strategist.md',
    'teacher.md'
];

console.log('🔧 Fixing YAML errors in personas...\n');

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
        
        // Fix: Quote lines that have colons after list markers
        // Pattern: "  - Something: Description" -> "  - \"Something: Description\""
        const lines = frontmatter.split('\n');
        const fixed = lines.map(line => {
            // If it's a list item with a colon, quote it
            if (/^\s*-\s+[^"'].*:/.test(line)) {
                // Extract indentation and content
                const indent = line.match(/^(\s*-\s+)/)[1];
                const content = line.substring(indent.length);
                
                // If not already quoted, quote it
                if (!content.startsWith('"') && !content.startsWith("'")) {
                    return `${indent}"${content}"`;
                }
            }
            return line;
        });
        
        // Reconstruct
        const newContent = `---\n${fixed.join('\n')}\n---\n${body}`;
        
        writeFileSync(path, newContent, 'utf-8');
        console.log(`  ✅ Fixed: ${file}`);
        
    } catch (err) {
        console.log(`  ❌ Error fixing ${file}: ${err.message}`);
    }
}

console.log('\n✅ All personas fixed!\n');
