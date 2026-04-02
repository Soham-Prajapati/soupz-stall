import { existsSync, mkdirSync, readFileSync, readdirSync, copyFileSync } from 'fs';
import { homedir } from 'os';
import { join, dirname } from 'path';
import { execSync } from 'child_process';
import { parse as parseYaml } from 'yaml';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const EXTRA_BIN_PATHS = [
    '/opt/homebrew/bin',
    '/usr/local/bin',
    '/usr/bin',
    '/bin',
    join(homedir(), 'Library/Application Support/Code/User/globalStorage/github.copilot-chat/copilotCli'),
];

function enrichedPath() {
    const base = String(process.env.PATH || '')
        .split(':')
        .map((entry) => entry.trim())
        .filter(Boolean);
    return Array.from(new Set([...base, ...EXTRA_BIN_PATHS])).join(':');
}

function ensureFlag(args, flag, value = null) {
    if (!Array.isArray(args)) return value == null ? [flag] : [flag, value];
    if (args.includes(flag)) return args;
    return value == null ? [...args, flag] : [...args, flag, value];
}

function resolveFirstBinary(candidates = []) {
    for (const candidate of candidates) {
        if (whichBinary(candidate)) return candidate;
    }
    return null;
}

function normalizeAgentCliDefaults(meta = {}) {
    const normalized = { ...meta };

    if (normalized.id === 'gemini') {
        let args = Array.isArray(normalized.build_args) ? [...normalized.build_args] : [];
        if (!args.includes('-p') && !args.includes('--prompt')) {
            args = ['-p', '{prompt}', ...args];
        }
        args = ensureFlag(args, '--output-format', 'stream-json');
        args = ensureFlag(args, '--yolo');
        normalized.build_args = args;
    }

    if (normalized.id === 'copilot') {
        const standaloneCopilot = resolveFirstBinary(['copilot']);
        if (standaloneCopilot) {
            normalized.binary = 'copilot';
            normalized.build_args = ['--allow-all-tools', '--allow-all-paths', '-p', '{prompt}'];
        }
    }

    if (normalized.id === 'codex') {
        const standaloneCodex = resolveFirstBinary(['codex', 'codex-cli', 'openai-codex']);
        if (standaloneCodex) {
            normalized.binary = standaloneCodex;
            normalized.build_args = ['exec', '--dangerously-bypass-approvals-and-sandbox', '{prompt}'];
        }
    }

    return normalized;
}

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

    const parsedMeta = parseYaml(fmMatch[1]);
    const meta = normalizeAgentCliDefaults(parsedMeta);
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
    // Backward compatibility: older Kiro configs used `chat --prompt {prompt}`,
    // but current kiro-cli expects prompt as a positional argument.
    if (meta.id === 'kiro' && Array.isArray(meta.build_args) && meta.build_args.includes('--prompt')) {
        meta.build_args = ['{prompt}'];
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
        const env = { ...process.env, PATH: enrichedPath() };
        return execSync(`command -v "${name}" 2>/dev/null`, { encoding: 'utf8', env }).trim();
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
