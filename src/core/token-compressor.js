/**
 * Token Compression Middleware — Reduces token usage on input (prompts) and output (responses).
 *
 * Compression levels:
 *   light      — filler removal + whitespace normalization
 *   medium     — light + abbreviations + redundancy removal
 *   aggressive — medium + structured conversion + output directives
 */

const FILLER_PHRASES = [
    'I want you to', 'Please', 'Could you', 'I need', 'Can you',
    'I would like', 'It would be great if', 'I\'d like you to',
    'I\'d appreciate if you could', 'Would you mind',
];

const FILLER_WORDS = [
    'basically', 'actually', 'just', 'really', 'very',
    'quite', 'kind of', 'sort of', 'simply', 'honestly',
    'literally', 'essentially', 'obviously', 'certainly',
];

const ABBREVIATIONS = {
    'function': 'fn',
    'implementation': 'impl',
    'configuration': 'config',
    'authentication': 'auth',
    'application': 'app',
    'database': 'db',
    'repository': 'repo',
    'environment': 'env',
    'documentation': 'docs',
    'development': 'dev',
    'production': 'prod',
    'parameters': 'params',
    'arguments': 'args',
    'dependency': 'dep',
    'dependencies': 'deps',
    'directory': 'dir',
    'middleware': 'mw',
    'temporary': 'tmp',
    'utilities': 'utils',
    'utility': 'util',
};

const REVERSE_ABBREVIATIONS = Object.fromEntries(
    Object.entries(ABBREVIATIONS).map(([full, abbr]) => [abbr, full])
);

const CODE_KEYWORDS = [
    'code', 'function', 'fn', 'class', 'implement', 'write', 'create',
    'script', 'module', 'component', 'api', 'endpoint',
];

const ANALYSIS_KEYWORDS = [
    'analyze', 'analyse', 'review', 'explain', 'compare', 'evaluate',
    'debug', 'diagnose', 'investigate', 'assess',
];

export class TokenCompressor {
    constructor(level = 'medium') {
        this.level = level;
        this.stats = { originalInputTokens: 0, compressedInputTokens: 0, originalOutputTokens: 0, compressedOutputTokens: 0 };
    }

    estimateTokens(text) {
        return Math.ceil((text || '').length / 4);
    }

    compressPrompt(text) {
        const originalTokens = this.estimateTokens(text);
        this.stats.originalInputTokens += originalTokens;

        // Don't compress very short prompts — nothing to gain
        if ((text || '').length < 30) {
            this.stats.compressedInputTokens += originalTokens;
            return text;
        }

        let result = text;

        // light: filler removal + whitespace normalization
        result = this._removeFillers(result);
        result = this._normalizeWhitespace(result);

        if (this.level === 'medium' || this.level === 'aggressive') {
            result = this._applyAbbreviations(result);
            result = this._removeRedundancy(result);
        }

        if (this.level === 'aggressive') {
            result = this._convertToStructured(result);
        }

        const compressedTokens = this.estimateTokens(result);
        this.stats.compressedInputTokens += compressedTokens;
        return result;
    }

    getOutputDirective(prompt) {
        const lower = (prompt || '').toLowerCase();
        // Skip directive for very short / conversational prompts
        if (lower.length < 20) return null;
        if (CODE_KEYWORDS.some((kw) => lower.includes(kw))) {
            return 'Return code only. No explanations unless critical.';
        }
        if (ANALYSIS_KEYWORDS.some((kw) => lower.includes(kw))) {
            return 'Use bullet points. Max 3 sentences per point.';
        }
        return null;
    }

    decompressResponse(text) {
        const originalTokens = this.estimateTokens(text);
        this.stats.originalOutputTokens += originalTokens;

        let result = text;
        // Expand abbreviations outside code blocks
        const parts = result.split(/(```[\s\S]*?```)/g);
        result = parts.map((part) => {
            if (part.startsWith('```')) return part;
            return this._expandAbbreviations(part);
        }).join('');

        result = this._normalizeWhitespace(result);

        const compressedTokens = this.estimateTokens(result);
        this.stats.compressedOutputTokens += compressedTokens;
        return result;
    }

    getSavings() {
        const inputSaved = this.stats.originalInputTokens > 0
            ? ((this.stats.originalInputTokens - this.stats.compressedInputTokens) / this.stats.originalInputTokens) * 100
            : 0;
        const outputSaved = this.stats.originalOutputTokens > 0
            ? ((this.stats.originalOutputTokens - this.stats.compressedOutputTokens) / this.stats.originalOutputTokens) * 100
            : 0;

        const totalOriginal = this.stats.originalInputTokens + this.stats.originalOutputTokens;
        const totalCompressed = this.stats.compressedInputTokens + this.stats.compressedOutputTokens;
        const totalSaved = totalOriginal > 0
            ? ((totalOriginal - totalCompressed) / totalOriginal) * 100
            : 0;

        return {
            inputSaved: Math.round(inputSaved * 100) / 100,
            outputSaved: Math.round(outputSaved * 100) / 100,
            totalSaved: Math.round(totalSaved * 100) / 100,
            totalTokensSaved: totalOriginal - totalCompressed,
        };
    }

    resetStats() {
        this.stats = { originalInputTokens: 0, compressedInputTokens: 0, originalOutputTokens: 0, compressedOutputTokens: 0 };
    }

    // --- Private helpers ---

    _removeFillers(text) {
        let result = text;
        for (const phrase of FILLER_PHRASES) {
            result = result.replace(new RegExp(phrase + '\\s*', 'gi'), '');
        }
        for (const word of FILLER_WORDS) {
            result = result.replace(new RegExp(`\\b${word}\\b\\s*`, 'gi'), '');
        }
        return result;
    }

    _normalizeWhitespace(text) {
        return text.replace(/[^\S\n]+/g, ' ').replace(/\n{3,}/g, '\n\n').replace(/^\s+|\s+$/gm, '').trim();
    }

    _applyAbbreviations(text) {
        let result = text;
        for (const [full, abbr] of Object.entries(ABBREVIATIONS)) {
            result = result.replace(new RegExp(`\\b${full}\\b`, 'gi'), abbr);
        }
        return result;
    }

    _expandAbbreviations(text) {
        let result = text;
        for (const [abbr, full] of Object.entries(REVERSE_ABBREVIATIONS)) {
            result = result.replace(new RegExp(`\\b${abbr}\\b`, 'g'), full);
        }
        return result;
    }

    _removeRedundancy(text) {
        const sentences = text.split(/(?<=[.!?])\s+/);
        const seen = new Set();
        const unique = [];
        for (const sentence of sentences) {
            const normalized = sentence.toLowerCase().trim();
            if (normalized && !seen.has(normalized)) {
                seen.add(normalized);
                unique.push(sentence);
            }
        }
        return unique.join(' ');
    }

    _convertToStructured(text) {
        const lower = text.toLowerCase();
        const isCodeRequest = CODE_KEYWORDS.some((kw) => lower.includes(kw));
        if (!isCodeRequest) return text;

        const lines = text.split('\n').filter((l) => l.trim());
        const task = lines[0] || text.slice(0, 120);
        const ctx = lines.length > 2 ? lines.slice(1, -1).join(' ') : '';
        const out = lines.length > 1 ? lines[lines.length - 1] : '';

        const parts = [`[TASK] ${task.trim()}`];
        if (ctx) parts.push(`[CTX] ${ctx.trim()}`);
        if (out && out !== task) parts.push(`[OUT] ${out.trim()}`);
        return parts.join('\n');
    }
}

export default TokenCompressor;
