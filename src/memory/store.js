import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { MEMORY_DIR } from '../config.js';

const PATTERNS_FILE = join(MEMORY_DIR, 'patterns.json');
const PREFS_FILE = join(MEMORY_DIR, 'preferences.json');

function loadJson(path, fallback = {}) {
    if (existsSync(path)) {
        try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return fallback; }
    }
    return fallback;
}

function saveJson(path, data) {
    writeFileSync(path, JSON.stringify(data, null, 2), 'utf8');
}

export class MemoryStore {
    constructor() {
        this.patterns = loadJson(PATTERNS_FILE, { tasks: [], routing: {} });
        this.preferences = loadJson(PREFS_FILE, { overrides: {}, agentPrefs: {} });
    }

    /** Record a successful task — learn patterns */
    recordSuccess(agentId, prompt) {
        // Extract key words for pattern learning
        const words = prompt.toLowerCase().split(/\s+/).filter((w) => w.length > 3).slice(0, 5);
        const key = words.sort().join('|');

        if (!this.patterns.routing[key]) {
            this.patterns.routing[key] = {};
        }
        this.patterns.routing[key][agentId] = (this.patterns.routing[key][agentId] || 0) + 1;

        // Track task patterns
        this.patterns.tasks.push({
            agent: agentId,
            keywords: words,
            timestamp: Date.now(),
            success: true,
        });

        // Keep only last 500 tasks
        if (this.patterns.tasks.length > 500) {
            this.patterns.tasks = this.patterns.tasks.slice(-500);
        }

        saveJson(PATTERNS_FILE, this.patterns);
    }

    recordError(agentId, prompt) {
        const words = prompt.toLowerCase().split(/\s+/).filter((w) => w.length > 3).slice(0, 5);
        this.patterns.tasks.push({
            agent: agentId,
            keywords: words,
            timestamp: Date.now(),
            success: false,
        });
        saveJson(PATTERNS_FILE, this.patterns);
    }

    /** Check if user has a preference override for this type of prompt */
    getPreference(prompt) {
        const words = prompt.toLowerCase().split(/\s+/).filter((w) => w.length > 3).slice(0, 5);
        const key = words.sort().join('|');
        const routing = this.patterns.routing[key];
        if (!routing) return null;

        // Find the agent with the most successes for this pattern
        const entries = Object.entries(routing);
        if (entries.length === 0) return null;
        entries.sort((a, b) => b[1] - a[1]);
        // Only suggest if there's a clear winner (used 3+ times)
        if (entries[0][1] >= 3) return entries[0][0];
        return null;
    }

    /** Get frequently used patterns (for agent creation suggestions) */
    getFrequentPatterns() {
        const counts = {};
        for (const task of this.patterns.tasks) {
            const key = task.keywords.join(' ');
            counts[key] = (counts[key] || 0) + 1;
        }
        return Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([pattern, count]) => ({ pattern, count }));
    }

    /** Remember a user override (they chose a different agent than routing) */
    recordOverride(suggestedAgent, chosenAgent, prompt) {
        if (suggestedAgent !== chosenAgent) {
            const key = `${suggestedAgent}→${chosenAgent}`;
            this.preferences.overrides[key] = (this.preferences.overrides[key] || 0) + 1;
            saveJson(PREFS_FILE, this.preferences);
        }
    }

    getStats() {
        return {
            totalTasks: this.patterns.tasks.length,
            routingPatterns: Object.keys(this.patterns.routing).length,
            overrides: this.preferences.overrides,
        };
    }
}
