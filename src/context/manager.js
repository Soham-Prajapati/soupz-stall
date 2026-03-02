import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { CONTEXT_DIR } from '../config.js';

export class ContextManager {
    constructor() {
        this.sessionId = `session-${Date.now()}`;
        this.messages = [];
        this.totalTokensEstimate = 0;
        this.compressionThreshold = 50; // messages before suggesting compression
        this.compressed = false;
    }

    addMessage(role, content) {
        this.messages.push({
            role,
            content: content.slice(0, 4000),
            timestamp: Date.now(),
        });
        this.totalTokensEstimate += Math.ceil(content.length / 4);
    }

    getContext() {
        return this.messages;
    }

    needsCompression() {
        return this.messages.length > this.compressionThreshold;
    }

    /** Compress: keep last 20 messages full, summarize everything before */
    compress() {
        if (this.messages.length <= 20) return;

        const oldMessages = this.messages.slice(0, -20);
        const recentMessages = this.messages.slice(-20);

        // Create a summary of old messages
        const summary = oldMessages.map((m) => {
            const preview = m.content.slice(0, 100).replace(/\n/g, ' ');
            return `[${m.role}] ${preview}`;
        }).join('\n');

        const compressedMsg = {
            role: 'system',
            content: `[COMPRESSED CONTEXT — ${oldMessages.length} messages summarized]\n${summary}`,
            timestamp: Date.now(),
            compressed: true,
        };

        this.messages = [compressedMsg, ...recentMessages];
        this.compressed = true;
        this.save();
    }

    save() {
        const file = join(CONTEXT_DIR, `${this.sessionId}.json`);
        writeFileSync(file, JSON.stringify({
            id: this.sessionId,
            messages: this.messages,
            tokensEstimate: this.totalTokensEstimate,
            compressed: this.compressed,
            savedAt: new Date().toISOString(),
        }, null, 2), 'utf8');
    }

    load(sessionId) {
        const file = join(CONTEXT_DIR, `${sessionId}.json`);
        if (existsSync(file)) {
            const data = JSON.parse(readFileSync(file, 'utf8'));
            this.sessionId = data.id;
            this.messages = data.messages || [];
            this.compressed = data.compressed || false;
            return true;
        }
        return false;
    }

    getStats() {
        return {
            messages: this.messages.length,
            tokensEstimate: this.totalTokensEstimate,
            needsCompression: this.needsCompression(),
            compressed: this.compressed,
        };
    }
}
