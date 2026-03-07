const SYSTEM_PROMPT = `You are a prompt compressor. Rewrite the user's prompt to be as short as possible while preserving ALL meaning, intent, and technical details. Rules:
- Remove filler words and pleasantries
- Use abbreviations (fn, impl, config, auth, db, env, etc.)
- Convert prose to structured format: [TASK] [CTX] [OUT]
- Keep code snippets, file paths, and technical terms exact
- Never add information not in the original
- Output ONLY the compressed prompt, nothing else`;

import { execFile } from 'child_process';

export class OllamaPreprocessor {
    constructor(options = {}) {
        this.model = options.model || 'qwen2.5:0.5b';
        this.endpoint = options.endpoint || 'http://localhost:11434';
        this.timeout = options.timeout || 5000;
        this.enabled = options.enabled !== false;

        this._available = null;
        this._availableCheckedAt = 0;
        this._stats = {
            callCount: 0,
            totalInputLength: 0,
            totalOutputLength: 0,
            totalLatencyMs: 0,
        };
    }

    async checkAvailability() {
        if (!this.enabled) return false;

        const now = Date.now();
        if (this._available !== null && now - this._availableCheckedAt < 60_000) {
            return this._available;
        }

        try {
            const res = await fetch(`${this.endpoint}/api/tags`, {
                signal: AbortSignal.timeout(this.timeout),
            });
            if (!res.ok) {
                this._available = false;
                this._availableCheckedAt = now;
                return false;
            }
            const data = await res.json();
            const models = (data.models || []).map(m => m.name);
            this._available = models.some(
                n => n === this.model || n.startsWith(`${this.model}:`) || this.model.includes(':') && n === this.model
            );
            this._availableCheckedAt = now;
            return this._available;
        } catch {
            this._available = false;
            this._availableCheckedAt = now;
            return false;
        }
    }

    async compress(prompt) {
        if (!this.enabled) return prompt;

        // Layer 1: Try Copilot (gpt-5-mini, free, smarter compression)
        try {
            const compressed = await this._compressCopilot(prompt);
            if (compressed && compressed.length < prompt.length) {
                this._stats.callCount++;
                this._stats.totalInputLength += prompt.length;
                this._stats.totalOutputLength += compressed.length;
                return compressed;
            }
        } catch { /* fall through to Ollama */ }

        // Layer 2: Try Ollama (local, fast)
        try {
            const available = await this.checkAvailability();
            if (!available) return prompt;

            const start = Date.now();
            const res = await fetch(`${this.endpoint}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.model,
                    system: SYSTEM_PROMPT,
                    prompt,
                    stream: false,
                }),
                signal: AbortSignal.timeout(this.timeout),
            });

            if (!res.ok) return prompt;

            const data = await res.json();
            const compressed = (data.response || '').trim();
            const latency = Date.now() - start;

            if (!compressed || compressed.length >= prompt.length) {
                return prompt;
            }

            this._stats.callCount++;
            this._stats.totalInputLength += prompt.length;
            this._stats.totalOutputLength += compressed.length;
            this._stats.totalLatencyMs += latency;

            return compressed;
        } catch {
            return prompt;
        }
    }

    /** Compress via Copilot gpt-5-mini (free, smarter) */
    _compressCopilot(prompt) {
        const cpPrompt = `${SYSTEM_PROMPT}\n\nPrompt to compress:\n${prompt.slice(0, 2000)}`;
        return new Promise((resolve, reject) => {
            execFile('gh', ['copilot', '--model', 'gpt-5-mini', '-p', cpPrompt, '--allow-all-tools'], {
                timeout: 15000, maxBuffer: 1024 * 64,
            }, (err, stdout) => {
                if (err) { reject(err); return; }
                resolve(stdout.trim());
            });
        });
    }

    async expand(response) {
        try {
            if (!response || response.includes('```') || response.length >= 100) {
                return response;
            }

            const available = await this.checkAvailability();
            if (!available) return response;

            const res = await fetch(`${this.endpoint}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.model,
                    prompt: `Expand this terse response into clear, readable text: ${response}`,
                    stream: false,
                }),
                signal: AbortSignal.timeout(this.timeout),
            });

            if (!res.ok) return response;

            const data = await res.json();
            return (data.response || '').trim() || response;
        } catch (err) {
            console.warn(`[ollama-preprocessor] expand failed: ${err.message}`);
            return response;
        }
    }

    getStats() {
        const { callCount, totalInputLength, totalOutputLength, totalLatencyMs } = this._stats;
        return {
            available: this._available ?? false,
            model: this.model,
            avgCompressionRatio: callCount > 0 ? totalOutputLength / totalInputLength : 0,
            avgLatencyMs: callCount > 0 ? Math.round(totalLatencyMs / callCount) : 0,
            callCount,
            totalSaved: totalInputLength - totalOutputLength,
        };
    }

    async pullModel() {
        try {
            const res = await fetch(`${this.endpoint}/api/pull`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: this.model }),
            });

            if (!res.ok) {
                console.warn(`[ollama-preprocessor] pull failed: HTTP ${res.status}`);
                return;
            }

            const reader = res.body?.getReader();
            if (!reader) return;

            const decoder = new TextDecoder();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });
                for (const line of chunk.split('\n').filter(Boolean)) {
                    try {
                        const update = JSON.parse(line);
                        if (update.status) console.log(`[ollama-pull] ${update.status}`);
                    } catch { /* ignore malformed lines */ }
                }
            }

            // Invalidate availability cache so next check picks up new model
            this._available = null;
            this._availableCheckedAt = 0;
        } catch (err) {
            console.warn(`[ollama-preprocessor] pull failed: ${err.message}`);
        }
    }
}

export default OllamaPreprocessor;
