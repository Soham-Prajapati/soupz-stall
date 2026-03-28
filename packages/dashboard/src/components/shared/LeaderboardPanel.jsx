import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Crown, Shield, Sword, Hammer, Sparkles,
  Flame, MessageSquare, Target, Lock, Check,
  ChevronRight, Award, Loader2, Zap,
} from 'lucide-react';
import { cn } from '../../lib/cn';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

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

// No mock data — only real user stats are shown

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

function getThisWeekMessages(messages) {
  const now = Date.now();
  const weekAgo = now - (7 * 24 * 60 * 60 * 1000);
  return messages.filter(m => m.role === 'user' && m.id > weekAgo).length;
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
  const [lbFilter, setLbFilter] = useState('global'); // global | friends | college
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [notification, setNotification] = useState(null);
  const [prevLevel, setPrevLevel] = useState(null);
  const [prevAchieveCount, setPrevAchieveCount] = useState(null);
  const [xpGainNotif, setXpGainNotif] = useState(null);

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
  const thisWeekMsgs   = getThisWeekMessages(messages);

  useEffect(() => {
    async function fetchData() {
      if (!isSupabaseConfigured()) {
        setLoading(false);
        return;
      }
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setCurrentUser(session?.user);

        const { data, error } = await supabase
          .from('soupz_profiles')
          .select('*')
          .order('xp', { ascending: false })
          .limit(20);

        if (error) throw error;
        setProfiles(data || []);
      } catch (err) {
        console.error('Leaderboard error:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Sync XP to Supabase every 60 seconds
  useEffect(() => {
    if (!isSupabaseConfigured() || !currentUser) return;

    async function syncXP() {
      try {
        const { error } = await supabase
          .from('soupz_profiles')
          .upsert({
            id: currentUser.id,
            xp: xp,
            level: level,
            streak: streak,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'id' });
        if (error) console.error('XP sync error:', error);
      } catch (err) {
        console.error('Failed to sync XP:', err);
      }
    }

    const interval = setInterval(syncXP, 60000);
    return () => clearInterval(interval);
  }, [xp, level, streak, currentUser]);

  // Sync XP on window blur (user switching to another tab)
  useEffect(() => {
    if (!isSupabaseConfigured() || !currentUser) return;

    async function syncXPOnBlur() {
      try {
        await supabase
          .from('soupz_profiles')
          .upsert({
            id: currentUser.id,
            xp: xp,
            level: level,
            streak: streak,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'id' });
      } catch (err) {
        console.error('Failed to sync XP on blur:', err);
      }
    }

    window.addEventListener('blur', syncXPOnBlur);
    return () => window.removeEventListener('blur', syncXPOnBlur);
  }, [xp, level, streak, currentUser]);

  // Detect achievement unlocks and level-ups
  useEffect(() => {
    if (prevAchieveCount !== null && achieveCount > prevAchieveCount) {
      const newAchieve = ACHIEVEMENT_IDS[achieveCount - 1];
      setNotification({
        type: 'achievement',
        count: achieveCount,
        message: 'Achievement Unlocked!'
      });
      setTimeout(() => setNotification(null), 3000);
    }
    setPrevAchieveCount(achieveCount);
  }, [achieveCount]);

  useEffect(() => {
    if (prevLevel !== null && level > prevLevel) {
      setNotification({
        type: 'levelup',
        level: level,
        rank: rank
      });
      setTimeout(() => setNotification(null), 3500);
    }
    setPrevLevel(level);
  }, [level, rank]);

  // Community data logic
  const leaderboard = useMemo(() => {
    if (loading && profiles.length === 0) {
      return [{ name: 'You', xp, isUser: true, position: 1 }];
    }

    let list = profiles.map(p => ({
      name: p.display_name,
      xp: p.xp,
      isUser: p.id === currentUser?.id,
      avatar: p.avatar_url,
    }));

    // Ensure current user is present with their latest local XP if they are logged in
    const userInList = list.find(p => p.isUser);
    if (currentUser && !userInList) {
      list.push({
        name: currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || currentUser.email,
        xp: xp,
        isUser: true,
        avatar: currentUser.user_metadata?.avatar_url
      });
    } else if (userInList) {
      // Use the higher of local vs DB (in case DB is slightly behind)
      userInList.xp = Math.max(userInList.xp, xp);
    }

    const sorted = list.sort((a,b) => b.xp - a.xp).map((u, i) => ({...u, position: i+1}));
    
    if (lbFilter === 'friends') return sorted.slice(0, 3);
    if (lbFilter === 'college') return sorted.slice(0, 5);
    return sorted;
  }, [profiles, xp, currentUser, lbFilter, loading]);

  const RankIcon = rank.icon;

  return (
    <div className="space-y-4 pb-6">
      {/* Your Stats card */}
      <motion.div className="bg-bg-elevated border border-border-subtle rounded-lg p-3">
        <div className="flex items-center gap-3 mb-3">
          <motion.div
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: `${rank.color}18` }}
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 0.6, repeat: notification?.type === 'levelup' ? 2 : 0 }}
          >
            <RankIcon size={18} style={{ color: rank.color }} />
          </motion.div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <motion.span
                className="text-sm font-ui font-semibold text-text-pri"
                key={level}
                animate={{ opacity: 1, scale: 1 }}
                initial={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.3 }}
              >
                Level {level}
              </motion.span>
              <span
                className="text-[10px] font-ui font-medium px-1.5 py-0.5 rounded"
                style={{ background: `${rank.color}18`, color: rank.color }}
              >
                {rank.label}
              </span>
            </div>
            <motion.p
              className="text-[11px] text-text-faint font-ui"
              key={xp}
              animate={{ opacity: 1 }}
              initial={{ opacity: 0.5 }}
              transition={{ duration: 0.4 }}
            >
              {formatXP(xp)} XP total
            </motion.p>
          </div>
        </div>

        {/* Progress bar to next level */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-text-faint font-ui">Level {level}</span>
            <span className="text-[10px] text-text-faint font-ui">Level {level + 1}</span>
          </div>
          <div className="h-1.5 bg-bg-base rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{
                background: rank.color,
              }}
              animate={{ width: `${Math.max(pct * 100, 2)}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
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
      </motion.div>

      {/* Filter Tabs */}
      <div className="flex bg-bg-base p-0.5 rounded-lg border border-border-subtle shrink-0">
        {['global', 'friends', 'college'].map(f => (
          <button
            key={f}
            onClick={() => setLbFilter(f)}
            className={cn(
              'flex-1 py-1 text-[10px] font-ui font-bold uppercase tracking-wider transition-all rounded-md',
              lbFilter === f ? 'bg-bg-elevated text-accent shadow-sm border border-border-subtle' : 'text-text-faint hover:text-text-sec'
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Leaderboard table */}
      <div>
        <p className="text-[11px] text-text-faint font-ui mb-2 uppercase tracking-widest font-bold">Leaderboard</p>
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

      {/* Achievement Notification Toast */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50"
          >
            {notification.type === 'achievement' && (
              <div className="bg-gradient-to-r from-accent to-accent/80 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2">
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 0.5, repeat: 1 }}
                >
                  <Award size={18} />
                </motion.div>
                <div>
                  <p className="font-semibold text-sm">{notification.message}</p>
                  <p className="text-xs opacity-90">{notification.count}/{ACHIEVEMENT_IDS.length} achievements</p>
                </div>
              </div>
            )}
            {notification.type === 'levelup' && (
              <div className="bg-gradient-to-r from-warning to-warning/80 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2">
                <motion.div
                  animate={{ scale: [1, 1.3, 1], rotate: [0, 360, 360] }}
                  transition={{ duration: 0.6, repeat: 1 }}
                >
                  <Zap size={18} />
                </motion.div>
                <div>
                  <p className="font-semibold text-sm">Level Up!</p>
                  <p className="text-xs opacity-90">Reached {notification.rank.label} Level {notification.level}</p>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Weekly Challenges */}
      <div className="bg-accent/5 border border-accent/20 rounded-xl p-3">
        <div className="flex items-center gap-2 mb-2">
          <Award size={14} className="text-accent" />
          <span className="text-xs font-ui font-bold text-text-pri uppercase tracking-tight">Weekly Challenges</span>
        </div>
        <div className="space-y-2">
          {[
            { label: 'Weekly Warrior', desc: 'Send 10 prompts this week', progress: thisWeekMsgs, target: 10, reward: '100 XP' },
            { label: 'Multi-Agent', desc: 'Use 5 different agents', progress: agentCount, target: 5, reward: '500 XP' },
          ].map(c => (
            <motion.div
              key={c.label}
              className="bg-bg-surface/50 border border-border-subtle rounded-lg p-2.5"
              animate={{ borderColor: c.progress >= c.target ? 'var(--success)' : 'var(--border-subtle)' }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[11px] font-ui font-semibold text-text-pri">{c.label}</p>
                <span className="text-[9px] font-mono font-bold text-accent bg-accent/10 px-1.5 py-0.5 rounded border border-accent/20">+{c.reward}</span>
              </div>
              <motion.div className="h-1 bg-bg-base rounded-full overflow-hidden mb-1">
                <motion.div
                  className="h-full bg-accent rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min((c.progress/c.target)*100, 100)}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                />
              </motion.div>
              <p className="text-[9px] text-text-faint">{c.desc} ({c.progress}/{c.target})</p>
            </motion.div>
          ))}
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
