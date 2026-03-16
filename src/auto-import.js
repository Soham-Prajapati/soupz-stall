#!/usr/bin/env node

/**
 * Auto-import Soupz personas to SOUPZ on first run
 * Also registers agents as globally discoverable skills
 */

import { existsSync, mkdirSync, copyFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';
import { registerGlobalSkills } from './skills.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SOUPZ_DIR = join(homedir(), '.soupz', 'custom');
const EXPORT_DIR = join(__dirname, '..', 'soupz-export');

function autoImport() {
    let imported = 0;
    
    // Register skills globally
    try {
        registerGlobalSkills();
    } catch { /* non-fatal */ }
    
    // Import to SOUPZ
    if (existsSync(EXPORT_DIR)) {
        mkdirSync(SOUPZ_DIR, { recursive: true });
        
        const files = readdirSync(EXPORT_DIR).filter(f => f.endsWith('.md'));
        
        for (const file of files) {
            const src = join(EXPORT_DIR, file);
            const soupzDest = join(SOUPZ_DIR, file);
            
            // Copy to SOUPZ
            if (!existsSync(soupzDest)) {
                copyFileSync(src, soupzDest);
                imported++;
            }
        }
    }
    
    return { imported };
}

export { autoImport };
