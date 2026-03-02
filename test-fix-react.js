#!/usr/bin/env node

/**
 * Test soupz-stall fixing the React app
 */

import { spawn } from 'child_process';

const testDir = '/Users/shubh/Developer/aiTesting';

console.log('🧪 Testing Soupz-Stall Fixing React App\n');
console.log('📁 Directory:', testDir);
console.log('❌ Current status: npm run dev fails\n');
console.log('🔧 Error: Cannot find module @vitejs/plugin-react\n');

const prompt = `The React app in ${testDir} is broken. When I run "npm run dev", I get this error:

Error: Cannot find module '@vitejs/plugin-react'

Fix this issue by installing the missing dependency. Then verify it works by running npm run dev.`;

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
    
    // Check if it fixed the issue
    console.log('🧪 Verifying fix...\n');
    
    const verify = spawn('npm', ['run', 'dev'], {
        cwd: testDir,
        stdio: ['inherit', 'pipe', 'pipe']
    });
    
    let verifyOutput = '';
    
    verify.stdout.on('data', (data) => {
        verifyOutput += data.toString();
    });
    
    verify.stderr.on('data', (data) => {
        verifyOutput += data.toString();
    });
    
    setTimeout(() => {
        verify.kill();
        
        if (verifyOutput.includes('ready in') || verifyOutput.includes('Local:')) {
            console.log('\n✅ SUCCESS! React app is now working!\n');
            console.log('🎉 Soupz-Stall (via Copilot) fixed the issue!\n');
        } else if (verifyOutput.includes('Cannot find module')) {
            console.log('\n❌ FAILED! Issue not fixed.\n');
            console.log('Output:', verifyOutput.substring(0, 200));
        } else {
            console.log('\n⚠️  Unclear result. Output:\n');
            console.log(verifyOutput.substring(0, 300));
        }
        
        process.exit(0);
    }, 5000);
});

// Timeout after 2 minutes
setTimeout(() => {
    console.log('\n⏱️  Timeout reached');
    copilot.kill();
    process.exit(1);
}, 120000);
