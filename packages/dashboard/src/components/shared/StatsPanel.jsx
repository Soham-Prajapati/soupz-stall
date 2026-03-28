import { useState, useMemo, useEffect } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import {
  Trophy, Zap, TrendingUp, MessageSquare, Bot, Flame,
  Star, Check, Lock, ChevronDown, ChevronUp, Crown,
  Activity, Loader2, Settings
} from 'lucide-react';
import { cn } from '../../lib/cn';
import { CLI_AGENTS } from '../../lib/agents';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import LeaderboardPanel from './LeaderboardPanel';

const STORAGE_KEY = 'soupz_chat_history';
const USAGE_KEY   = 'soupz_agent_usage';
const STREAK_KEY  = 'soupz_streak';

function readJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; }
}

// Achievements definition
const ACHIEVEMENTS = [
  { id: 'first_message',    icon: MessageSquare, label: 'First Step',      desc: 'Send your first message',          color: '#6366F1', req: (msgs)              => msgs >= 1   },
  { id: 'ten_messages',     icon: Zap,           label: 'Getting Started', desc: 'Send 10 messages',                  color: '#F59E0B', req: (msgs)              => msgs >= 10  },
  { id: 'fifty_messages',   icon: TrendingUp,    label: 'Power User',      desc: 'Send 50 messages',                  color: '#22C55E', req: (msgs)              => msgs >= 50  },
  { id: 'hundred_messages', icon: Star,          label: 'Century',         desc: '100 messages sent',                 color: '#EF4444', req: (msgs)              => msgs >= 100 },
  { id: 'multi_agent',      icon: Bot,           label: 'Agent Collector', desc: 'Use 3+ different agents',           color: '#8B5CF6', req: (_, agents)         => agents >= 3 },
  { id: 'streak_3',         icon: Flame,         label: 'On Fire',         desc: 'Use Soupz 3 days in a row',         color: '#F97316', req: (_, __, streak)     => streak >= 3 },
  { id: 'streak_7',         icon: Trophy,        label: 'Weekly Warrior',  desc: '7-day usage streak',                color: '#EAB308', req: (_, __, streak)     => streak >= 7 },
];

function getStreak() {
  const today     = new Date().toDateString();
  const streak    = readJSON(STREAK_KEY, { count: 0, lastDay: null });
  const yesterday = new Date(Date.now() - 86400000).toDateString();

  if (streak.lastDay === today) return streak.count;

  if (streak.lastDay === yesterday) {
    const newStreak = { count: streak.count + 1, lastDay: today };
    localStorage.setItem(STREAK_KEY, JSON.stringify(newStreak));
    return newStreak.count;
  }

  // Reset streak — first visit today after a gap
  const newStreak = { count: 1, lastDay: today };
  localStorage.setItem(STREAK_KEY, JSON.stringify(newStreak));
  return 1;
}

function getDailyActivity(messages) {
  const counts = {};
  const now    = Date.now();

  // Seed the last 7 days so every day always appears
  for (let i = 6; i >= 0; i--) {
    const d   = new Date(now - i * 86400000);
    const key = d.toLocaleDateString('en', { weekday: 'short' });
    counts[key] = 0;
  }

  for (const msg of messages) {
    if (msg.role !== 'user') continue;
    const d   = new Date(msg.id); // id is a timestamp
    const age = (now - d.getTime()) / 86400000;
    if (age <= 7) {
      const key = d.toLocaleDateString('en', { weekday: 'short' });
      if (counts[key] !== undefined) counts[key]++;
    }
  }

  return Object.entries(counts).map(([day, count]) => ({ day, count }));
}

export default function StatsPanel({ workspace }) {
  const activeFleet = workspace?.activeFleet || [];
  const [collapsed, setCollapsed] = useState(false);
  const [lbCollapsed, setLbCollapsed] = useState(false);
  const [highlightedAgent, setHighlightedAgent] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  // Fetch current user on mount
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUser(session?.user || null);
    });
  }, []);

  // Listen for agent click events
  useState(() => {
    function handleShowStats(e) {
      setCollapsed(false);
      setHighlightedAgent(e.detail.agentId);
      // Auto-scroll to stats panel if needed
      setTimeout(() => {
        document.querySelector('[data-stats-panel]')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
    window.addEventListener('soupz_show_agent_stats', handleShowStats);
    return () => window.removeEventListener('soupz_show_agent_stats', handleShowStats);
  }, []);

  const messages   = readJSON(STORAGE_KEY, []);
  const usage      = readJSON(USAGE_KEY, {});
  const streak     = getStreak();

  const totalMsgs  = messages.filter(m => m.role === 'user').length;
  const agentCount = Object.keys(usage).length;
  const dailyData  = useMemo(() => getDailyActivity(messages), []);

  // Calculate XP same way as LeaderboardPanel
  const ACHIEVEMENT_IDS = [
    { req: (m) => m >= 1 },
    { req: (m) => m >= 10 },
    { req: (m) => m >= 50 },
    { req: (m) => m >= 100 },
    { req: (_, a) => a >= 3 },
    { req: (_, __, s) => s >= 3 },
    { req: (_, __, s) => s >= 7 },
  ];
  const achieveCount = ACHIEVEMENT_IDS.filter(a => a.req(totalMsgs, agentCount, streak)).length;
  const xp = (totalMsgs * 10) + (streak * 50) + (achieveCount * 100);

  // Sync stats to Supabase every 60 seconds
  useEffect(() => {
    if (!isSupabaseConfigured() || !currentUser) return;

    async function syncStats() {
      try {
        const { error } = await supabase
          .from('soupz_profiles')
          .upsert({
            id: currentUser.id,
            xp: xp,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'id' });
        if (error) console.error('Stats sync error:', error);
      } catch (err) {
        console.error('Failed to sync stats:', err);
      }
    }

    const interval = setInterval(syncStats, 60000);
    return () => clearInterval(interval);
  }, [xp, currentUser]);

  // Sync stats on window blur
  useEffect(() => {
    if (!isSupabaseConfigured() || !currentUser) return;

    async function syncStatsOnBlur() {
      try {
        await supabase
          .from('soupz_profiles')
          .upsert({
            id: currentUser.id,
            xp: xp,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'id' });
      } catch (err) {
        console.error('Failed to sync stats on blur:', err);
      }
    }

    window.addEventListener('blur', syncStatsOnBlur);
    return () => window.removeEventListener('blur', syncStatsOnBlur);
  }, [xp, currentUser]);

  const topAgents = useMemo(() => {
    return Object.entries(usage)
      .filter(([, count]) => count > 0)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([id, count]) => {
        const agent = CLI_AGENTS.find(a => a.id === id);
        return { id, name: agent?.name || id, color: agent?.color || '#888', count };
      });
  }, [usage]);

  const maxUsage = topAgents.length > 0 ? topAgents[0].count : 1;

  const earned = ACHIEVEMENTS.filter(a => a.req(totalMsgs, agentCount, streak));
  const locked = ACHIEVEMENTS.filter(a => !a.req(totalMsgs, agentCount, streak));

  return (
    <div className="border-t border-border-subtle" data-stats-panel>
      {/* Header / collapse toggle */}
      <button
        onClick={() => setCollapsed(v => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-bg-elevated transition-colors"
      >
        <div className="flex items-center gap-2">
          <Trophy size={13} className="text-warning" />
          <span className="text-xs font-ui font-medium text-text-sec">Stats & Achievements</span>
          {earned.length > 0 && (
            <span className="text-[10px] bg-warning/10 text-warning px-1.5 py-0.5 rounded font-mono">
              {earned.length}/{ACHIEVEMENTS.length}
            </span>
          )}
        </div>
        {collapsed
          ? <ChevronDown size={12} className="text-text-faint" />
          : <ChevronUp   size={12} className="text-text-faint" />
        }
      </button>

      {!collapsed && (
        <div className="px-4 pb-4 space-y-6">
          {/* Agent Usage — Flat VS Code Style */}
          <div>
            <p className="text-[10px] font-bold text-[#858585] uppercase tracking-[0.1em] mb-4">Agent Usage</p>
            <div className="space-y-5">
              {topAgents.map(agent => (
                <div key={agent.id} className="space-y-2">
                  <div className="flex items-center justify-between text-[13px]">
                    <div className="flex items-center gap-2 text-[#D4D4D4]">
                      <Bot size={14} style={{ color: agent.color }} />
                      <span className="font-medium">{agent.name}</span>
                    </div>
                    <div className="text-right leading-tight">
                      <div className="text-[#858585] text-[11px] font-mono">{agent.count} msg</div>
                      <div className="text-[#666666] text-[10px] font-mono">~{(agent.count * 800 / 1000).toFixed(1)}k tok</div>
                    </div>
                  </div>
                  <div className="h-1.5 bg-[#2D2D30] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${Math.max((agent.count / maxUsage) * 100, 4)}%`,
                        backgroundColor: '#40A6FF', // Using your screenshot's blue bar color
                      }}
                    />
                  </div>
                </div>
              ))}
              {topAgents.length === 0 && (
                <p className="text-xs text-[#858585] italic py-2">No agent shards active in this quadrant.</p>
              )}
            </div>
          </div>

          {/* Quick-stats row */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Messages', value: totalMsgs,     icon: MessageSquare, color: 'text-accent'   },
              { label: 'Streak',   value: `${streak}d`,  icon: Flame,         color: 'text-warning'  },
              { label: 'Agents',   value: agentCount,    icon: Bot,           color: 'text-success'  },
            ].map(({ label, value, icon: Icon, color }) => (
              <div
                key={label}
                className="bg-bg-elevated border border-border-subtle rounded-lg p-2 text-center"
              >
                <Icon size={14} className={cn('mx-auto mb-1', color)} />
                <div className="text-sm font-ui font-semibold text-text-pri">{value}</div>
                <div className="text-[10px] text-text-faint font-ui">{label}</div>
              </div>
            ))}
          </div>

          {/* Removed Mock Premium Tracking Section */}
          {/* Daily activity chart */}
          {totalMsgs > 0 && (
            <div>
              <p className="text-[11px] text-text-faint font-ui mb-1.5">Last 7 days</p>
              <ResponsiveContainer width="100%" height={60}>
                <BarChart data={dailyData} barSize={12}>
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 9, fill: 'var(--text-faint)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background:   'var(--bg-elevated)',
                      border:       '1px solid var(--border-mid)',
                      borderRadius: 6,
                      fontSize:     11,
                    }}
                    itemStyle={{ color: 'var(--text-pri)' }}
                    cursor={{ fill: 'var(--accent-muted)' }}
                  />
                  <Bar dataKey="count" fill="var(--accent)" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Usage breakdown */}
          {agentCount > 0 && (
            <div>
              <p className="text-[11px] text-text-faint font-ui mb-2">Usage Breakdown</p>
              <div className="space-y-1.5">
                {Object.entries(usage).sort((a,b) => b[1] - a[1]).map(([id, count]) => (
                  <div key={id} className={cn(
                    "flex items-center justify-between py-1 px-2 rounded transition-colors",
                    highlightedAgent === id ? "bg-accent/10 border border-accent/20" : ""
                  )}>
                    <span className={cn(
                      "text-[11px] font-mono uppercase",
                      highlightedAgent === id ? "text-accent font-bold" : "text-text-sec"
                    )}>{id}</span>
                    <span className="text-[11px] font-mono text-accent">{count} calls</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ecosystem Insights (Personal Growth) */}
          {agentCount > 0 && (
            <div className="bg-bg-elevated/50 border border-border-subtle rounded-xl p-3 space-y-3">
              <div className="flex items-center gap-2">
                <Activity size={12} className="text-accent" />
                <span className="text-[10px] font-bold text-text-pri uppercase tracking-widest">Ecosystem Insights</span>
              </div>
              <div className="h-32 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={Object.entries(usage).map(([id, count]) => ({ id, count }))}>
                    <XAxis 
                      dataKey="id" 
                      tick={{ fontSize: 8, fill: 'var(--text-faint)' }} 
                      axisLine={false} 
                      tickLine={false}
                    />
                    <Tooltip 
                      contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-mid)', borderRadius: 8 }}
                      itemStyle={{ fontSize: 10, color: 'var(--accent)' }}
                    />
                    <Bar dataKey="count" fill="var(--accent)" radius={[4, 4, 0, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[9px] text-text-faint text-center italic">Agent diversity score: {Math.round((agentCount / 5) * 100)}%</p>
            </div>
          )}

          {/* Achievements list */}
          <div>
            <p className="text-[11px] text-text-faint font-ui mb-2">Achievements</p>
            <div className="space-y-1.5">
              {earned.map(a => (
                <div key={a.id} className="flex items-center gap-2.5 py-1">
                  <div
                    className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                    style={{ background: `${a.color}15` }}
                  >
                    <a.icon size={12} style={{ color: a.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-ui font-medium text-text-pri">{a.label}</p>
                    <p className="text-[10px] text-text-faint">{a.desc}</p>
                  </div>
                  <Check size={12} className="text-success shrink-0" />
                </div>
              ))}

              {locked.slice(0, 3).map(a => (
                <div key={a.id} className="flex items-center gap-2.5 py-1 opacity-40">
                  <div className="w-6 h-6 rounded-md bg-bg-elevated border border-border-subtle flex items-center justify-center shrink-0">
                    <Lock size={10} className="text-text-faint" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-ui font-medium text-text-faint">{a.label}</p>
                    <p className="text-[10px] text-text-faint">{a.desc}</p>
                  </div>
                </div>
              ))}

              {locked.length === 0 && (
                <p className="text-[11px] text-success font-ui py-1">
                  All achievements unlocked!
                </p>
              )}
            </div>
          </div>

          {/* Leaderboard — collapsible subsection */}
          <div className="border-t border-border-subtle pt-3">
            <button
              onClick={() => setLbCollapsed(v => !v)}
              className="w-full flex items-center justify-between mb-2"
            >
              <div className="flex items-center gap-2">
                <Crown size={12} className="text-warning" />
                <span className="text-[11px] font-ui font-medium text-text-sec">Leaderboard</span>
              </div>
              {lbCollapsed
                ? <ChevronDown size={11} className="text-text-faint" />
                : <ChevronUp   size={11} className="text-text-faint" />
              }
            </button>
            {!lbCollapsed && <LeaderboardPanel />}
          </div>
        </div>
      )}
    </div>
  );
}
