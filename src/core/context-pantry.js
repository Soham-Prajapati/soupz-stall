import { join } from 'path';
import { homedir } from 'os';
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, unlinkSync } from 'fs';

/**
 * Context Pantry — The Soupz Stall's ingredient storage.
 * 
 * Each pantry item stores a chunk of context. When the main kitchen context
 * is full, older ingredients are stored in the pantry. Before a chef starts
 * cooking, relevant items are pulled from the pantry.
 * 
 * Storage: JSON files in ~/.soupz-agents/pantry/
 */

const PANTRY_DIR = join(homedir(), '.soupz-agents', 'pantry');
const MAX_ITEM_TOKENS = 4000;
let MAX_PANTRY_ITEMS = 7;

export class ContextPantry {
    constructor(options = {}) {
        this.items = [];
        this.initialized = false;
        if (options.maxItems) MAX_PANTRY_ITEMS = options.maxItems;
    }

    init() {
        if (!existsSync(PANTRY_DIR)) mkdirSync(PANTRY_DIR, { recursive: true });
        try {
            const files = readdirSync(PANTRY_DIR).filter((f) => f.endsWith('.json')).sort();
            this.items = files.map((f) => {
                const data = JSON.parse(readFileSync(join(PANTRY_DIR, f), 'utf8'));
                return { id: data.id, label: data.label, content: data.content, tokens: data.tokens || 0, createdAt: data.createdAt };
            });
        } catch { this.items = []; }
        this.initialized = true;
    }

    setMaxItems(n) {
        if (n > 0) MAX_PANTRY_ITEMS = n;
    }

    getMaxItems() { return MAX_PANTRY_ITEMS; }

    store(label, content) {
        if (!this.initialized) this.init();
        const tokens = Math.ceil(content.length / 4);
        const id = this.items.length + 1;
        if (this.items.length >= MAX_PANTRY_ITEMS) {
            const oldest = this.items.shift();
            try { unlinkSync(join(PANTRY_DIR, `pantry-${oldest.id}.json`)); } catch { }
        }
        const item = { id, label, content, tokens, createdAt: new Date().toISOString() };
        this.items.push(item);
        writeFileSync(join(PANTRY_DIR, `pantry-${id}.json`), JSON.stringify(item, null, 2));
        return item;
    }

    offload(label, text) {
        if (!this.initialized) this.init();
        const maxChars = MAX_ITEM_TOKENS * 4;
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
        for (const item of this.items) {
            const contentLower = (item.content + ' ' + item.label).toLowerCase();
            let score = 0;
            for (const w of queryWords) { if (contentLower.includes(w)) score++; }
            if (score > 0) results.push({ ...item, score });
        }
        return results.sort((a, b) => b.score - a.score);
    }

    getStatus() {
        if (!this.initialized) this.init();
        const totalTokens = this.items.reduce((sum, s) => sum + (s.tokens || 0), 0);
        return {
            count: this.items.length, maxItems: MAX_PANTRY_ITEMS, totalTokens,
            items: this.items.map((s) => ({ id: s.id, label: s.label, tokens: s.tokens, createdAt: s.createdAt })),
        };
    }

    clear() {
        if (!this.initialized) this.init();
        for (const s of this.items) { try { unlinkSync(join(PANTRY_DIR, `pantry-${s.id}.json`)); } catch { } }
        this.items = [];
    }
}
