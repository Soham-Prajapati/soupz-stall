#!/usr/bin/env node
/**
 * Register all soupz-agents skills globally
 * Run: node scripts/register-skills.js
 */
import { registerGlobalSkills, getSkills, formatSkillsXml } from '../src/skills.js';

const count = registerGlobalSkills();
console.log(`✓ Registered ${count} skills globally`);
console.log('\nInstalled at: ~/.soupz-agents/skills.json\n');

const skills = getSkills();
const byCategory = {};
for (const s of skills) {
    if (!byCategory[s.category]) byCategory[s.category] = [];
    byCategory[s.category].push(s);
}

for (const [cat, catSkills] of Object.entries(byCategory)) {
    console.log(`  ${cat.toUpperCase()}`);
    for (const s of catSkills) console.log(`    ${s.icon} ${s.invoke.padEnd(18)} ${s.description.slice(0, 55)}`);
}

console.log('\nXML manifest (for Copilot CLI <available_skills> format):');
console.log(formatSkillsXml(skills.slice(0, 3)));
