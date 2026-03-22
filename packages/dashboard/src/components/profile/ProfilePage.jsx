import { useState, useMemo, useEffect } from 'react';
import { 
  User, Mail, Calendar, MessageSquare, Flame, Bot, Trophy,
  Zap, TrendingUp, Star, Check, Lock, ArrowLeft, Trash2, LogOut,
  Save, AlertTriangle, Search, UserPlus, Loader2, Github,
  Twitter, Globe, MapPin, Link as LinkIcon, Users, Activity
} from 'lucide-react';
import { cn } from '../../lib/cn';
import { CLI_AGENTS } from '../../lib/agents.js';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

const STORAGE_KEY = 'soupz_chat_history';
const USAGE_KEY   = 'soupz_agent_usage';
const STREAK_KEY  = 'soupz_streak';
const PROFILE_KEY = 'soupz_profile';

function readJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; }
}

const ACHIEVEMENTS = [
  { id: 'first_message',    icon: MessageSquare, label: 'First Step',      desc: 'Send your first message',          color: '#6366F1', req: (msgs)              => msgs >= 1   },
  { id: 'streak_3',         icon: Flame,         label: 'On Fire',         desc: 'Use Soupz 3 days in a row',         color: '#F97316', req: (_, __, streak)     => streak >= 3 },
  { id: 'streak_7',         icon: Trophy,        label: 'Weekly Warrior',  desc: '7-day usage streak',                color: '#EAB308', req: (_, __, streak)     => streak >= 7 },
  { id: 'power_user',       icon: Zap,           label: 'Power User',      desc: 'Send 50+ messages',                 color: '#22C55E', req: (msgs)              => msgs >= 50  },
];

export default function ProfilePage({ user, navigate, onSignOut }) {
  const profile = readJSON(PROFILE_KEY, {});
  const githubUsername = user?.user_metadata?.user_name || user?.user_metadata?.preferred_username || user?.email?.split('@')[0] || '';
  
  const [displayName, setDisplayName] = useState(() => profile.displayName || githubUsername);
  const [saved, setSaved] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  
  // Community Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const messages = useMemo(() => readJSON(STORAGE_KEY, []), []);
  const usage = useMemo(() => readJSON(USAGE_KEY, {}), []);
  const streak = useMemo(() => {
    const s = readJSON(STREAK_KEY, { count: 0 });
    return s.count || 0;
  }, []);

  const totalMsgs = messages.filter(m => m.role === 'user').length;
  const agentCount = Object.keys(usage).length;
  const earned = ACHIEVEMENTS.filter(a => a.req(totalMsgs, agentCount, streak));

  // Load follower counts
  useEffect(() => {
    if (!isSupabaseConfigured() || !user?.id) return;
    async function loadFollows() {
      try {
        const { count: f1 } = await supabase.from('soupz_relationships').select('*', { count: 'exact', head: true }).eq('followed_id', user.id);
        const { count: f2 } = await supabase.from('soupz_relationships').select('*', { count: 'exact', head: true }).eq('follower_id', user.id);
        setFollowers(f1 || 0);
        setFollowing(f2 || 0);
      } catch (err) { console.error('Follower fetch error', err); }
    }
    loadFollows();
  }, [user?.id]);

  // Search effect
  useEffect(() => {
    if (!searchQuery.trim() || !isSupabaseConfigured()) {
      setSearchResults([]);
      return;
    }
    const delayDebounce = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const { data } = await supabase
          .from('soupz_profiles')
          .select('id, display_name, avatar_url')
          .ilike('display_name', `%${searchQuery}%`)
          .neq('id', user?.id)
          .limit(5);
        setSearchResults(data || []);
      } catch (err) {
        console.error('Search failed', err);
      } finally {
        setSearchLoading(false);
      }
    }, 400);
    return () => clearTimeout(delayDebounce);
  }, [searchQuery, user?.id]);

  async function handleAddFriend(friendId, friendName) {
    if (!isSupabaseConfigured() || !user?.id) return;
    try {
      await supabase.from('soupz_relationships').upsert({ follower_id: user.id, followed_id: friendId, status: 'friend' });
      alert(`Added ${friendName} as friend!`);
      setFollowing(f => f + 1); // Optimistically update
      setSearchQuery('');
    } catch (err) { console.error(err); }
  }

  function handleSaveProfile() {
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ ...profile, displayName: displayName.trim() }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleClearData() {
    if (!confirmClear) { setConfirmClear(true); return; }
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('soupz_')) keysToRemove.push(key);
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
    window.location.reload();
  }

  return (
    <div className="min-h-screen bg-bg-base text-text-pri font-ui overflow-y-auto pb-20">
      
      {/* ═══ HEADER / HERO ════════════════════════════════════════════ */}
      <div className="bg-bg-surface border-b border-border-subtle pt-12 pb-8 px-6 md:px-10">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-start md:items-center gap-6">
          
          <div className="relative group shrink-0">
            {user?.user_metadata?.avatar_url ? (
              <img src={user.user_metadata.avatar_url} alt="" className="w-24 h-24 md:w-28 md:h-28 rounded-full border-4 border-bg-base shadow-lg" />
            ) : (
              <div className="w-24 h-24 md:w-28 md:h-28 rounded-full border-4 border-bg-base shadow-lg bg-bg-elevated flex items-center justify-center">
                <User size={40} className="text-text-faint" />
              </div>
            )}
            <div className="absolute inset-0 rounded-full border border-border-mid pointer-events-none" />
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-text-pri mb-1 truncate">{displayName}</h1>
            <div className="flex flex-wrap items-center gap-3 text-sm text-text-sec mb-4">
              <span className="font-mono bg-bg-elevated px-2 py-0.5 rounded text-accent/90 border border-border-subtle">@{githubUsername}</span>
              <span className="flex items-center gap-1.5"><MapPin size={14} className="text-text-faint"/> Remote Node</span>
              {user?.email && <span className="flex items-center gap-1.5"><Mail size={14} className="text-text-faint"/> {user.email}</span>}
            </div>
            
            <div className="flex items-center gap-4 text-xs font-medium">
              <div className="flex items-center gap-1.5 bg-bg-elevated/50 px-3 py-1.5 rounded-full border border-border-subtle text-text-sec hover:text-text-pri transition-colors cursor-pointer">
                <Users size={14} className="text-text-faint" />
                <span className="text-text-pri">{followers}</span> Followers
              </div>
              <div className="flex items-center gap-1.5 bg-bg-elevated/50 px-3 py-1.5 rounded-full border border-border-subtle text-text-sec hover:text-text-pri transition-colors cursor-pointer">
                <UserPlus size={14} className="text-text-faint" />
                <span className="text-text-pri">{following}</span> Following
              </div>
              <a href={`https://github.com/${githubUsername}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 bg-bg-elevated hover:bg-bg-overlay px-3 py-1.5 rounded-full border border-border-subtle text-text-sec hover:text-text-pri transition-colors ml-auto md:ml-0">
                <Github size={14} /> GitHub
              </a>
            </div>
          </div>

          <div className="w-full md:w-auto mt-4 md:mt-0 flex gap-3">
            <button
              onClick={() => navigate('/')}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-bg-elevated border border-border-mid hover:border-accent/40 text-sm font-medium transition-all"
            >
              Edit Profile
            </button>
            {onSignOut && (
              <button 
                onClick={async () => { await onSignOut(); navigate('/'); }}
                className="flex items-center justify-center p-2.5 rounded-xl bg-danger/10 text-danger border border-danger/20 hover:bg-danger/20 transition-all cursor-pointer"
                title="Sign out"
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ═══ MAIN CONTENT ══════════════════════════════════════════════ */}
      <div className="max-w-5xl mx-auto px-6 md:px-10 mt-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left / Main Column */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Achievements Strip */}
            <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6">
              <h2 className="text-sm font-semibold mb-4 text-text-sec flex items-center gap-2">
                <Trophy size={16} className="text-accent"/> Achievements
              </h2>
              <div className="flex flex-wrap gap-4">
                {earned.map(a => (
                  <div key={a.id} className="group relative flex items-center gap-3 bg-bg-elevated border border-border-subtle px-4 py-3 rounded-xl hover:border-border-mid transition-all">
                    <div className="w-10 h-10 rounded-lg bg-bg-base flex items-center justify-center border border-border-subtle group-hover:scale-110 transition-transform" style={{ color: a.color }}>
                      <a.icon size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-text-pri">{a.label}</p>
                      <p className="text-[11px] text-text-faint">{a.desc}</p>
                    </div>
                  </div>
                ))}
                {earned.length === 0 && (
                  <div className="w-full text-center py-6 text-sm text-text-faint border-2 border-dashed border-border-subtle rounded-xl">
                    <Star size={24} className="mx-auto mb-2 opacity-20" />
                    Complete tasks to unlock achievements
                  </div>
                )}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6">
              <h2 className="text-sm font-semibold mb-4 text-text-sec flex items-center gap-2">
                <TrendingUp size={16} className="text-accent"/> Recent Activity
              </h2>
              <div className="py-12 flex flex-col items-center justify-center text-center border-2 border-dashed border-border-subtle rounded-xl bg-bg-base/30">
                <Activity size={32} className="text-text-faint/30 mb-3" />
                <p className="text-sm font-medium text-text-sec">No recent activity detected.</p>
                <p className="text-xs text-text-faint max-w-sm mt-1">Activities from your local nodes and agents will appear here once connected.</p>
              </div>
            </div>

            {/* Find Devs / Community */}
            <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6">
              <h2 className="text-sm font-semibold mb-4 text-text-sec flex items-center gap-2">
                <Globe size={16} className="text-accent"/> Find Developers
              </h2>
              <div className="relative mb-5">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-faint" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search network by username..."
                  className="w-full bg-bg-elevated border border-border-mid rounded-xl pl-10 pr-4 py-3 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all placeholder:text-text-faint"
                />
                {searchLoading && <Loader2 size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-accent animate-spin" />}
              </div>

              {searchResults.length > 0 && (
                <div className="grid gap-2">
                  {searchResults.map(res => (
                    <div key={res.id} className="flex items-center justify-between p-3 rounded-lg border border-border-subtle bg-bg-elevated hover:bg-bg-overlay tracking-tight transition-colors">
                      <div className="flex items-center gap-3">
                        {res.avatar_url ? (
                          <img src={res.avatar_url} alt="" className="w-10 h-10 rounded-full border border-border-subtle" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-bg-base border border-border-subtle flex items-center justify-center">
                            <User size={16} className="text-text-faint" />
                          </div>
                        )}
                        <span className="text-sm font-semibold text-text-pri">{res.display_name}</span>
                      </div>
                      <button
                        onClick={() => handleAddFriend(res.id, res.display_name)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/10 text-accent font-medium hover:bg-accent hover:text-white transition-colors text-xs"
                      >
                        <UserPlus size={14} />
                        Add Friend
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            
            {/* Quick Stats Card */}
            <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6">
              <h3 className="text-sm font-semibold mb-5 text-text-pri">Stats Overview</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-xl bg-bg-elevated border border-border-subtle">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-text-pri/5 rounded-lg text-text-sec"><MessageSquare size={16} /></div>
                    <span className="text-sm text-text-sec">Local Prompts</span>
                  </div>
                  <span className="text-base font-mono font-semibold text-text-pri">{totalMsgs}</span>
                </div>
                
                <div className="flex items-center justify-between p-3 rounded-xl bg-bg-elevated border border-border-subtle">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-warning/10 rounded-lg text-warning"><Flame size={16} /></div>
                    <span className="text-sm text-text-sec">Active Streak</span>
                  </div>
                  <span className="text-base font-mono font-semibold text-warning">{streak}</span>
                </div>
                
                <div className="flex items-center justify-between p-3 rounded-xl bg-bg-elevated border border-border-subtle">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-success/10 rounded-lg text-success"><Bot size={16} /></div>
                    <span className="text-sm text-text-sec">Active Agents</span>
                  </div>
                  <span className="text-base font-mono font-semibold text-success">{agentCount}</span>
                </div>
              </div>
            </div>

            {/* Danger Zone */}
            <div className="bg-bg-surface border border-danger/20 rounded-2xl p-6">
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2 text-danger">
                <AlertTriangle size={16} /> Danger Zone
              </h3>
              <p className="text-xs text-text-sec mb-5">
                Permanently delete your local shards. This action cannot be undone and clears all analytics and chat history.
              </p>
              <button 
                onClick={handleClearData} 
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-danger/10 border border-danger/30 text-danger text-sm font-bold rounded-xl hover:bg-danger hover:text-white transition-all"
              >
                <Trash2 size={16} />
                {confirmClear ? 'Click again to confirm' : 'Reset Local Data'}
              </button>
            </div>

          </div>
        </div>
      </div>

    </div>
  );
}
