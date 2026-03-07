import { join } from 'path';
import { homedir } from 'os';
import { writeFileSync, mkdirSync, existsSync, unlinkSync, readdirSync, statSync } from 'fs';

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
        this.updateInterval = null;
        this.state = {
            sessionId: this.sessionId,
            timestamp: Date.now(),
            stall: { name: `Stall ${this.sessionId.slice(0, 4)}`, status: 'idle', uptime: 0 },
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
        this.updateInterval = setInterval(() => this._writeState(), 2000);
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
            this._refreshState();
            this._writeState();
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
            this._refreshState();
            this._writeState();
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
            this._refreshState();
            this._writeState();
        });

        o.on('chain-start', (data) => {
            this._refreshState();
            this._writeState();
        });

        o.on('fan-out', (data) => {
            this._refreshState();
            this._writeState();
        });
    }

    _refreshState() {
        this.state.timestamp = Date.now();
        this.state.stall.uptime = Date.now() - this.startTime;
        this.state.stall.status = this.state.activeOrders.length > 0 ? 'cooking' : 'idle';

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
            state: p.state || 'idle',
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
            state: t.state || 'idle',
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
            writeFileSync(this.stateFile, JSON.stringify(this.state, null, 2));
        } catch { /* ignore write errors */ }
    }

    /** Create a per-session HTML dashboard file that auto-refreshes from the state JSON */
    createSessionDashboard() {
        const htmlPath = join(DASHBOARD_DIR, `stall-${this.sessionId}.html`);
        const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>🫕 Stall ${this.sessionId.slice(0, 4)}</title>
<style>
:root{--bg:#0d1117;--card:#161b22;--border:#30363d;--text:#e6edf3;--dim:#8b949e;--accent:#58a6ff;--green:#3fb950;--yellow:#ffe66d;--red:#f85149;--purple:#bc8cff}
*{margin:0;padding:0;box-sizing:border-box}body{background:var(--bg);color:var(--text);font-family:'SF Mono','Fira Code',monospace;padding:16px}
h1{font-size:16px;margin-bottom:12px}.section{margin-bottom:20px}.section-title{font-size:11px;color:var(--dim);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px}
.token-bar{display:flex;gap:16px;background:var(--card);border:1px solid var(--border);border-radius:8px;padding:10px 14px}
.token-stat{display:flex;flex-direction:column}.token-label{font-size:9px;color:var(--dim)}.token-value{font-size:16px;font-weight:bold;color:var(--accent)}
.floor{display:flex;align-items:flex-end;gap:0;min-height:180px;background:linear-gradient(180deg,var(--bg) 0%,#1a1e26 60%,#22272e 100%);border-radius:10px;padding:16px 24px;position:relative;overflow:hidden;border:1px solid var(--border)}
.floor::after{content:'';position:absolute;bottom:0;left:0;right:0;height:36px;background:repeating-linear-gradient(90deg,#2d333b 0,#2d333b 60px,#22272e 60px,#22272e 62px);border-radius:0 0 10px 10px}
.door{width:50px;height:100px;position:relative;flex-shrink:0;margin-right:16px;z-index:2}
.door-frame{width:44px;height:90px;border:3px solid var(--yellow);border-radius:5px 5px 0 0;position:absolute;bottom:0;background:rgba(255,230,109,0.05)}
.door-panel{width:38px;height:82px;background:linear-gradient(180deg,#2d1f00,#1a1200);border-radius:3px 3px 0 0;position:absolute;bottom:3px;left:6px;transform-origin:left;transform:perspective(600px) rotateY(-75deg);transition:transform 0.8s}
.door-sign{position:absolute;top:-16px;left:50%;transform:translateX(-50%);font-size:8px;color:var(--yellow);white-space:nowrap}
.chef{display:flex;flex-direction:column;align-items:center;z-index:1;margin:0 6px;animation:enter 0.6s ease-out}
@keyframes enter{from{transform:translateX(-50px);opacity:0}to{transform:translateX(0);opacity:1}}
.chef-body{width:36px;height:50px;display:flex;flex-direction:column;align-items:center;cursor:pointer;position:relative}
.chef-hat{font-size:18px;line-height:1}.chef-face{width:24px;height:24px;background:var(--card);border:2px solid var(--border);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px}
.chef-apron{width:18px;height:14px;background:var(--card);border:1px solid var(--border);border-radius:0 0 5px 5px;margin-top:-2px}
.chef-name{font-size:7px;color:var(--dim);margin-top:3px;max-width:55px;text-align:center;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.chef-grade{font-size:6px;color:var(--accent)}
.chef-body.cooking{animation:bounce 0.6s ease infinite alternate}.chef-body.cooking .chef-apron{background:rgba(255,230,109,0.2);border-color:var(--yellow)}
@keyframes bounce{from{transform:translateY(0)}to{transform:translateY(-3px)}}
.dot{width:5px;height:5px;border-radius:50%;margin-top:2px}.dot.cooking{background:var(--yellow);animation:pulse 1s ease infinite}.dot.idle{background:var(--dim)}.dot.done{background:var(--green)}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
.bubble{display:none;position:absolute;bottom:60px;left:50%;transform:translateX(-50%);background:var(--card);border:1px solid var(--border);border-radius:8px;padding:4px 8px;font-size:8px;max-width:140px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;z-index:10}
.chef:hover .bubble{display:block}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px}
.card{background:var(--card);border:1px solid var(--border);border-radius:6px;padding:8px;display:flex;gap:8px;align-items:center;transition:transform 0.2s}
.card:hover{transform:translateY(-2px);border-color:var(--accent)}
.card-icon{font-size:20px}.card-info{flex:1}.card-name{font-size:11px;font-weight:bold}.card-task{font-size:9px;color:var(--dim);margin-top:1px}.card-grade{font-size:8px;color:var(--purple);margin-top:1px}
.orders{background:var(--card);border:1px solid var(--border);border-radius:6px;padding:8px;font-size:10px;max-height:200px;overflow-y:auto}
.order{padding:3px 0;border-bottom:1px solid var(--border)}.order:last-child{border:none}
.order-status{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:4px}
.order-status.cooking{background:var(--yellow)}.order-status.served{background:var(--green)}.order-status.burnt{background:var(--red)}
#last-update{font-size:9px;color:var(--dim);position:fixed;bottom:8px;right:12px}
</style></head><body>
<h1>🫕 Soupz Stall — <span id="stall-name">Stall ${this.sessionId.slice(0, 4)}</span></h1>
<div class="section"><div class="section-title">📊 Tokens</div><div class="token-bar" id="tokens"></div></div>
<div class="section"><div class="section-title">🏪 Kitchen Floor</div><div class="floor" id="floor"><div class="door"><div class="door-sign">🫕 ENTRANCE</div><div class="door-frame"><div class="door-panel"></div></div></div></div></div>
<div class="section"><div class="section-title">👨‍🍳 Active Chefs</div><div class="cards" id="chef-cards"></div></div>
<div class="section"><div class="section-title">📝 Orders</div><div class="orders" id="orders"></div></div>
<div id="last-update">Loading...</div>
<script>
const STATE_FILE = 'stall-${this.sessionId}.json';
async function refresh(){
  try{
    const res=await fetch(STATE_FILE+'?t='+Date.now());
    if(!res.ok)return;
    const s=await res.json();
    document.getElementById('stall-name').textContent=s.stall.name+' ('+s.stall.status+')';
    // Tokens
    const t=s.tokens||{};
    document.getElementById('tokens').innerHTML=
      '<div class="token-stat"><span class="token-label">Total</span><span class="token-value">'+(t.total||0).toLocaleString()+'</span></div>'+
      '<div class="token-stat"><span class="token-label">Cost</span><span class="token-value" style="color:var(--green)">$'+(t.cost||0).toFixed(4)+'</span></div>';
    // Floor chefs
    const floor=document.getElementById('floor');
    const door=floor.querySelector('.door').outerHTML;
    const activeChefs=(s.chefs||[]).filter(c=>c.calls>0||c.state==='cooking');
    floor.innerHTML=door+activeChefs.map((c,i)=>'<div class="chef" style="animation-delay:'+(i*0.15)+'s"><div class="bubble">'+(c.task||'Waiting...')+'</div><div class="chef-body '+(c.state||'idle')+'"><div class="chef-hat">👨‍🍳</div><div class="chef-face">'+(c.icon||'🍳')+'</div><div class="chef-apron"></div></div><div class="dot '+(c.state||'idle')+'"></div><div class="chef-name">'+c.name+'</div><div class="chef-grade">⭐ '+c.grade+'</div></div>').join('');
    // Chef cards
    document.getElementById('chef-cards').innerHTML=(s.chefs||[]).filter(c=>c.calls>0).map(c=>'<div class="card"><div class="card-icon">'+(c.icon||'🍳')+'</div><div class="card-info"><div class="card-name">'+c.name+'</div><div class="card-task">Calls: '+c.calls+'</div><div class="card-grade">Grade: '+c.grade+'</div></div></div>').join('')||(s.chefs||[]).length>0?'<div style="color:var(--dim);font-size:10px">No chefs called yet</div>':'';
    // Orders
    document.getElementById('orders').innerHTML=(s.orders||[]).slice(0,20).map(o=>'<div class="order"><span class="order-status '+o.status+'"></span><b>'+o.agent+'</b>'+(o.persona?' → '+o.persona:'')+': '+o.prompt+(o.duration?' <span style="color:var(--dim)">('+(o.duration/1000).toFixed(1)+'s)</span>':'')+'</div>').join('')||'<div style="color:var(--dim)">No orders yet</div>';
    document.getElementById('last-update').textContent='Last updated: '+new Date().toLocaleTimeString();
  }catch(e){document.getElementById('last-update').textContent='Waiting for stall data...';}
}
refresh();setInterval(refresh,2000);
</script></body></html>`;
        writeFileSync(htmlPath, html);
        return htmlPath;
    }
}
