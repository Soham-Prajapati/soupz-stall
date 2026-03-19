import { existsSync, mkdirSync, readFileSync, readdirSync, copyFileSync } from 'fs';
import { homedir } from 'os';
import { join, dirname } from 'path';
import { execSync } from 'child_process';
import { parse as parseYaml } from 'yaml';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── Paths ──────────────────────────────────────────────────────────────────
export const DATA_DIR = join(homedir(), '.soupz-agents');
export const AGENTS_DIR = join(DATA_DIR, 'agents');
export const AUTH_DIR = join(DATA_DIR, 'auth');
export const CONTEXT_DIR = join(DATA_DIR, 'context');
export const MEMORY_DIR = join(DATA_DIR, 'memory');
export const ANALYTICS_DIR = join(DATA_DIR, 'analytics');
export const DEFAULTS_DIR = join(__dirname, '..', 'defaults', 'agents');

// ─── Ensure directories exist ───────────────────────────────────────────────
export function ensureDirectories() {
    const dirs = [DATA_DIR, AGENTS_DIR, AUTH_DIR, CONTEXT_DIR, MEMORY_DIR,
        join(MEMORY_DIR, 'projects'), ANALYTICS_DIR, join(CONTEXT_DIR, 'archive')];
    for (const dir of dirs) {
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    }
    // Copy default agents if none exist, and sync any new defaults
    const existingAgents = readdirSync(AGENTS_DIR).filter((f) => f.endsWith('.md'));
    if (existsSync(DEFAULTS_DIR)) {
        const defaultAgents = readdirSync(DEFAULTS_DIR).filter((f) => f.endsWith('.md'));
        for (const file of defaultAgents) {
            if (!existingAgents.includes(file)) {
                copyFileSync(join(DEFAULTS_DIR, file), join(AGENTS_DIR, file));
            }
        }
    }
}

// ─── Agent Loader ───────────────────────────────────────────────────────────
export function loadAgentDefinition(filePath) {
    const raw = readFileSync(filePath, 'utf8');
    const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!fmMatch) return null;

    const meta = parseYaml(fmMatch[1]);
    const body = fmMatch[2].trim();

    // Support both 'agent' (new) and 'persona' (legacy) type names
    const isAgentWrapper = meta.type === 'agent' || meta.type === 'persona';
    let agentAvailable = false;
    if (isAgentWrapper) {
        if (meta.uses_tool === 'auto') {
            // Available if any headless tool is installed — check all supported providers
            agentAvailable = !!whichBinary('gemini') || !!whichBinary('gh') || !!whichBinary('claude')
                || !!whichBinary('kiro') || !!whichBinary('aider') || !!process.env.OPENAI_API_KEY
                || !!process.env.ANTHROPIC_API_KEY || !!process.env.GROQ_API_KEY
                || !!process.env.OPENROUTER_API_KEY || !!process.env.GEMINI_API_KEY;
        } else {
            agentAvailable = !!whichBinary(meta.uses_tool);
        }
    }
    return {
        ...meta,
        body,
        filePath,
        binaryPath: isAgentWrapper ? null : whichBinary(meta.binary),
        available: isAgentWrapper ? agentAvailable : !!whichBinary(meta.binary),
        state: 'idle',
        currentTask: null,
        lastOutput: '',
        startTime: null,
        error: null,
        pid: null,
    };
}

export function loadAllAgents() {
    ensureDirectories();
    const files = readdirSync(AGENTS_DIR).filter((f) => f.endsWith('.md'));
    const agents = [];
    for (const file of files) {
        const agent = loadAgentDefinition(join(AGENTS_DIR, file));
        if (agent) agents.push(agent);
    }
    return agents;
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function whichBinary(name) {
    if (!name) return null;
    try {
        return execSync(`which ${name} 2>/dev/null`, { encoding: 'utf8' }).trim();
    } catch {
        return null;
    }
}

export function isProcessRunning(name) {
    try {
        const result = execSync(`pgrep -f "${name}" 2>/dev/null`, { encoding: 'utf8' });
        return result.trim().length > 0;
    } catch {
        return false;
    }
}
