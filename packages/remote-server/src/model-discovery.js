import { execSync } from 'child_process';
import { readFileSync, realpathSync } from 'fs';

const modelCache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000;

const PROBE_STRATEGIES = {
    codex: {
        probe: () => {
            const result = execSync(
                'gh copilot -- -p "list all available models. respond with ONLY a comma-separated list of model IDs, nothing else" --model gpt-5.1-codex-mini --allow-all-tools 2>/dev/null',
                { timeout: 30000, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
            );
            const match = result.match(/[\w.-]+(?:,\s*[\w.-]+)+/);
            return match ? match[0].split(',').map(m => m.trim()).filter(Boolean) : [];
        },
        fallback: ['gpt-4.1', 'gpt-5-mini', 'gpt-5.1-codex-mini'],
    },
    copilot: {
        probe: () => {
            const result = execSync(
                'gh copilot -- -p "list all available models. respond with ONLY a comma-separated list of model IDs, nothing else" --model gpt-5.1-codex-mini --allow-all-tools 2>/dev/null',
                { timeout: 30000, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
            );
            const match = result.match(/[\w.-]+(?:,\s*[\w.-]+)+/);
            return match ? match[0].split(',').map(m => m.trim()).filter(Boolean) : [];
        },
        fallback: ['gpt-4.1', 'gpt-5-mini', 'gpt-5.1-codex-mini'],
    },
    gemini: {
        probe: () => {
            // Read model list from Gemini CLI source (reliable, no API call)
            try {
                const which = execSync('which gemini', { encoding: 'utf8' }).trim();
                const real = realpathSync(which);
                const parts = real.split('/');
                const cellarIdx = parts.indexOf('Cellar');
                let modelsPath;
                if (cellarIdx >= 0) {
                    // Homebrew: /opt/homebrew/Cellar/gemini-cli/X.Y.Z/libexec/lib/node_modules/@google/gemini-cli
                    const base = parts.slice(0, cellarIdx + 3).join('/');
                    modelsPath = base + '/libexec/lib/node_modules/@google/gemini-cli/node_modules/@google/gemini-cli-core/dist/src/config/models.js';
                } else {
                    // npm global: find node_modules/@google/gemini-cli-core
                    const nodeModulesIdx = real.lastIndexOf('node_modules');
                    if (nodeModulesIdx >= 0) {
                        modelsPath = real.substring(0, nodeModulesIdx) + 'node_modules/@google/gemini-cli-core/dist/src/config/models.js';
                    }
                }
                if (modelsPath) {
                    const src = readFileSync(modelsPath, 'utf8');
                    const models = [...src.matchAll(/= '(gemini-[\w.-]+)'/g)].map(m => m[1]);
                    return [...new Set(models)];
                }
            } catch { /* fall through */ }
            // Fallback: ask the model itself (silently)
            try {
                const result = execSync('gemini -p "what model are you? reply ONLY model ID" --output-format text 2>/dev/null', { timeout: 15000, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
                const id = result.match(/gemini-[\w.-]+/)?.[0];
                return id ? [id] : [];
            } catch { return []; }
        },
        fallback: ['gemini-2.5-flash', 'gemini-2.5-pro'],
    },
    'claude-code': {
        probe: () => ['sonnet', 'opus', 'haiku'],
        fallback: ['sonnet'],
    },
};

export async function probeAgentModels(agentId) {
    const cached = modelCache.get(agentId);
    if (cached && Date.now() - cached.probedAt < CACHE_TTL) return cached;

    const strategy = PROBE_STRATEGIES[agentId];
    if (!strategy) return { models: [], probedAt: Date.now() };

    let models = strategy.fallback;
    try {
        const probed = strategy.probe();
        if (probed.length > 0) models = probed;
    } catch { /* use fallback */ }

    const entry = { models, probedAt: Date.now() };
    modelCache.set(agentId, entry);
    return entry;
}

export async function discoverAllModels() {
    const result = {};
    for (const agentId of Object.keys(PROBE_STRATEGIES)) {
        const { models } = await probeAgentModels(agentId);
        result[agentId] = models;
    }
    return result;
}

export function categorizeModels(models) {
    if (!models || models.length === 0) return { reasoning: null, code: null, fast: null };
    return {
        reasoning: models.find(m => /claude.*sonnet|opus/i.test(m))
            || models.find(m => /claude/i.test(m))
            || models.find(m => /pro/i.test(m))
            || models.find(m => /gpt-5\.\d+$/.test(m))
            || models[0],
        code: models.find(m => /codex(?!.*mini)/i.test(m))
            || models.find(m => /gpt-5\.\d+$/.test(m))
            || models[0],
        fast: models.find(m => /mini/i.test(m))
            || models.find(m => /flash.*lite|lite/i.test(m))
            || models.find(m => /flash/i.test(m))
            || models[0],
    };
}

export function selectModelForTask(agentId, taskType) {
    const cached = modelCache.get(agentId);
    if (!cached) return null;
    const cat = categorizeModels(cached.models);
    return cat[taskType] || cat.fast || null;
}

export function clearModelCache() { modelCache.clear(); }
export function getModelCache() { return Object.fromEntries(modelCache); }
