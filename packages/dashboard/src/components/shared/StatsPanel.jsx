import { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import {
  Trophy, Zap, TrendingUp, MessageSquare, Bot, Flame,
  Star, Check, Lock, ChevronDown, ChevronUp,
} from 'lucide-react';
import { cn } from '../../lib/cn';

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

export default function StatsPanel() {
  const [collapsed, setCollapsed] = useState(false);

  const messages   = readJSON(STORAGE_KEY, []);
  const usage      = readJSON(USAGE_KEY, {});
  const streak     = getStreak();

  const totalMsgs  = messages.filter(m => m.role === 'user').length;
  const agentCount = Object.keys(usage).length;
  const dailyData  = useMemo(() => getDailyActivity(messages), []);

  const earned = ACHIEVEMENTS.filter(a => a.req(totalMsgs, agentCount, streak));
  const locked = ACHIEVEMENTS.filter(a => !a.req(totalMsgs, agentCount, streak));

  return (
    <div className="border-t border-border-subtle">
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
        <div className="px-4 pb-4 space-y-4">
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
        </div>
      )}
    </div>
  );
}
