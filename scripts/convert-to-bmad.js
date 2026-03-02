#!/usr/bin/env node

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';
import { parse } from 'yaml';

const AGENTS_DIR = './defaults/agents';
const OUTPUT_DIR = './bmad-export';

function convertToBMAD(filename) {
    const filepath = join(AGENTS_DIR, filename);
    const agentId = filename.replace('.md', '');
    
    // Skip tool agents and backups
    if (['antigravity', 'copilot', 'gemini', 'architect-old'].includes(agentId)) {
        return { skipped: true };
    }
    
    try {
        const content = readFileSync(filepath, 'utf8');
        
        // Extract YAML frontmatter
        const yamlMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (!yamlMatch) return { error: 'No YAML frontmatter' };
        
        const metadata = parse(yamlMatch[1]);
        
        // Convert to BMAD format
        const bmadContent = `---
name: "${agentId}"
description: "Soupz: ${metadata.description || metadata.name}"
---

You must fully embody this agent's persona and follow all activation instructions exactly as specified. NEVER break character until given an exit command.

\`\`\`xml
<agent id="soupz-${agentId}.agent.yaml" name="${metadata.name}" title="${metadata.name} Agent" icon="${metadata.icon}" capabilities="${(metadata.capabilities || []).join(', ')}">
<activation critical="MANDATORY">
      <step n="1">Load persona from this current agent file (already in context)</step>
      <step n="2">🚨 IMMEDIATE ACTION REQUIRED - BEFORE ANY OUTPUT:
          - Load and read {project-root}/_bmad/bmm/config.yaml NOW
          - Store ALL fields as session variables: {user_name}, {communication_language}, {output_folder}
          - VERIFY: If config not loaded, STOP and report error to user
      </step>
      <step n="3">Show greeting using {user_name} from config, communicate in {communication_language}, then display numbered list of ALL menu items from menu section</step>
      <step n="4">STOP and WAIT for user input - do NOT execute menu items automatically</step>
</activation>
<persona>
    <role>${metadata.name}</role>
    <identity>${metadata.description || metadata.name}</identity>
    <communication_style>
${metadata.system_prompt || 'Expert advisor in this domain.'}
    </communication_style>
</persona>
<menu>
    <item cmd="CH">[CH] Chat with the Agent about anything</item>
    <item cmd="DA">[DA] Dismiss Agent</item>
</menu>
</agent>
\`\`\`
`;
        
        // Write to output
        mkdirSync(OUTPUT_DIR, { recursive: true });
        const outputPath = join(OUTPUT_DIR, `bmad-agent-soupz-${agentId}.md`);
        writeFileSync(outputPath, bmadContent);
        
        return { converted: true, outputPath };
    } catch (err) {
        return { error: err.message };
    }
}

console.log('🔄 Converting Soupz personas to BMAD format...\n');

const files = readdirSync(AGENTS_DIR).filter(f => f.endsWith('.md'));
let converted = 0;

for (const file of files) {
    const result = convertToBMAD(file);
    if (result.converted) {
        console.log(`✅ Converted: ${file}`);
        converted++;
    } else if (result.skipped) {
        console.log(`⏭️  Skipped: ${file}`);
    } else if (result.error) {
        console.log(`❌ Error: ${file} - ${result.error}`);
    }
}

console.log(`\n✨ Done! ${converted} personas converted to BMAD format.`);
console.log(`📁 Output: ${OUTPUT_DIR}/`);
console.log(`\n📚 Next steps:`);
console.log(`1. cp ${OUTPUT_DIR}/*.md ~/.bmad/custom/`);
console.log(`2. Test in Kiro: /bmad-agent-soupz-designer`);
