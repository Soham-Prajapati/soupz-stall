// workspace.js — workspace configuration routes

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import {
    app,
    requireAuth,
    REPO_ROOT,
} from './shared.js';

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/workspace/config — read workspace config (authenticated)
app.get('/api/workspace/config', requireAuth, (req, res) => {
    const cwd = req.query.cwd || REPO_ROOT;
    const configPath = join(cwd, '.soupz', 'config.json');
    try {
        if (!existsSync(configPath)) {
            return res.json({ config: {}, exists: false });
        }
        const raw = readFileSync(configPath, 'utf8');
        const config = JSON.parse(raw);
        res.json({ config, exists: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/workspace/config — write workspace config (authenticated)
app.post('/api/workspace/config', requireAuth, (req, res) => {
    const cwd = req.body.cwd || REPO_ROOT;
    const updates = req.body.config;
    if (!updates || typeof updates !== 'object') {
        return res.status(400).json({ error: 'Missing config object in body' });
    }

    const configDir = join(cwd, '.soupz');
    const configPath = join(configDir, 'config.json');

    try {
        let existing = {};
        if (existsSync(configPath)) {
            existing = JSON.parse(readFileSync(configPath, 'utf8'));
        } else {
            mkdirSync(configDir, { recursive: true });
        }

        const merged = { ...existing, ...updates, updatedAt: new Date().toISOString() };
        writeFileSync(configPath, JSON.stringify(merged, null, 2), 'utf8');

        const gitignorePath = join(cwd, '.gitignore');
        if (existsSync(gitignorePath)) {
            const gitignore = readFileSync(gitignorePath, 'utf8');
            if (!gitignore.includes('.soupz')) {
                writeFileSync(gitignorePath, gitignore.trimEnd() + '\n.soupz/\n', 'utf8');
            }
        }

        res.json({ success: true, config: merged });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
