import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { randomUUID } from 'crypto';
import { execFile } from 'child_process';

const POOL_DIR = join(homedir(), '.soupz-agents', 'memory-pool');

export class MemoryPool {
    constructor(options = {}) {
        this.maxBanks = options.maxBanks || 10;
        this.maxChunkSize = options.maxChunkSize || 4000; // ~1000 tokens per chunk
        this.poolDir = options.poolDir || POOL_DIR;
        if (!existsSync(this.poolDir)) mkdirSync(this.poolDir, { recursive: true });
        this.banks = this._loadBanks();
    }

    _loadBanks() {
        const banks = new Map();
        try {
            const files = readdirSync(this.poolDir).filter(f => f.endsWith('.json'));
            for (const f of files) {
                try {
                    const data = JSON.parse(readFileSync(join(this.poolDir, f), 'utf8'));
                    banks.set(data.id, data);
                } catch { /* skip corrupt files */ }
            }
        } catch {}
        return banks;
    }

    _saveBank(bank) {
        writeFileSync(join(this.poolDir, `${bank.id}.json`), JSON.stringify(bank, null, 2));
    }

    _deleteBank(id) {
        try { unlinkSync(join(this.poolDir, `${id}.json`)); } catch {}
        this.banks.delete(id);
    }

    /** Create a new memory bank */
    createBank(label = '') {
        if (this.banks.size >= this.maxBanks) {
            // Evict oldest bank
            const oldest = [...this.banks.values()].sort((a, b) => a.lastAccess - b.lastAccess)[0];
            if (oldest) this._deleteBank(oldest.id);
        }
        const bank = {
            id: randomUUID().slice(0, 8),
            label: label || `Bank ${this.banks.size + 1}`,
            chunks: [],
            created: Date.now(),
            lastAccess: Date.now(),
            totalTokens: 0,
        };
        this.banks.set(bank.id, bank);
        this._saveBank(bank);
        return bank;
    }

    /** Store a chunk of context in a specific bank (or auto-assign) */
    store(content, options = {}) {
        const { bankId, label, tags = [] } = options;
        
        let bank;
        if (bankId) {
            bank = this.banks.get(bankId);
        }
        if (!bank) {
            // Find bank with most space, or create new one
            bank = [...this.banks.values()]
                .filter(b => b.totalTokens < this.maxChunkSize * 10)
                .sort((a, b) => a.totalTokens - b.totalTokens)[0];
            if (!bank) bank = this.createBank(label);
        }

        const chunk = {
            id: randomUUID().slice(0, 8),
            content: content.slice(0, this.maxChunkSize * 4), // ~maxChunkSize tokens
            tokens: Math.ceil(content.length / 4),
            tags,
            stored: Date.now(),
        };

        bank.chunks.push(chunk);
        bank.totalTokens += chunk.tokens;
        bank.lastAccess = Date.now();
        this._saveBank(bank);

        return { bankId: bank.id, chunkId: chunk.id, tokens: chunk.tokens };
    }

    /** Recall context by tags or search query — AI-enhanced when available */
    async recall(query, options = {}) {
        const { maxResults = 5, bankId } = options;
        
        // Gather all chunks
        const banksToSearch = bankId 
            ? [this.banks.get(bankId)].filter(Boolean)
            : [...this.banks.values()];
        
        const allChunks = [];
        for (const bank of banksToSearch) {
            for (const chunk of bank.chunks) {
                allChunks.push({ ...chunk, bankId: bank.id, bankLabel: bank.label });
            }
        }
        if (allChunks.length === 0) return [];

        // Try AI-powered recall via GPT-5-mini (smarter semantic matching)
        try {
            const chunkSummaries = allChunks.slice(0, 30).map((c, i) => 
                `${i}: [${c.tags.join(',')}] ${c.content.slice(0, 100)}`
            ).join('\n');
            
            const aiResult = await new Promise((resolve, reject) => {
                execFile('gh', ['copilot', '--model', 'gpt-5-mini', '-p', 
                    `Given this query: "${query.slice(0, 200)}"\n\nWhich of these memory chunks are most relevant? Reply with ONLY comma-separated indices (e.g., "0,3,7"), nothing else.\n\n${chunkSummaries}`,
                    '--allow-all-tools'], {
                    timeout: 10000, maxBuffer: 1024 * 4,
                }, (err, stdout) => {
                    if (err) { reject(err); return; }
                    resolve(stdout.trim());
                });
            });
            
            const indices = aiResult.replace(/[^0-9,]/g, '').split(',')
                .map(Number).filter(i => !isNaN(i) && i >= 0 && i < allChunks.length);
            
            if (indices.length > 0) {
                return indices.slice(0, maxResults).map(i => ({ ...allChunks[i], score: 100 - indices.indexOf(i) }));
            }
        } catch { /* fall through to keyword matching */ }

        // Fallback: keyword + tag matching
        const queryLower = query.toLowerCase();
        const results = [];
        for (const chunk of allChunks) {
            let score = 0;
            for (const tag of chunk.tags) {
                if (queryLower.includes(tag.toLowerCase())) score += 10;
            }
            const words = queryLower.split(/\s+/);
            for (const word of words) {
                if (word.length > 2 && chunk.content.toLowerCase().includes(word)) score += 1;
            }
            if (score > 0) results.push({ ...chunk, score });
        }
        return results.sort((a, b) => b.score - a.score).slice(0, maxResults);
    }

    /** Get pool statistics */
    stats() {
        const banks = [...this.banks.values()];
        return {
            bankCount: banks.length,
            maxBanks: this.maxBanks,
            totalChunks: banks.reduce((sum, b) => sum + b.chunks.length, 0),
            totalTokens: banks.reduce((sum, b) => sum + b.totalTokens, 0),
            banks: banks.map(b => ({
                id: b.id, label: b.label,
                chunks: b.chunks.length,
                tokens: b.totalTokens,
                lastAccess: b.lastAccess,
            })),
        };
    }

    /** Clear a specific bank */
    clearBank(bankId) {
        this._deleteBank(bankId);
    }

    /** Clear all banks */
    clearAll() {
        for (const [id] of this.banks) this._deleteBank(id);
    }

    /** Set max banks (user configurable) */
    setMaxBanks(n) {
        this.maxBanks = Math.max(1, Math.min(n, 100));
        // Evict excess banks
        while (this.banks.size > this.maxBanks) {
            const oldest = [...this.banks.values()].sort((a, b) => a.lastAccess - b.lastAccess)[0];
            if (oldest) this._deleteBank(oldest.id);
        }
    }
}
