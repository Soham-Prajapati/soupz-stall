import { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import {
  User, Mail, Calendar, MessageSquare, Flame, Bot, Trophy,
  Zap, TrendingUp, Star, Check, Lock, ArrowLeft, Trash2, LogOut,
  Save, AlertTriangle,
} from 'lucide-react';
import { cn } from '../../lib/cn';
import { CLI_AGENTS } from '../../lib/agents.js';

const STORAGE_KEY = 'soupz_chat_history';
const USAGE_KEY   = 'soupz_agent_usage';
const STREAK_KEY  = 'soupz_streak';
const PROFILE_KEY = 'soupz_profile';

function readJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; }
}

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
  if (streak.lastDay === yesterday) return streak.count + 1;
  return streak.count > 0 ? 0 : 0;
}

function getDailyActivity(messages) {
  const counts = {};
  const now    = Date.now();
  for (let i = 6; i >= 0; i--) {
    const d   = new Date(now - i * 86400000);
    const key = d.toLocaleDateString('en', { weekday: 'short' });
    counts[key] = 0;
  }
  for (const msg of messages) {
    if (msg.role !== 'user') continue;
    const d   = new Date(msg.id);
    const age = (now - d.getTime()) / 86400000;
    if (age <= 7) {
      const key = d.toLocaleDateString('en', { weekday: 'short' });
      if (counts[key] !== undefined) counts[key]++;
    }
  }
  return Object.entries(counts).map(([day, count]) => ({ day, count }));
}

function getInitials(name, email) {
  if (name) {
    const parts = name.trim().split(/\s+/);
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return '??';
}

function getMemberSince(user) {
  if (user?.created_at) {
    return new Date(user.created_at).toLocaleDateString('en', { month: 'short', year: 'numeric' });
  }
  // Fallback: check oldest message timestamp
  const messages = readJSON(STORAGE_KEY, []);
  if (messages.length > 0) {
    const oldest = messages.reduce((min, m) => (m.id < min ? m.id : min), messages[0].id);
    return new Date(oldest).toLocaleDateString('en', { month: 'short', year: 'numeric' });
  }
  return 'Recently';
}

function getTopAgentsWithCounts(n = 5) {
  const usage = readJSON(USAGE_KEY, {});
  return Object.entries(usage)
    .filter(([, count]) => count > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, n)
    .map(([id, count]) => {
      const agent = CLI_AGENTS.find(a => a.id === id);
      return { id, name: agent?.name || id, color: agent?.color || '#888', count };
    });
}

export default function ProfilePage({ user, navigate, onSignOut }) {
  const profile     = readJSON(PROFILE_KEY, {});
  const [displayName, setDisplayName] = useState(
    () => profile.displayName || user?.user_metadata?.full_name || user?.user_metadata?.name || '',
  );
  const [saved, setSaved]             = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const messages   = readJSON(STORAGE_KEY, []);
  const usage      = readJSON(USAGE_KEY, {});
  const streak     = getStreak();
  const totalMsgs  = messages.filter(m => m.role === 'user').length;
  const agentCount = Object.keys(usage).length;
  const dailyData  = useMemo(() => getDailyActivity(messages), []);
  const topAgents  = useMemo(() => getTopAgentsWithCounts(5), []);
  const maxUsage   = topAgents.length > 0 ? topAgents[0].count : 1;

  const earned = ACHIEVEMENTS.filter(a => a.req(totalMsgs, agentCount, streak));
  const locked = ACHIEVEMENTS.filter(a => !a.req(totalMsgs, agentCount, streak));

  const avatarUrl  = user?.user_metadata?.avatar_url;
  const email      = user?.email || 'local@soupz.app';
  const userName   = displayName || user?.user_metadata?.full_name || user?.user_metadata?.name || email.split('@')[0];
  const memberSince = getMemberSince(user);

  function handleSaveProfile() {
    const prev = readJSON(PROFILE_KEY, {});
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ ...prev, displayName: displayName.trim() }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleClearData() {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    // Clear all soupz localStorage keys
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('soupz_')) keysToRemove.push(key);
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
    setConfirmClear(false);
    window.location.reload();
  }

  return (
    <div className="min-h-screen bg-bg-base overflow-y-auto custom-scrollbar">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Back nav */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-text-faint hover:text-text-sec text-xs font-ui transition-colors mb-6"
        >
          <ArrowLeft size={14} />
          Back to dashboard
        </button>

        {/* Avatar + identity */}
        <div className="bg-bg-surface border border-border-subtle rounded-xl p-6 mb-4">
          <div className="flex items-center gap-4">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt=""
                className="w-16 h-16 rounded-full border-2 border-border-subtle"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-accent to-accent-hover flex items-center justify-center shrink-0">
                <span className="text-white font-ui font-bold text-lg">{getInitials(userName, email)}</span>
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-lg font-ui font-semibold text-text-pri truncate">{userName}</h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Mail size={11} className="text-text-faint shrink-0" />
                <span className="text-xs font-ui text-text-faint truncate">{email}</span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Calendar size={11} className="text-text-faint shrink-0" />
                <span className="text-xs font-ui text-text-faint">Member since {memberSince}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          {[
            { label: 'Messages', value: totalMsgs,       icon: MessageSquare, color: 'text-accent'  },
            { label: 'Streak',   value: `${streak}d`,    icon: Flame,         color: 'text-warning' },
            { label: 'Agents',   value: agentCount,      icon: Bot,           color: 'text-success' },
            { label: 'Earned',   value: earned.length,   icon: Trophy,        color: 'text-warning' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div
              key={label}
              className="bg-bg-surface border border-border-subtle rounded-lg p-3 text-center"
            >
              <Icon size={16} className={cn('mx-auto mb-1.5', color)} />
              <div className="text-base font-ui font-semibold text-text-pri">{value}</div>
              <div className="text-[10px] text-text-faint font-ui">{label}</div>
            </div>
          ))}
        </div>

        {/* 7-day activity */}
        <div className="bg-bg-surface border border-border-subtle rounded-xl p-4 mb-4">
          <p className="text-xs font-ui font-medium text-text-sec mb-3">Activity -- Last 7 days</p>
          {totalMsgs > 0 ? (
            <ResponsiveContainer width="100%" height={100}>
              <BarChart data={dailyData} barSize={20}>
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 10, fill: 'var(--text-faint)' }}
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
                <Bar dataKey="count" fill="var(--accent)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-text-faint font-ui py-4 text-center">No activity yet. Start chatting to see your chart.</p>
          )}
        </div>

        {/* Top agents */}
        {topAgents.length > 0 && (
          <div className="bg-bg-surface border border-border-subtle rounded-xl p-4 mb-4">
            <p className="text-xs font-ui font-medium text-text-sec mb-3">Top Agents</p>
            <div className="space-y-2.5">
              {topAgents.map(agent => (
                <div key={agent.id} className="flex items-center gap-3">
                  <span className="text-xs font-ui text-text-sec w-24 truncate shrink-0">{agent.name}</span>
                  <div className="flex-1 h-2 bg-bg-elevated rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.max((agent.count / maxUsage) * 100, 4)}%`,
                        backgroundColor: agent.color,
                      }}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-text-faint w-8 text-right shrink-0">
                    {agent.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Achievements */}
        <div className="bg-bg-surface border border-border-subtle rounded-xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <p className="text-xs font-ui font-medium text-text-sec">Achievements</p>
            <span className="text-[10px] bg-warning/10 text-warning px-1.5 py-0.5 rounded font-mono">
              {earned.length}/{ACHIEVEMENTS.length}
            </span>
          </div>
          <div className="space-y-1.5">
            {earned.map(a => (
              <div key={a.id} className="flex items-center gap-2.5 py-1">
                <div
                  className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                  style={{ background: `${a.color}15` }}
                >
                  <a.icon size={13} style={{ color: a.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-ui font-medium text-text-pri">{a.label}</p>
                  <p className="text-[10px] text-text-faint">{a.desc}</p>
                </div>
                <Check size={12} className="text-success shrink-0" />
              </div>
            ))}
            {locked.map(a => (
              <div key={a.id} className="flex items-center gap-2.5 py-1 opacity-40">
                <div className="w-7 h-7 rounded-md bg-bg-elevated border border-border-subtle flex items-center justify-center shrink-0">
                  <Lock size={11} className="text-text-faint" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-ui font-medium text-text-faint">{a.label}</p>
                  <p className="text-[10px] text-text-faint">{a.desc}</p>
                </div>
              </div>
            ))}
            {locked.length === 0 && (
              <p className="text-[11px] text-success font-ui py-1">All achievements unlocked!</p>
            )}
          </div>
        </div>

        {/* Edit Profile */}
        <div className="bg-bg-surface border border-border-subtle rounded-xl p-4 mb-4">
          <p className="text-xs font-ui font-medium text-text-sec mb-3">Edit Profile</p>
          <div className="space-y-3">
            <div>
              <label className="text-[11px] font-ui text-text-faint block mb-1">Display Name</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="Your display name"
                  className="flex-1 bg-bg-elevated border border-border-subtle rounded-md px-3 py-1.5 text-sm font-ui text-text-pri placeholder:text-text-faint focus:outline-none focus:border-accent transition-colors"
                />
                <button
                  onClick={handleSaveProfile}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-ui font-medium transition-all',
                    saved
                      ? 'bg-success/10 text-success border border-success/20'
                      : 'bg-accent/10 text-accent hover:bg-accent/20 border border-accent/20',
                  )}
                >
                  {saved ? <Check size={12} /> : <Save size={12} />}
                  {saved ? 'Saved' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-bg-surface border border-error/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={13} className="text-error" />
            <p className="text-xs font-ui font-medium text-error">Danger Zone</p>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-ui text-text-pri">Clear All Data</p>
                <p className="text-[10px] text-text-faint">Remove all chat history, stats, and preferences</p>
              </div>
              <button
                onClick={handleClearData}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-ui font-medium transition-all',
                  confirmClear
                    ? 'bg-error text-white'
                    : 'bg-error/10 text-error hover:bg-error/20 border border-error/20',
                )}
              >
                <Trash2 size={12} />
                {confirmClear ? 'Confirm' : 'Clear'}
              </button>
            </div>
            {confirmClear && (
              <div className="flex items-center gap-2">
                <p className="text-[10px] text-error font-ui flex-1">This cannot be undone. Click Confirm to proceed.</p>
                <button
                  onClick={() => setConfirmClear(false)}
                  className="text-[10px] text-text-faint hover:text-text-sec font-ui transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
            {onSignOut && (
              <div className="flex items-center justify-between pt-2 border-t border-border-subtle">
                <div>
                  <p className="text-xs font-ui text-text-pri">Sign Out</p>
                  <p className="text-[10px] text-text-faint">Sign out of your account</p>
                </div>
                <button
                  onClick={async () => {
                    await onSignOut();
                    navigate('/');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-ui font-medium bg-bg-elevated text-text-sec hover:text-text-pri border border-border-subtle hover:border-border-mid transition-all"
                >
                  <LogOut size={12} />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
