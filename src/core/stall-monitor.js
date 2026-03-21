import { join, dirname } from 'path';
import { homedir } from 'os';
import os from 'os';
import { writeFileSync, mkdirSync, existsSync, unlinkSync, readdirSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

/**
 * Stall Monitor — Real-time dashboard state for the Soupz Stall.
 * 
 * Each terminal instance gets a unique session ID. The dashboard
 * reads all session files and shows them as separate stalls.
 */

const DASHBOARD_DIR = join(homedir(), '.soupz-agents', 'dashboard');

export class StallMonitor {
    constructor(orchestrator, registry, options = {}) {
        this.orchestrator = orchestrator;
        this.registry = registry;
        this.costTracker = options.costTracker || null;
        this.active = false;
        this.sessionId = randomUUID().slice(0, 8);
        this.stateFile = join(DASHBOARD_DIR, `stall-${this.sessionId}.json`);
        this.localStateFile = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'packages', 'dashboard', 'public', 'stall-state.json');
        this.updateInterval = null;
        this.state = {
            sessionId: this.sessionId,
            timestamp: Date.now(),
            stall: { 
                name: `Stall ${this.sessionId.slice(0, 4)}`, 
                status: 'idle', 
                uptime: 0,
                health: { cpu: 0, ram: 0 }
            },
            chefs: [],
            kitchens: [],
            orders: [],
            activeOrders: [],
            stats: {
                totalOrders: 0,
                completedOrders: 0,
                failedOrders: 0,
                avgCookTime: 0,
                personaCalls: {},
                toolCalls: {},
                routingHistory: [],
            },
            recommendations: [
                { type: 'insight', text: 'Stove is pre-heating. Ready for heavy throughput.' },
                { type: 'tip', text: 'Try using @designer for UI tasks to see the latest glassmorphism patterns.' }
            ],
            grades: {},
            tokens: { total: 0, input: 0, output: 0, cost: 0, byModel: {}, savings: 0 },
        };
        this.startTime = Date.now();
    }

    start() {
        if (!existsSync(DASHBOARD_DIR)) mkdirSync(DASHBOARD_DIR, { recursive: true });
        this.active = true;
        this._cleanupStaleFiles();
        this._bindEvents();
        this._refreshState();
        this.updateInterval = setInterval(() => {
            this._refreshState();
            this._writeState();
        }, 2000);
        this._writeState();
        this.dashboardHtml = this.createSessionDashboard();
    }

    stop() {
        this.active = false;
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        // Clean up this session's files
        try { unlinkSync(this.stateFile); } catch { }
        if (this.dashboardHtml) {
            try { unlinkSync(this.dashboardHtml); } catch { }
        }
    }

    getStatePath() { return this.stateFile; }
    getDashboardDir() { return DASHBOARD_DIR; }

    _bindEvents() {
        const o = this.orchestrator;
        
        o.on('route', (data) => {
            const entry = {
                timestamp: Date.now(),
                agent: data.agent,
                persona: data.persona || null,
                reason: data.reason,
                confidence: data.confidence,
                alternatives: data.alternatives,
            };
            this.state.stats.routingHistory.unshift(entry);
            if (this.state.stats.routingHistory.length > 20) this.state.stats.routingHistory.pop();
            
            // Track persona calls
            if (data.persona) {
                this.state.stats.personaCalls[data.persona] = (this.state.stats.personaCalls[data.persona] || 0) + 1;
            }
            // Track tool calls
            this.state.stats.toolCalls[data.agent] = (this.state.stats.toolCalls[data.agent] || 0) + 1;
        });

        o.on('task-start', (entry) => {
            this.state.stats.totalOrders++;
            const order = {
                id: entry.id,
                prompt: entry.prompt.length > 100 ? entry.prompt.slice(0, 97) + '…' : entry.prompt,
                agent: entry.agent,
                persona: entry.persona || null,
                status: 'cooking',
                startTime: entry.startTime,
            };
            this.state.activeOrders.push(order);
            this.state.orders.unshift(order);
            if (this.state.orders.length > 50) this.state.orders.pop();
        });

        o.on('task-done', (entry) => {
            this.state.stats.completedOrders++;
            // Update active orders
            this.state.activeOrders = this.state.activeOrders.filter(o => o.id !== entry.id);
            // Update order history
            const order = this.state.orders.find(o => o.id === entry.id);
            if (order) {
                order.status = 'served';
                order.duration = entry.duration;
                order.endTime = entry.endTime;
            }
            this._updateAvgCookTime(entry.duration);
        });

        o.on('task-error', (entry) => {
            this.state.stats.failedOrders++;
            this.state.activeOrders = this.state.activeOrders.filter(o => o.id !== entry.id);
            const order = this.state.orders.find(o => o.id === entry.id);
            if (order) {
                order.status = 'burnt';
                order.error = entry.result;
                order.endTime = Date.now();
            }
        });

        o.on('fleet-worker-start', (entry) => {
            this.state.stats.totalOrders++;
            const order = {
                id: entry.id,
                prompt: entry.task.length > 100 ? entry.task.slice(0, 97) + '…' : entry.task,
                agent: entry.agentId,
                status: 'cooking',
                startTime: entry.startTime,
                isFleet: true,
            };
            this.state.activeOrders.push(order);
            this.state.orders.unshift(order);
            if (this.state.orders.length > 50) this.state.orders.pop();
        });

        o.on('fleet-worker-done', (entry) => {
            this.state.stats.completedOrders++;
            this.state.activeOrders = this.state.activeOrders.filter(o => o.id !== entry.id);
            const order = this.state.orders.find(o => o.id === entry.id);
            if (order) {
                order.status = entry.status === 'done' ? 'served' : 'burnt';
                order.duration = entry.duration;
                order.endTime = entry.endTime;
            }
            if (entry.duration) this._updateAvgCookTime(entry.duration);
        });
    }

    _refreshState() {
        this.state.timestamp = Date.now();
        this.state.stall.uptime = Date.now() - this.startTime;
        this.state.stall.status = this.state.activeOrders.length > 0 ? 'cooking' : 'idle';

        // Update RAM
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        this.state.stall.health.ram = Math.round(((totalMem - freeMem) / totalMem) * 100);

        // Update CPU using os.cpus() delta
        const cpus = os.cpus();
        const total = cpus.reduce((a, c) => a + Object.values(c.times).reduce((s, t) => s + t, 0), 0);
        const idle = cpus.reduce((a, c) => a + c.times.idle, 0);
        if (this._lastCpuTotal) {
            const dTotal = total - this._lastCpuTotal;
            const dIdle = idle - this._lastCpuIdle;
            this.state.stall.health.cpu = dTotal > 0 ? Math.round(((dTotal - dIdle) / dTotal) * 100) : 0;
        }
        this._lastCpuTotal = total;
        this._lastCpuIdle = idle;

        // Refresh chef (persona) list
        const personas = this.registry.personas();
        this.state.chefs = personas.map(p => ({
            id: p.id,
            name: p.name,
            icon: p.icon || '👨‍🍳',
            color: p.color || '#888',
            grade: p.grade || 50,
            usageCount: p.usage_count || 0,
            capabilities: (p.capabilities || []).slice(0, 5),
            state: this.state.activeOrders.some(o => (o.persona || o.agent) === p.id) ? 'cooking' : 'idle',
            calls: this.state.stats.personaCalls[p.id] || 0,
        }));

        // Refresh kitchen (tool) list
        const tools = this.registry.headless();
        this.state.kitchens = tools.map(t => ({
            id: t.id,
            name: t.name,
            icon: t.icon || '🔧',
            color: t.color || '#888',
            grade: t.grade || 50,
            available: t.available,
            state: this.state.activeOrders.some(o => o.agent === t.id) ? 'cooking' : 'idle',
            calls: this.state.stats.toolCalls[t.id] || 0,
        }));

        // Refresh grades
        const all = this.registry.list();
        this.state.grades = {};
        for (const a of all) {
            this.state.grades[a.id] = {
                grade: a.grade || 50,
                usage: a.usage_count || 0,
                name: a.name,
                icon: a.icon || '',
            };
        }

        // Refresh token/cost data
        if (this.costTracker) {
            const summary = this.costTracker.getSummary();
            this.state.tokens = {
                total: (summary.gemini?.tokens || 0) + (summary.copilot?.tokens || 0),
                cost: summary.total || 0,
                byEngine: {
                    gemini: summary.gemini || { calls: 0, tokens: 0, cost: 0 },
                    copilot: summary.copilot || { calls: 0, tokens: 0, cost: 0 },
                },
                byModel: summary.copilot?.byModel || {},
            };
        }
    }

    _updateAvgCookTime(duration) {
        const { completedOrders, avgCookTime } = this.state.stats;
        this.state.stats.avgCookTime = Math.round(
            ((avgCookTime * (completedOrders - 1)) + duration) / completedOrders
        );
    }

    /** Remove stale session files older than 24 hours (unrenamed = forgotten) */
    _cleanupStaleFiles() {
        const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
        try {
            const files = readdirSync(DASHBOARD_DIR).filter(f => f.startsWith('stall-'));
            const now = Date.now();
            for (const f of files) {
                const fp = join(DASHBOARD_DIR, f);
                try {
                    const stats = statSync(fp);
                    // If file is older than 24h and still has default "stall-" prefix (not renamed), delete it
                    if (now - stats.mtimeMs > MAX_AGE_MS) {
                        unlinkSync(fp);
                    }
                } catch { /* skip */ }
            }
        } catch { /* dashboard dir may not exist yet */ }
    }

    _writeState() {
        try {
            const json = JSON.stringify(this.state, null, 2);
            writeFileSync(this.stateFile, json);
            writeFileSync(this.localStateFile, json);
            // Also write a generic one in the dashboard dir as a fallback
            writeFileSync(join(DASHBOARD_DIR, 'stall-state.json'), json);
        } catch { /* ignore write errors */ }
    }

    /** Create a per-session HTML dashboard file that auto-refreshes from the state JSON */
    createSessionDashboard() {
        const htmlPath = join(DASHBOARD_DIR, `stall-${this.sessionId}.html`);
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🫕 Soupz Command Center — ${this.sessionId.slice(0, 4)}</title>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=JetBrains+Mono:wght@500;700&display=swap');
        :root {
            --bg: #050508; --card-bg: rgba(10, 10, 18, 0.8); --border: rgba(255, 255, 255, 0.08);
            --accent: #e94560; --accent-glow: rgba(233, 69, 96, 0.4); --text: #ffffff;
            --text-dim: #64748b; --green: #4ade80; --blue: #3b82f6; --yellow: #facc15;
            --font-mono: 'JetBrains Mono', monospace; --font-sans: 'Inter', sans-serif;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            background: var(--bg); color: var(--text); font-family: var(--font-sans); overflow-x: hidden;
            background-image: radial-gradient(circle at 0% 0%, rgba(233, 69, 96, 0.08) 0%, transparent 50%), radial-gradient(circle at 100% 100%, rgba(59, 130, 246, 0.08) 0%, transparent 50%);
            min-height: 100vh; padding: 24px;
        }
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; padding-bottom: 16px; border-bottom: 1px solid var(--border); }
        .logo-area { display: flex; align-items: center; gap: 12px; }
        .logo-icon { font-size: 32px; filter: drop-shadow(0 0 8px var(--accent-glow)); }
        .logo-text h1 { font-size: 20px; font-weight: 800; letter-spacing: -0.5px; }
        .logo-text p { font-size: 11px; color: var(--text-dim); }
        .status-badge { display: flex; align-items: center; gap: 8px; padding: 6px 12px; background: rgba(255,255,255,0.03); border: 1px solid var(--border); border-radius: 99px; font-size: 11px; font-weight: 600; }
        .status-dot { width: 6px; height: 6px; border-radius: 50%; }
        .status-dot.online { background: var(--green); box-shadow: 0 0 10px var(--green); }
        .status-dot.cooking { background: var(--yellow); animation: pulse 1s infinite; }
        .dashboard-grid { display: grid; grid-template-columns: repeat(12, 1fr); gap: 16px; }
        .card { background: var(--card-bg); backdrop-filter: blur(12px); border: 1px solid var(--border); border-radius: 12px; padding: 16px; position: relative; overflow: hidden; }
        .card-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: var(--accent); font-weight: 700; margin-bottom: 12px; display: block; }
        .stat-card { grid-column: span 3; }
        .stat-val { font-size: 28px; font-weight: 800; color: #fff; font-family: var(--font-mono); letter-spacing: -1px; }
        .floor-card { grid-column: span 12; height: 180px; display: flex; align-items: center; padding: 0 30px; }
        .kitchen-door { width: 50px; height: 80px; border: 2px solid var(--accent); border-radius: 4px 4px 0 0; background: #000; position: relative; margin-right: 30px; flex-shrink: 0; }
        .door-panel { width: 100%; height: 100%; background: var(--accent); transform-origin: left; transition: transform 0.8s; display: flex; align-items: center; justify-content: center; font-size: 8px; font-weight: 800; color: #000; writing-mode: vertical-rl; }
        .door-panel.open { transform: rotateY(-110deg); }
        .chef-assembly { display: flex; gap: 24px; align-items: flex-end; flex: 1; overflow-x: auto; }
        .chef-unit { display: flex; flex-direction: column; align-items: center; gap: 8px; position: relative; }
        .chef-avatar { font-size: 32px; transition: 0.3s; }
        .chef-tag { font-size: 9px; font-weight: 700; color: var(--text-dim); }
        .receipts-card { grid-column: span 8; }
        .top-chefs-card { grid-column: span 4; }
        .receipt-item { display: grid; grid-template-columns: 10px 1fr 80px; align-items: center; gap: 15px; padding: 12px; background: rgba(255,255,255,0.02); border-radius: 10px; margin-bottom: 6px; }
        .receipt-status { width: 8px; height: 8px; border-radius: 50%; }
        .receipt-prompt { font-family: var(--font-mono); font-size: 12px; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .leader-item { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
        .leader-info { flex: 1; }
        .leader-name { font-size: 12px; font-weight: 700; }
        .leader-bar-bg { width: 100%; height: 3px; background: rgba(255,255,255,0.05); border-radius: 2px; }
        .leader-bar-fill { height: 100%; border-radius: 2px; background: var(--blue); }
        .rec-card { grid-column: span 12; }
        .rec-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px; }
        .rec-item { padding: 12px; background: rgba(255,255,255,0.03); border-radius: 12px; border-left: 3px solid var(--accent); }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes bounce { from { transform: translateY(0); } to { transform: translateY(-5px); } }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo-area"><div class="logo-icon">🫕</div><div class="logo-text"><h1 id="stall-name">Stall ${this.sessionId.slice(0, 4)}</h1><p id="uptime">Uptime: 0m</p></div></div>
        <div class="status-badge"><div id="status-dot" class="status-dot online"></div><span id="status-text">KITCHEN READY</span></div>
    </div>
    <div class="dashboard-grid">
        <div class="card stat-card"><span class="card-label">Orders</span><div class="stat-val" id="total-orders">0</div></div>
        <div class="card stat-card"><span class="card-label">Success</span><div class="stat-val" id="success-rate">0%</div></div>
        <div class="card stat-card"><span class="card-label">Avg Speed</span><div class="stat-val" id="avg-time">0s</div></div>
        <div class="card stat-card"><span class="card-label">Stall Value</span><div class="stat-val" id="total-cost">$0.000</div></div>
        <div class="card floor-card"><div class="kitchen-door"><div id="door-leaf" class="door-panel">KITCHEN</div></div><div id="chef-assembly" class="chef-assembly"></div></div>
        <div class="card receipts-card"><span class="card-label">Recent Orders</span><div id="receipt-list"></div></div>
        <div class="card top-chefs-card"><span class="card-label">Elite Chefs</span><div id="leaderboard"></div></div>
        <div class="card rec-card"><span class="card-label">Chef's Insights</span><div id="recommendation-list" class="rec-grid"></div></div>
    </div>
    <script>
        const STATE_FILE = 'stall-${this.sessionId}.json';
        let lastTimestamp = 0; let knownChefIds = new Set();
        async function refresh() {
            try {
                const res = await fetch(STATE_FILE + '?t=' + Date.now());
                const data = await res.json();
                if (data.timestamp === lastTimestamp) return;
                lastTimestamp = data.timestamp;
                document.getElementById('stall-name').textContent = data.stall.name;
                document.getElementById('uptime').textContent = 'Uptime: ' + Math.floor(data.stall.uptime / 60000) + 'm';
                const dot = document.getElementById('status-dot');
                dot.className = 'status-dot ' + (data.stall.status === 'cooking' ? 'cooking' : 'online');
                document.getElementById('status-text').textContent = data.stall.status === 'cooking' ? 'CHEF IS COOKING' : 'STOVE READY';
                document.getElementById('total-orders').textContent = data.stats.totalOrders;
                const rate = data.stats.totalOrders > 0 ? Math.round((data.stats.completedOrders / data.stats.totalOrders) * 100) : 0;
                document.getElementById('success-rate').textContent = rate + '%';
                document.getElementById('avg-time').textContent = data.stats.avgCookTime ? (data.stats.avgCookTime / 1000).toFixed(1) + 's' : '0s';
                document.getElementById('total-cost').textContent = '$' + (data.tokens?.cost || 0).toFixed(3);
                const assembly = document.getElementById('chef-assembly');
                const activeIds = new Set(data.activeOrders.map(o => o.persona || o.agent));
                const onFloor = data.chefs.filter(c => c.calls > 0 || activeIds.has(c.id));
                let entered = false;
                onFloor.forEach(c => { if (!knownChefIds.has(c.id)) { knownChefIds.add(c.id); entered = true; } });
                if (entered) { document.getElementById('door-leaf').classList.add('open'); setTimeout(() => document.getElementById('door-leaf').classList.remove('open'), 1200); }
                assembly.innerHTML = onFloor.slice(0, 12).map(c => \`<div class="chef-unit"><div class="chef-avatar" style="\${activeIds.has(c.id) ? 'animation: bounce 0.5s infinite alternate' : ''}">\${c.icon}</div><div class="chef-tag">\${c.name.split(' ')[0]}</div></div>\`).join('');
                document.getElementById('receipt-list').innerHTML = (data.orders || []).slice(0, 5).map(o => \`<div class="receipt-item"><div class="receipt-status" style="background: \${o.status === 'served' ? 'var(--green)' : o.status === 'burnt' ? 'var(--red)' : 'var(--yellow)'}"></div><div class="receipt-prompt">\${o.isFleet ? '<span style="background:rgba(168,85,247,0.2);color:#c084fc;padding:1px 4px;border-radius:3px;font-size:8px;margin-right:6px;border:1px solid rgba(168,85,247,0.3)">FLEET</span>' : ''}\${o.prompt}</div><div style="font-size:10px; color:var(--text-dim); text-align:right">\${o.duration ? (o.duration / 1000).toFixed(1) + 's' : '...'}</div></div>\`).join('');
                document.getElementById('recommendation-list').innerHTML = (data.recommendations || []).map(r => \`<div class="rec-item" style="border-left-color: \${r.type === 'insight' ? 'var(--blue)' : 'var(--accent)'}"><div style="font-size: 9px; color: var(--text-dim); margin-bottom: 4px; text-transform: uppercase;">\${r.type}</div><div style="font-size: 12px; font-weight: 600;">\${r.text}</div></div>\`).join('');
                const top = Object.entries(data.grades).filter(([,v]) => v.usage > 0).sort((a,b) => b[1].grade - a[1].grade).slice(0, 5);
                document.getElementById('leaderboard').innerHTML = top.map(([id, v]) => \`<div class="leader-item"><div class="leader-info"><div class="leader-name">\${v.icon} \${v.name}</div><div class="leader-bar-bg"><div class="leader-bar-fill" style="width: \${v.grade}%; background: \${v.grade > 80 ? 'var(--green)' : 'var(--blue)'}"></div></div></div><div style="font-size:11px; font-weight:800;">\${Math.round(v.grade)}</div></div>\`).join('');
            } catch (e) { }
        }
        setInterval(refresh, 2000); refresh();
        gsap.from(".hero > *", { y: 20, opacity: 0, stagger: 0.1, duration: 1 });
        gsap.from(".card", { opacity: 0, y: 20, stagger: 0.05, duration: 0.8, delay: 0.3 });
    </script>
</body>
</html>`;
        writeFileSync(htmlPath, html);
        return htmlPath;
    }
}
