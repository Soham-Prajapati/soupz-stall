import { useMemo } from 'react';
import {
  Crown, Shield, Sword, Hammer, Sparkles,
  Flame, MessageSquare, Target, Lock, Check,
  ChevronRight, Award,
} from 'lucide-react';
import { cn } from '../../lib/cn';

// ---------------------------------------------------------------------------
// Storage helpers (mirrors StatsPanel pattern)
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'soupz_chat_history';
const USAGE_KEY   = 'soupz_agent_usage';
const STREAK_KEY  = 'soupz_streak';

function readJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; }
}

// ---------------------------------------------------------------------------
// Rank definitions
// ---------------------------------------------------------------------------

const RANKS = [
  { min: 1,  label: 'Beginner',  icon: Shield,   color: '#9CA3AF' },
  { min: 5,  label: 'Builder',   icon: Hammer,    color: '#6366F1' },
  { min: 10, label: 'Architect', icon: Sparkles,  color: '#22C55E' },
  { min: 20, label: 'Master',    icon: Sword,     color: '#F59E0B' },
  { min: 35, label: 'Legend',    icon: Crown,     color: '#EF4444' },
];

function getRank(level) {
  let rank = RANKS[0];
  for (const r of RANKS) {
    if (level >= r.min) rank = r;
  }
  return rank;
}

// ---------------------------------------------------------------------------
// Milestones
// ---------------------------------------------------------------------------

const MILESTONES = [
  { xp: 100,   label: 'First Steps',         desc: 'Earn 100 XP'     },
  { xp: 500,   label: 'Getting Warmed Up',    desc: 'Earn 500 XP'     },
  { xp: 1000,  label: 'Building Momentum',    desc: 'Earn 1,000 XP'   },
  { xp: 2500,  label: 'Code Warrior',         desc: 'Earn 2,500 XP'   },
  { xp: 5000,  label: '10x Developer',        desc: 'Earn 5,000 XP'   },
  { xp: 10000, label: 'Legendary',            desc: 'Earn 10,000 XP'  },
];

// ---------------------------------------------------------------------------
// Mock leaderboard entries (placeholder community data)
// ---------------------------------------------------------------------------

const MOCK_ENTRIES = [
  { name: 'NightOwlDev',   xp: 8420 },
  { name: 'PixelArchitect', xp: 6150 },
  { name: 'TerminalNinja',  xp: 4800 },
  { name: 'AsyncAlice',     xp: 3200 },
  { name: 'ByteSmith',      xp: 1900 },
  { name: 'CodeCadet',      xp: 750  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeXP(totalMsgs, streakDays, achievementCount) {
  return (totalMsgs * 10) + (streakDays * 50) + (achievementCount * 100);
}

function getLevel(xp) {
  return Math.max(1, Math.floor(xp / 500) + 1);
}

function getLevelProgress(xp) {
  const currentLevelXP = (getLevel(xp) - 1) * 500;
  const nextLevelXP    = currentLevelXP + 500;
  const progress       = xp - currentLevelXP;
  return { progress, needed: 500, pct: Math.min(progress / 500, 1) };
}

function formatXP(xp) {
  if (xp >= 10000) return `${(xp / 1000).toFixed(1)}k`;
  if (xp >= 1000)  return `${(xp / 1000).toFixed(1)}k`;
  return String(xp);
}

// Reuse achievement count logic from StatsPanel
const ACHIEVEMENT_IDS = [
  { req: (m) => m >= 1 },
  { req: (m) => m >= 10 },
  { req: (m) => m >= 50 },
  { req: (m) => m >= 100 },
  { req: (_, a) => a >= 3 },
  { req: (_, __, s) => s >= 3 },
  { req: (_, __, s) => s >= 7 },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function LeaderboardPanel() {
  const messages       = readJSON(STORAGE_KEY, []);
  const usage          = readJSON(USAGE_KEY, {});
  const streakData     = readJSON(STREAK_KEY, { count: 0, lastDay: null });

  const totalMsgs      = messages.filter(m => m.role === 'user').length;
  const agentCount     = Object.keys(usage).length;
  const streak         = streakData.count || 0;
  const achieveCount   = ACHIEVEMENT_IDS.filter(a => a.req(totalMsgs, agentCount, streak)).length;

  const xp             = computeXP(totalMsgs, streak, achieveCount);
  const level          = getLevel(xp);
  const rank           = getRank(level);
  const { progress, needed, pct } = getLevelProgress(xp);

  // Build combined leaderboard (user + mocks), sorted descending
  const leaderboard = useMemo(() => {
    const entries = [
      ...MOCK_ENTRIES.map(e => ({ ...e, isUser: false })),
      { name: 'You', xp, isUser: true },
    ];
    entries.sort((a, b) => b.xp - a.xp);
    return entries.map((e, i) => ({ ...e, position: i + 1 }));
  }, [xp]);

  const RankIcon = rank.icon;

  return (
    <div className="space-y-4">
      {/* Your Stats card */}
      <div className="bg-bg-elevated border border-border-subtle rounded-lg p-3">
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: `${rank.color}18` }}
          >
            <RankIcon size={18} style={{ color: rank.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-ui font-semibold text-text-pri">
                Level {level}
              </span>
              <span
                className="text-[10px] font-ui font-medium px-1.5 py-0.5 rounded"
                style={{ background: `${rank.color}18`, color: rank.color }}
              >
                {rank.label}
              </span>
            </div>
            <p className="text-[11px] text-text-faint font-ui">
              {formatXP(xp)} XP total
            </p>
          </div>
        </div>

        {/* Progress bar to next level */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-text-faint font-ui">Level {level}</span>
            <span className="text-[10px] text-text-faint font-ui">Level {level + 1}</span>
          </div>
          <div className="h-1.5 bg-bg-base rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.max(pct * 100, 2)}%`,
                background: rank.color,
              }}
            />
          </div>
          <p className="text-[10px] text-text-faint font-ui mt-1 text-right">
            {progress} / {needed} XP
          </p>
        </div>

        {/* Quick stat pills */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'XP',       value: formatXP(xp), icon: Award,          color: 'text-accent'  },
            { label: 'Streak',   value: `${streak}d`,  icon: Flame,          color: 'text-warning' },
            { label: 'Messages', value: totalMsgs,      icon: MessageSquare,  color: 'text-success' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div
              key={label}
              className="bg-bg-base border border-border-subtle rounded-md p-2 text-center"
            >
              <Icon size={12} className={cn('mx-auto mb-0.5', color)} />
              <div className="text-xs font-ui font-semibold text-text-pri">{value}</div>
              <div className="text-[9px] text-text-faint font-ui">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Leaderboard table */}
      <div>
        <p className="text-[11px] text-text-faint font-ui mb-2">Leaderboard</p>
        <div className="space-y-1">
          {leaderboard.map((entry) => {
            const entryLevel = getLevel(entry.xp);
            const entryRank  = getRank(entryLevel);
            const EntryIcon  = entryRank.icon;

            return (
              <div
                key={entry.name}
                className={cn(
                  'flex items-center gap-2.5 px-2.5 py-1.5 rounded-md',
                  entry.isUser
                    ? 'bg-accent/8 border border-accent/20'
                    : 'bg-bg-elevated border border-border-subtle',
                )}
              >
                {/* Position */}
                <span
                  className={cn(
                    'text-xs font-mono font-bold w-5 text-center shrink-0',
                    entry.position === 1 ? 'text-warning' :
                    entry.position === 2 ? 'text-text-sec' :
                    entry.position === 3 ? 'text-orange-400' :
                    'text-text-faint',
                  )}
                >
                  {entry.position}
                </span>

                {/* Rank icon */}
                <div
                  className="w-5 h-5 rounded flex items-center justify-center shrink-0"
                  style={{ background: `${entryRank.color}15` }}
                >
                  <EntryIcon size={10} style={{ color: entryRank.color }} />
                </div>

                {/* Name */}
                <span
                  className={cn(
                    'text-xs font-ui flex-1 min-w-0 truncate',
                    entry.isUser ? 'font-semibold text-accent' : 'text-text-pri',
                  )}
                >
                  {entry.name}
                </span>

                {/* XP */}
                <span className="text-[10px] font-mono text-text-faint shrink-0">
                  {formatXP(entry.xp)} XP
                </span>

                {/* Level badge */}
                <span
                  className="text-[9px] font-ui px-1 py-0.5 rounded shrink-0"
                  style={{ background: `${entryRank.color}15`, color: entryRank.color }}
                >
                  Lv{entryLevel}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Milestones */}
      <div>
        <p className="text-[11px] text-text-faint font-ui mb-2">Milestones</p>
        <div className="space-y-1.5">
          {MILESTONES.map((m) => {
            const unlocked   = xp >= m.xp;
            const milestonePct = unlocked ? 1 : Math.min(xp / m.xp, 1);

            return (
              <div key={m.xp} className="flex items-center gap-2.5 py-1">
                <div
                  className={cn(
                    'w-6 h-6 rounded-md flex items-center justify-center shrink-0',
                    unlocked
                      ? ''
                      : 'bg-bg-elevated border border-border-subtle',
                  )}
                  style={unlocked ? { background: '#6366F115' } : undefined}
                >
                  {unlocked
                    ? <Target size={12} className="text-accent" />
                    : <Lock   size={10} className="text-text-faint" />
                  }
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p
                      className={cn(
                        'text-xs font-ui font-medium',
                        unlocked ? 'text-text-pri' : 'text-text-faint',
                      )}
                    >
                      {m.label}
                    </p>
                    {unlocked && <Check size={12} className="text-success shrink-0" />}
                  </div>
                  <p className="text-[10px] text-text-faint">{m.desc}</p>

                  {/* Progress bar for locked milestones */}
                  {!unlocked && (
                    <div className="mt-1 h-1 bg-bg-base rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent/40 rounded-full transition-all duration-300"
                        style={{ width: `${Math.max(milestonePct * 100, 1)}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
