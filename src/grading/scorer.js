import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { ANALYTICS_DIR, AGENTS_DIR } from '../config.js';

const GRADES_FILE = join(ANALYTICS_DIR, 'grades.json');

function loadGrades() {
    if (existsSync(GRADES_FILE)) {
        try { return JSON.parse(readFileSync(GRADES_FILE, 'utf8')); } catch { return {}; }
    }
    return {};
}

function saveGrades(data) {
    writeFileSync(GRADES_FILE, JSON.stringify(data, null, 2), 'utf8');
}

export class GradingSystem {
    constructor(registry) {
        this.registry = registry;
        this.grades = loadGrades();
    }

    /** Initialize grades for all agents */
    init() {
        for (const agent of this.registry.list()) {
            if (!this.grades[agent.id]) {
                this.grades[agent.id] = {
                    totalTasks: 0, successes: 0, errors: 0,
                    avgResponseTime: 0, totalResponseTime: 0,
                    overrideCount: 0, // times user chose different agent
                    grade: agent.grade || 50,
                    trend: 'stable', // up, down, stable
                    history: [],
                };
            }
        }
        saveGrades(this.grades);
    }

    recordResult(agentId, success, responseTimeMs) {
        const g = this.grades[agentId];
        if (!g) return;

        g.totalTasks++;
        if (success) g.successes++; else g.errors++;
        g.totalResponseTime += responseTimeMs;
        g.avgResponseTime = Math.round(g.totalResponseTime / g.totalTasks);

        // Calculate grade: weighted score
        const successRate = g.totalTasks > 0 ? g.successes / g.totalTasks : 0;
        const newGrade = Math.round(successRate * 80 + 20); // 20-100 scale
        const oldGrade = g.grade;
        g.grade = newGrade;

        // Trend
        if (newGrade > oldGrade + 2) g.trend = 'up';
        else if (newGrade < oldGrade - 2) g.trend = 'down';
        else g.trend = 'stable';

        // History (keep last 30 entries)
        g.history.push({ timestamp: Date.now(), grade: newGrade, success });
        if (g.history.length > 30) g.history = g.history.slice(-30);

        saveGrades(this.grades);
    }

    recordOverride(agentId) {
        const g = this.grades[agentId];
        if (g) { g.overrideCount++; saveGrades(this.grades); }
    }

    getReportCard() {
        const cards = [];
        for (const agent of this.registry.list()) {
            const g = this.grades[agent.id] || { grade: 50, totalTasks: 0, successes: 0, errors: 0, trend: 'stable', avgResponseTime: 0 };
            const trendIcon = g.trend === 'up' ? '↑' : g.trend === 'down' ? '↓' : '→';
            cards.push({
                id: agent.id,
                name: agent.name,
                icon: agent.icon,
                color: agent.color,
                grade: g.grade,
                letterGrade: gradeToLetter(g.grade),
                trend: g.trend,
                trendIcon,
                totalTasks: g.totalTasks,
                successRate: g.totalTasks > 0 ? Math.round((g.successes / g.totalTasks) * 100) : 0,
                avgResponseTime: g.avgResponseTime,
                overrideCount: g.overrideCount || 0,
            });
        }
        return cards.sort((a, b) => b.grade - a.grade);
    }

    /** Check if any pattern is frequent enough to suggest a custom agent */
    suggestNewAgent(memory) {
        const patterns = memory.getFrequentPatterns();
        const suggestions = [];
        for (const p of patterns) {
            if (p.count >= 5) {
                suggestions.push({
                    pattern: p.pattern,
                    count: p.count,
                    suggestedName: `custom-${p.pattern.split(' ').slice(0, 2).join('-')}`,
                });
            }
        }
        return suggestions;
    }
}

function gradeToLetter(score) {
    if (score >= 90) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    if (score >= 50) return 'D';
    return 'F';
}
