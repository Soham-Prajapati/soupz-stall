#!/usr/bin/env node

/**
 * Auto-import Soupz personas to Kiro/BMAD on first run
 * Also registers agents as globally discoverable skills
 */

import { existsSync, mkdirSync, copyFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';
import { registerGlobalSkills } from './skills.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BMAD_DIR = join(homedir(), '.bmad', 'custom');
const KIRO_DIR = join(homedir(), '.kiro', 'steering');
const EXPORT_DIR = join(__dirname, '..', 'bmad-export');

function autoImport() {
    let imported = 0;
    
    // Register skills globally
    try {
        registerGlobalSkills();
    } catch { /* non-fatal */ }
    
    // Import to BMAD
    if (existsSync(EXPORT_DIR)) {
        mkdirSync(BMAD_DIR, { recursive: true });
        mkdirSync(KIRO_DIR, { recursive: true });
        
        const files = readdirSync(EXPORT_DIR).filter(f => f.endsWith('.md'));
        
        for (const file of files) {
            const src = join(EXPORT_DIR, file);
            const bmadDest = join(BMAD_DIR, file);
            const kiroDest = join(KIRO_DIR, file);
            
            // Copy to BMAD
            if (!existsSync(bmadDest)) {
                copyFileSync(src, bmadDest);
                imported++;
            }
            
            // Copy to Kiro
            if (!existsSync(kiroDest)) {
                copyFileSync(src, kiroDest);
            }
        }
    }
    
    return { imported };
}

export { autoImport };
