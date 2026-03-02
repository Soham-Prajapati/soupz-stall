#!/usr/bin/env node

/**
 * Direct Copilot test - build React app
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const testDir = '/Users/shubh/Developer/aiTesting';

console.log('🧪 Testing Copilot Direct Build\n');
console.log('📁 Directory:', testDir);
console.log('🐙 Agent: GitHub Copilot (forced)');
console.log('💰 Model: GPT-5 mini (free)\n');

// Clean test directory
if (fs.existsSync(testDir)) {
    const files = fs.readdirSync(testDir);
    for (const file of files) {
        if (!file.startsWith('.') && file !== 'test_output.log' && !file.endsWith('.md') && !file.endsWith('.js') && !file.endsWith('.exp') && !file.endsWith('.sh') && !file.endsWith('.py') && file !== 'prompt.txt') {
            const filePath = path.join(testDir, file);
            const stat = fs.statSync(filePath);
            if (stat.isDirectory()) {
                fs.rmSync(filePath, { recursive: true, force: true });
            } else {
                fs.unlinkSync(filePath);
            }
        }
    }
}

console.log('🧹 Cleaned test directory\n');

const prompt = `Create a React todo app with Vite. Requirements:
- Add/delete/complete tasks
- localStorage persistence
- Tailwind CSS styling
- Under 200 lines total

Files needed:
1. package.json (with react, vite, tailwindcss)
2. vite.config.js
3. index.html
4. src/main.jsx
5. src/App.jsx
6. src/index.css
7. tailwind.config.js
8. postcss.config.js

Create all files in ${testDir}. Use minimal, clean code.`;

console.log('📝 Prompt:', prompt.substring(0, 100) + '...\n');
console.log('🚀 Running: gh copilot -p "..." --allow-all-tools\n');

const copilot = spawn('gh', ['copilot', '-p', prompt, '--allow-all-tools'], {
    cwd: testDir,
    stdio: ['inherit', 'pipe', 'pipe']
});

let output = '';

copilot.stdout.on('data', (data) => {
    const text = data.toString();
    output += text;
    process.stdout.write(text);
});

copilot.stderr.on('data', (data) => {
    const text = data.toString();
    output += text;
    process.stderr.write(text);
});

copilot.on('close', (code) => {
    console.log(`\n\n✅ Copilot exited with code ${code}\n`);
    
    // Check what files were created
    console.log('📁 Files created:\n');
    const files = fs.readdirSync(testDir);
    const appFiles = files.filter(f => 
        !f.startsWith('.') && 
        !f.endsWith('.log') && 
        !f.endsWith('.md') && 
        !f.endsWith('.js') && 
        !f.endsWith('.exp') && 
        !f.endsWith('.sh') && 
        !f.endsWith('.py') &&
        f !== 'prompt.txt'
    );
    
    if (appFiles.length === 0) {
        console.log('   ❌ No files created!\n');
        console.log('💡 Copilot may not support file creation directly.\n');
        console.log('   Let me create the files manually based on best practices...\n');
        process.exit(1);
    } else {
        appFiles.forEach(file => {
            const stat = fs.statSync(path.join(testDir, file));
            console.log(`   ${stat.isDirectory() ? '📁' : '📄'} ${file}`);
        });
        
        console.log('\n✅ Test complete!\n');
        process.exit(0);
    }
});

// Timeout after 2 minutes
setTimeout(() => {
    console.log('\n⏱️  Timeout reached');
    copilot.kill();
    process.exit(1);
}, 120000);
