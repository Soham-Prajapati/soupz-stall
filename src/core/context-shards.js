import { join } from 'path';
import { homedir } from 'os';
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, unlinkSync } from 'fs';

/**
 * Context Sharding — Distributed memory across N shards.
 * 
 * Each shard stores a chunk of context. When the main agent context is full,
 * older parts are offloaded to shards. Before an agent call, relevant shards
 * are queried to pull back context.
 * 
 * Storage: JSON files in ~/.soupz-agents/shards/
 */

const SHARDS_DIR = join(homedir(), '.soupz-agents', 'shards');
const MAX_SHARD_TOKENS = 4000;
const MAX_SHARDS = 7;

export class ContextShards {
    constructor() {
        this.shards = [];
        this.initialized = false;
    }

    init() {
        if (!existsSync(SHARDS_DIR)) mkdirSync(SHARDS_DIR, { recursive: true });
        try {
            const files = readdirSync(SHARDS_DIR).filter((f) => f.endsWith('.json')).sort();
            this.shards = files.map((f) => {
                const data = JSON.parse(readFileSync(join(SHARDS_DIR, f), 'utf8'));
                return { id: data.id, label: data.label, content: data.content, tokens: data.tokens || 0, createdAt: data.createdAt };
            });
        } catch { this.shards = []; }
        this.initialized = true;
    }

    store(label, content) {
        if (!this.initialized) this.init();
        const tokens = Math.ceil(content.length / 4);
        const id = this.shards.length + 1;
        if (this.shards.length >= MAX_SHARDS) {
            const oldest = this.shards.shift();
            try { unlinkSync(join(SHARDS_DIR, `shard-${oldest.id}.json`)); } catch { }
        }
        const shard = { id, label, content, tokens, createdAt: new Date().toISOString() };
        this.shards.push(shard);
        writeFileSync(join(SHARDS_DIR, `shard-${id}.json`), JSON.stringify(shard, null, 2));
        return shard;
    }

    offload(label, text) {
        if (!this.initialized) this.init();
        const maxChars = MAX_SHARD_TOKENS * 4;
        const chunks = [];
        for (let i = 0; i < text.length; i += maxChars) chunks.push(text.slice(i, i + maxChars));
        const stored = [];
        for (let i = 0; i < chunks.length; i++) stored.push(this.store(`${label} (${i + 1}/${chunks.length})`, chunks[i]));
        return stored;
    }

    recall(query) {
        if (!this.initialized) this.init();
        const queryWords = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
        const results = [];
        for (const shard of this.shards) {
            const contentLower = (shard.content + ' ' + shard.label).toLowerCase();
            let score = 0;
            for (const w of queryWords) { if (contentLower.includes(w)) score++; }
            if (score > 0) results.push({ ...shard, score });
        }
        return results.sort((a, b) => b.score - a.score);
    }

    getStatus() {
        if (!this.initialized) this.init();
        const totalTokens = this.shards.reduce((sum, s) => sum + (s.tokens || 0), 0);
        return {
            count: this.shards.length, maxShards: MAX_SHARDS, totalTokens,
            shards: this.shards.map((s) => ({ id: s.id, label: s.label, tokens: s.tokens, createdAt: s.createdAt })),
        };
    }

    clear() {
        if (!this.initialized) this.init();
        for (const s of this.shards) { try { unlinkSync(join(SHARDS_DIR, `shard-${s.id}.json`)); } catch { } }
        this.shards = [];
    }
}
