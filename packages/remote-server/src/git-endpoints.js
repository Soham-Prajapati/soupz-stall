// git-endpoints.js — git status, diff, stage, commit, push, stash, log, mirror routes

import { execSync } from 'child_process';
import { resolve } from 'path';
import {
    app,
    requireAuth,
    REPO_ROOT,
} from './shared.js';

function resolveWorkingDir(candidate) {
    if (!candidate) return REPO_ROOT;
    try {
        return resolve(candidate);
    } catch {
        return REPO_ROOT;
    }
}

// ─── Input sanitization ───────────────────────────────────────────────────────

function sanitizeGitInput(input) {
    if (typeof input !== 'string') return '';
    return input.replace(/[;&|`$(){}[\]<>!#~]/g, '').trim();
}

// ─── Branch endpoints ─────────────────────────────────────────────────────────

app.get('/api/git/branch', requireAuth, (req, res) => {
    const cwd = resolveWorkingDir(req.query.cwd || req.query.root);
    try {
        const current = execSync('git rev-parse --abbrev-ref HEAD', { cwd, encoding: 'utf8', timeout: 3000 }).trim();
        const raw = execSync('git branch --list', { cwd, encoding: 'utf8', timeout: 3000 }).trim();
        const branches = raw.split('\n').map(b => b.replace(/^\*?\s*/, '').trim()).filter(Boolean);
        res.json({ current, branches });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/git/checkout', requireAuth, (req, res) => {
    const { branch } = req.body || {};
    const cwd = resolveWorkingDir(req.body?.cwd || req.body?.root);
    if (!branch) return res.status(400).json({ error: 'Missing branch name' });
    try {
        const sanitized = sanitizeGitInput(branch);
        execSync(`git checkout "${sanitized}"`, { cwd, encoding: 'utf8', timeout: 5000 });
        res.json({ success: true, branch: sanitized });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── GitHub URL parsing ───────────────────────────────────────────────────────

function parseGithubUrl(url) {
    if (!url) return null;
    let u = url.trim();
    if (u.endsWith('.git')) u = u.slice(0, -4);

    // https://github.com/owner/repo
    if (u.includes('github.com/')) {
        const parts = u.split('github.com/')[1].split('/');
        return { owner: parts[0], repo: parts[1] };
    }

    // git@github.com:owner/repo
    if (u.includes('github.com:')) {
        const parts = u.split('github.com:')[1].split('/');
        return { owner: parts[0], repo: parts[1] };
    }

    return null;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// AUTHENTICATED: Changed files for dashboard drawer
app.get('/api/changes', requireAuth, (req, res) => {
    const cwd = resolveWorkingDir(req.query.root || req.query.cwd);
    try {
        const out = execSync('git status --porcelain', { cwd, timeout: 4000 }).toString();
        const lines = out.split('\n').map((l) => l.trimEnd()).filter(Boolean);
        const staged = [];
        const unstaged = [];

        lines.forEach((line) => {
            const statusCode = line.slice(0, 2);
            const path = line.slice(3).trim();
            const indexStatus = statusCode[0];
            const workTreeStatus = statusCode[1];

            if (indexStatus !== ' ' && indexStatus !== '?') {
                staged.push({ path, type: indexStatus });
            }
            if (workTreeStatus !== ' ' && workTreeStatus !== '?') {
                unstaged.push({ path, type: workTreeStatus });
            }
            if (statusCode === '??') {
                unstaged.push({ path, type: 'U' });
            }
        });

        let branch = 'main';
        try {
            branch = execSync('git branch --show-current', { cwd, timeout: 2000 }).toString().trim() || 'main';
        } catch { /* fallback to main */ }

        const porcelain = lines;
        res.json({ staged, unstaged, branch, porcelain });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// AUTHENTICATED: Unified diff for one file
app.get('/api/changes/diff', requireAuth, (req, res) => {
    const file = (req.query.file || '').toString().trim();
    const cwd = resolveWorkingDir(req.query.root || req.query.cwd);
    try {
        const escaped = file ? file.replace(/"/g, '\\"') : '';
        const cmd = file ? `git --no-pager diff -- "${escaped}"` : 'git --no-pager diff';
        const diff = execSync(cmd, { cwd, timeout: 4000 }).toString();
        res.json({ file: file || null, diff: diff || 'Working tree clean.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/git/stage — stage a file (authenticated)
app.post('/api/git/stage', requireAuth, (req, res) => {
    const { path: filePath, root } = req.body;
    const cwd = resolveWorkingDir(root || req.body?.cwd);
    try {
        execSync(`git add -- "${filePath}"`, { cwd, timeout: 5000 });
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/git/commit (authenticated)
app.post('/api/git/commit', requireAuth, (req, res) => {
    const { message, root } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'Commit message required' });
    const cwd = resolveWorkingDir(root || req.body?.cwd);
    try {
        execSync(`git commit -m ${JSON.stringify(message)}`, { cwd, timeout: 10000 });
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/git/push (authenticated)
app.post('/api/git/push', requireAuth, (req, res) => {
    const { root } = req.body || {};
    const cwd = resolveWorkingDir(root || req.body?.cwd);
    try {
        const result = execSync('git push', { cwd, timeout: 30000 }).toString();
        res.json({ ok: true, output: result });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/git/stash — list stashes
app.get('/api/git/stash', requireAuth, (req, res) => {
    const cwd = resolveWorkingDir(req.query.cwd || req.query.root);
    try {
        const raw = execSync('git stash list', { cwd, encoding: 'utf8', timeout: 5000 }).trim();
        const stashes = raw ? raw.split('\n').map((line, i) => ({ index: i, description: line })) : [];
        res.json({ stashes });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/git/stash — create a stash
app.post('/api/git/stash', requireAuth, (req, res) => {
    const cwd = resolveWorkingDir(req.body?.cwd || req.body?.root);
    const message = sanitizeGitInput(req.body.message || '');
    try {
        const cmd = message ? `git stash push -m "${message}"` : 'git stash push';
        execSync(cmd, { cwd, encoding: 'utf8', timeout: 10000 });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/git/stash/pop — pop top stash
app.post('/api/git/stash/pop', requireAuth, (req, res) => {
    const cwd = resolveWorkingDir(req.body?.cwd || req.body?.root);
    try {
        execSync('git stash pop', { cwd, encoding: 'utf8', timeout: 10000 });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/git/log — recent commit history
app.get('/api/git/log', requireAuth, (req, res) => {
    const cwd = resolveWorkingDir(req.query.cwd || req.query.root);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    try {
        const raw = execSync(`git log --oneline --format="%H|||%s|||%an|||%ai" -${limit}`, { cwd, encoding: 'utf8', timeout: 10000 }).trim();
        const commits = raw ? raw.split('\n').map(line => {
            const [hash, message, author, date] = line.split('|||');
            return { hash, message, author, date };
        }) : [];
        res.json({ commits });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/git/mirror/manifest — Fetch repository tree from GitHub (Fallback Mode)
app.get('/api/git/mirror/manifest', requireAuth, async (req, res) => {
    const root = resolve(req.query.root || REPO_ROOT || process.cwd());
    try {
        const remoteUrl = execSync('git remote get-url origin', { cwd: root, timeout: 3000 }).toString().trim();
        const info = parseGithubUrl(remoteUrl);
        if (!info) return res.status(400).json({ error: 'Not a GitHub repository' });

        let branch = 'main';
        try {
            branch = execSync('git branch --show-current', { cwd: root, timeout: 2000 }).toString().trim() || 'main';
        } catch { /* fallback to main */ }

        const cmd = `gh api repos/${info.owner}/${info.repo}/git/trees/${branch}?recursive=1`;
        const tree = JSON.parse(execSync(cmd, { timeout: 10000 }).toString());
        res.json({ ...tree, owner: info.owner, repo: info.repo, branch });
    } catch (err) {
        res.status(500).json({ error: `GitHub Mirror Manifest failed: ${err.message}` });
    }
});

// GET /api/git/mirror/file — Fetch raw file content from GitHub (Fallback Mode)
app.get('/api/git/mirror/file', requireAuth, async (req, res) => {
    const root = resolve(req.query.root || REPO_ROOT || process.cwd());
    const filePath = (req.query.path || '').toString().trim();
    if (!filePath) return res.status(400).json({ error: 'Missing path' });

    try {
        const remoteUrl = execSync('git remote get-url origin', { cwd: root, timeout: 3000 }).toString().trim();
        const info = parseGithubUrl(remoteUrl);
        if (!info) return res.status(400).json({ error: 'Not a GitHub repository' });

        const cmd = `gh api repos/${info.owner}/${info.repo}/contents/${filePath}`;
        const data = JSON.parse(execSync(cmd, { timeout: 10000 }).toString());

        if (data.encoding === 'base64') {
            const content = Buffer.from(data.content, 'base64').toString('utf8');
            res.json({ content, path: filePath, sha: data.sha });
        } else {
            res.json(data);
        }
    } catch (err) {
        res.status(500).json({ error: `GitHub Mirror File fetch failed: ${err.message}` });
    }
});
