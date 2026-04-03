// filesystem.js — terminal routes, file system API routes, file watcher

import { execSync } from 'child_process';
import { readdir, readFile, writeFile, stat, mkdir, watch } from 'fs/promises';
import { existsSync, readFileSync, statSync } from 'fs';
import { join, resolve, relative, dirname } from 'path';
import os from 'os';
import {
    app,
    ctx,
    requireAuth,
    pty,
    REPO_ROOT,
    IGNORED_DIRS,
    MAX_FILE_SIZE,
    MAX_TERMINALS,
    TERMINAL_BUFFER_MAX_LINES,
    terminals,
    nextTerminalId,
    buildTerminalSummary,
    terminateTerminal,
    getCachedFile,
    setCachedFile,
    invalidateCachedFile,
    broadcast,
} from './shared.js';

// ─── File watcher ─────────────────────────────────────────────────────────────

let watcherDebounceTimer = null;
let watcherPendingChanges = new Set();

export async function startFileWatcher() {
    if (ctx.fileWatcherTask) return;
    ctx.fileWatcherAbortController = new AbortController();
    const signal = ctx.fileWatcherAbortController.signal;

    ctx.fileWatcherTask = (async () => {
        try {
            const watcher = watch(REPO_ROOT, { recursive: true, signal });
            console.log(`  👁  Watcher active on: ${REPO_ROOT}`);
            for await (const event of watcher) {
                if (event.filename && !event.filename.includes('node_modules') && !event.filename.includes('.git')) {
                    const changedPath = resolve(REPO_ROOT, event.filename);
                    invalidateCachedFile(changedPath);
                    watcherPendingChanges.add(event.filename);
                    if (!watcherDebounceTimer) {
                        watcherDebounceTimer = setTimeout(() => {
                            for (const file of watcherPendingChanges) {
                                broadcast({ type: 'FILE_CHANGED', path: file });
                            }
                            watcherPendingChanges.clear();
                            watcherDebounceTimer = null;
                        }, 100);
                    }
                }
            }
        } catch (err) {
            if (err?.name === 'AbortError') return;
            console.error('  ✖ File watcher failed:', err.message);
        }
    })();
}

export function stopFileWatcher() {
    if (ctx.fileWatcherAbortController) {
        try { ctx.fileWatcherAbortController.abort(); } catch {}
    }
    ctx.fileWatcherAbortController = null;
    ctx.fileWatcherTask = null;
}

// ─── File tree builder ────────────────────────────────────────────────────────

export async function buildFileTree(dirPath, rootPath, depth = 0) {
    if (depth > 6) return null;
    const entries = await readdir(dirPath, { withFileTypes: true });

    const childrenPromises = entries.map(async (entry) => {
        if (IGNORED_DIRS.has(entry.name) || entry.name.startsWith('.')) return null;
        const fullPath = join(dirPath, entry.name);
        const relPath = relative(rootPath, fullPath);
        if (entry.isDirectory()) {
            const subtree = await buildFileTree(fullPath, rootPath, depth + 1);
            if (subtree) return { name: entry.name, path: relPath, type: 'directory', children: subtree.children };
        } else {
            try {
                const fileStats = statSync(fullPath);
                return { name: entry.name, path: relPath, type: 'file', size: fileStats.size };
            } catch {
                return { name: entry.name, path: relPath, type: 'file' };
            }
        }
        return null;
    });

    const children = (await Promise.all(childrenPromises)).filter(Boolean);

    children.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
        return a.name.localeCompare(b.name);
    });

    if (children.length > 500) {
        return { name: dirPath, path: relative(rootPath, dirPath) || '.', type: 'directory', children: children.slice(0, 500), hasMore: true, totalCount: children.length };
    }
    return { name: dirPath, path: relative(rootPath, dirPath) || '.', type: 'directory', children };
}

// ─── Terminal routes ──────────────────────────────────────────────────────────

// AUTHENTICATED: List terminals
app.get('/terminals', requireAuth, (req, res) => {
    const list = [];
    for (const [id, t] of terminals) {
        list.push(buildTerminalSummary(id, t));
    }
    res.json(list);
});

// AUTHENTICATED: Create terminal
app.post('/terminal', requireAuth, (req, res) => {
    if (!pty) return res.status(503).json({ error: 'Terminal unavailable (node-pty not installed)' });
    if (terminals.size >= MAX_TERMINALS) {
        return res.status(429).json({ error: `Maximum ${MAX_TERMINALS} terminals allowed` });
    }
    const id = nextTerminalId();
    const shell = process.env.SHELL || (os.platform() === 'win32' ? 'powershell.exe' : 'bash');
    const proc = pty.spawn(shell, [], {
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        cwd: process.cwd(),
        env: process.env,
    });

    const terminal = { id, proc, buffer: [], listeners: new Set(), createdAt: Date.now(), lastActivity: Date.now() };

    proc.onData((data) => {
        terminal.buffer.push(data);
        terminal.lastActivity = Date.now();
        if (terminal.buffer.length > TERMINAL_BUFFER_MAX_LINES) terminal.buffer = terminal.buffer.slice(-TERMINAL_BUFFER_MAX_LINES);
        for (const ws of terminal.listeners) {
            ws.send(JSON.stringify({ type: 'output', terminalId: id, data }));
        }
    });

    proc.onExit(({ exitCode }) => {
        for (const ws of terminal.listeners) {
            ws.send(JSON.stringify({ type: 'exit', terminalId: id, code: exitCode }));
        }
        terminals.delete(id);
    });

    terminals.set(id, terminal);
    res.json({ id, pid: proc.pid });
});

// AUTHENTICATED: Kill terminal by id
app.delete('/terminals/:id', requireAuth, (req, res) => {
    const result = terminateTerminal(req.params.id);
    if (!result.ok && result.reason === 'not_found') {
        return res.status(404).json({ error: 'Terminal not found' });
    }
    if (!result.ok) {
        return res.status(400).json({ error: 'Invalid terminal id' });
    }
    return res.json({ ok: true, id: result.id });
});

// ─── Filesystem routes ────────────────────────────────────────────────────────

// POST /api/fs/init — initialize a new project directory (authenticated)
app.post('/api/fs/init', requireAuth, async (req, res) => {
    const { name, path: parentPath, supabase: useSupabase, github: useGithub } = req.body;
    const parent = resolve(parentPath || os.homedir());
    const projectPath = join(parent, name);

    if (existsSync(projectPath)) {
        return res.status(400).json({ error: 'Directory already exists' });
    }

    try {
        await mkdir(projectPath, { recursive: true });

        if (useGithub) {
            try {
                execSync('git init', { cwd: projectPath, timeout: 5000 });
            } catch (e) {
                console.error('Git init failed:', e.message);
            }
        }

        if (useSupabase) {
            try {
                execSync('supabase init', { cwd: projectPath, timeout: 10000 });
            } catch (e) {
                console.error('Supabase init failed:', e.message);
                await mkdir(join(projectPath, 'supabase'), { recursive: true });
                await writeFile(join(projectPath, 'supabase/config.toml'), '# Supabase configuration\n', 'utf8');
            }
        }

        await writeFile(join(projectPath, 'README.md'), `# ${name}\n\nProject initialized by Soupz.\n`, 'utf8');

        res.json({ ok: true, path: projectPath });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/dev-server — detect running dev server for live preview (authenticated)
app.get('/api/dev-server', requireAuth, async (req, res) => {
    const preferredPorts = [3000, 3001, 4200, 5173, 5174, 8000, 8080, 8888];
    const internalPorts = [7534, 7070, 7533];
    const ports = [...preferredPorts, ...internalPorts];
    const requestedCwd = String(req.query?.cwd || '').trim().toLowerCase();
    const isSoupzWorkspace = requestedCwd.includes('/soupz-agents');
    const filterSoupzSelf = !isSoupzWorkspace;
    const soupzHtmlSignature = /soupz\s+command\s+studio|soupz\s+core\s+console|soupz\.vercel\.app|content=\"soupz|>\s*soupz\s*<|apple-mobile-web-app-title\"\s+content=\"soupz/i;

    const checks = ports.map(async (port) => {
        try {
            const controller = new AbortController();
            setTimeout(() => controller.abort(), 1200);
            const r = await fetch(`http://localhost:${port}`, { signal: controller.signal });
            if (!(r.ok || r.status === 304)) return null;

            const contentType = String(r.headers.get('content-type') || '').toLowerCase();
            if (contentType.includes('text/html')) {
                const body = (await r.text()).slice(0, 6000);
                if (filterSoupzSelf && soupzHtmlSignature.test(body)) return null;
            }

            return { port, url: `http://localhost:${port}`, detected: true };
        } catch { /* not running */ }
        return null;
    });
    const results = (await Promise.all(checks)).filter(Boolean);
    if (results.length > 0) {
        res.json(results[0]);
    } else {
        res.json({ detected: false, url: null });
    }
});

// GET /api/fs/roots — returns homedir and root drives (authenticated)
app.get('/api/fs/roots', requireAuth, (req, res) => {
    res.json({
        homedir: os.homedir(),
        cwd: process.cwd(),
        platform: os.platform()
    });
});

// GET /api/fs/dirs?path=/home — list directories for folder picker (authenticated)
app.get('/api/fs/dirs', requireAuth, async (req, res) => {
    const dirPath = resolve(req.query.path || os.homedir());
    if (!existsSync(dirPath)) return res.status(404).json({ error: 'Path not found' });
    try {
        const entries = await readdir(dirPath, { withFileTypes: true });
        const dirs = entries
            .filter(e => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules')
            .map(e => ({
                name: e.name,
                path: join(dirPath, e.name),
                isGitRepo: existsSync(join(dirPath, e.name, '.git')),
            }))
            .sort((a, b) => a.name.localeCompare(b.name));
        const isGitRepo = existsSync(join(dirPath, '.git'));
        res.json({ current: dirPath, parent: dirname(dirPath), dirs, isGitRepo });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/usage — Fetch real-time usage metrics from CLI agents (authenticated)
app.get('/api/usage', requireAuth, (req, res) => {
    const agents = ['gemini', 'codex', 'copilot', 'claude', 'kiro'];
    const usage = {};

    for (const agent of agents) {
        try {
            let cmd = '';
            if (agent === 'gemini') cmd = 'gemini --version';
            else if (agent === 'codex') cmd = 'gh copilot --version';
            else if (agent === 'copilot') cmd = 'gh copilot --version';
            else if (agent === 'claude') cmd = 'claude --version';
            else if (agent === 'kiro') cmd = 'kiro-cli --version';

            if (cmd) {
                const out = execSync(cmd, { timeout: 2000 }).toString().trim();
                usage[agent] = { raw: out, timestamp: new Date().toISOString() };
            }
        } catch {
            usage[agent] = { error: 'Unavailable' };
        }
    }
    res.json(usage);
});

// GET /api/fs/tree?root=/path (authenticated)
let lastTreeLogTime = 0;
const TREE_LOG_DEBOUNCE_MS = 30000;

app.get('/api/fs/tree', requireAuth, async (req, res) => {
    const rootPath = resolve(req.query.root || REPO_ROOT || process.cwd());
    if (!existsSync(rootPath)) {
        console.error(`  ✖ File tree requested for non-existent path: ${rootPath}`);
        return res.status(404).json({ error: 'Path not found' });
    }
    try {
        const now = Date.now();
        if (now - lastTreeLogTime > TREE_LOG_DEBOUNCE_MS) {
            console.log(`  📂 Loading file tree for: ${rootPath}`);
            lastTreeLogTime = now;
        }
        const tree = await buildFileTree(rootPath, rootPath);
        let changedFiles = [];
        try {
            const out = execSync('git status --porcelain', { cwd: rootPath, timeout: 3000 }).toString();
            changedFiles = out.split('\n').filter(Boolean);
        } catch { /* not a git repo */ }
        res.json({ tree, changedFiles });
    } catch (err) {
        console.error(`  ✖ Failed to build file tree: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/fs/file?path=/relative/path&root=/root (authenticated)
app.get('/api/fs/file', requireAuth, async (req, res) => {
    const rootPath = resolve(req.query.root || REPO_ROOT || process.cwd());
    const filePath = resolve(rootPath, req.query.path || '');
    if (!filePath.startsWith(rootPath)) return res.status(403).json({ error: 'Access denied' });
    try {
        const cached = getCachedFile(filePath);
        if (cached) {
            return res.set('Cache-Control', 'max-age=5').json({ content: cached, path: req.query.path });
        }

        const fileStatInfo = statSync(filePath);
        if (fileStatInfo.size > MAX_FILE_SIZE) {
            const partial = readFileSync(filePath, { encoding: 'utf8' }).slice(0, MAX_FILE_SIZE);
            return res.json({ content: partial, truncated: true, fullSize: fileStatInfo.size, path: req.query.path });
        }
        const content = await readFile(filePath, 'utf8');

        setCachedFile(filePath, content);

        res.json({ content, path: req.query.path });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/fs/file — write file (authenticated)
app.post('/api/fs/file', requireAuth, async (req, res) => {
    const { path: relPath, content, root } = req.body;
    if (relPath && (relPath.includes('\0') || relPath.includes('..'))) {
        return res.status(400).json({ error: 'Invalid file path' });
    }
    const rootPath = resolve(root || REPO_ROOT || process.cwd());
    const filePath = resolve(rootPath, relPath);
    if (!filePath.startsWith(rootPath)) return res.status(403).json({ error: 'Access denied' });
    try {
        await writeFile(filePath, content, 'utf8');
        invalidateCachedFile(filePath);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
