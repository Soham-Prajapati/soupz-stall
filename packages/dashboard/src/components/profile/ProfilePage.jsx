import { useState, useMemo, useEffect } from 'react';
import { 
  User, Mail, Calendar, MessageSquare, Flame, Bot, Trophy,
  Zap, TrendingUp, Star, Check, Lock, ArrowLeft, Trash2, LogOut,
  Save, AlertTriangle, Search, UserPlus, Loader2, Github,
  Twitter, Globe, MapPin, Link as LinkIcon, Users, Activity, Terminal
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
  const [remoteProfile, setRemoteProfile] = useState(null);
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
  const localStreak = useMemo(() => {
    const s = readJSON(STREAK_KEY, { count: 0 });
    return s.count || 0;
  }, []);

  const localTotalMsgs = messages.filter(m => m.role === 'user').length;
  const localAgentCount = Object.keys(usage).length;
  const totalMsgs = Math.max(localTotalMsgs, Number(remoteProfile?.message_count || 0));
  const agentCount = Math.max(localAgentCount, Number(remoteProfile?.agent_count || 0));
  const streak = Math.max(localStreak, Number(remoteProfile?.streak || 0));
  const earned = ACHIEVEMENTS.filter(a => a.req(totalMsgs, agentCount, streak));

  useEffect(() => {
    if (!isSupabaseConfigured() || !user?.id) return;
    let cancelled = false;
    async function loadProfile() {
      try {
        const { data, error } = await supabase
          .from('soupz_profiles')
          .select('display_name, avatar_url, xp, level, streak, message_count, agent_count')
          .eq('id', user.id)
          .single();
        if (error || !data || cancelled) return;
        setRemoteProfile(data);
        const remoteName = String(data.display_name || '').trim();
        if (!profile.displayName && remoteName) setDisplayName(remoteName);
      } catch (err) {
        console.error('Profile fetch error', err);
      }
    }
    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

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

  async function handleSaveProfile() {
    const trimmed = displayName.trim();
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ ...profile, displayName: trimmed }));

    if (isSupabaseConfigured() && user?.id) {
      try {
        await supabase
          .from('soupz_profiles')
          .upsert({
            id: user.id,
            display_name: trimmed || githubUsername,
            avatar_url: user?.user_metadata?.avatar_url || null,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'id' });
      } catch (err) {
        console.error('Profile save error', err);
      }
    }

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
    <div className="min-h-[100dvh] min-h-screen bg-bg-base text-text-pri font-ui overflow-y-auto pb-20 bg-grid bg-[length:32px_32px]">
      
      {/* ═══ TOP COMMAND BAR (replaces big white profile header) ═══ */}
      <div className="sticky top-0 z-50 bg-bg-surface/80 backdrop-blur-md border-b border-border-subtle px-6 md:px-10 h-[calc(64px+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] flex items-center justify-between shadow-soft">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/dashboard')} className="p-2 -ml-2 rounded-lg hover:bg-bg-elevated text-text-faint hover:text-accent transition-all">
            <ArrowLeft size={16} />
          </button>
          <div className="h-6 w-px bg-border-mid" />
          <div className="flex items-center gap-3">
             {/* avatar */}
             {user?.user_metadata?.avatar_url ? (
               <img src={user.user_metadata.avatar_url} alt="" className="w-8 h-8 rounded border border-border-subtle" />
             ) : (
               <div className="w-8 h-8 rounded bg-accent/20 border border-accent/40 flex items-center justify-center">
                 <User size={14} className="text-accent" />
               </div>
             )}
             <div>
               <p className="text-xs font-bold text-text-pri uppercase tracking-widest">{displayName}</p>
               <p className="text-[10px] text-text-faint font-mono">SYS.PILOT.ID_{user?.id?.slice(0,6) || 'LOCAL'}</p>
             </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {onSignOut && (
            <button 
              onClick={async () => { await onSignOut(); navigate('/dashboard'); }}
              className="flex items-center gap-2 px-3 py-1.5 rounded bg-danger/10 border border-danger/20 text-danger text-[10px] font-bold uppercase tracking-widest hover:bg-danger hover:text-white transition-all cursor-pointer"
            >
              <LogOut size={12} /> <span className="hidden sm:block">Disconnect</span>
            </button>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 md:px-10 mt-8 space-y-6">
        
        {/* ROW 1: CORE TELEMETRY */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-bg-surface border border-border-subtle p-5 rounded-xl shadow-soft relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-16 h-16 bg-accent/5 rounded-full -mr-4 -mt-4 transition-transform group-hover:scale-110" />
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-text-faint font-bold uppercase tracking-widest">Compute Credits</span>
              <Terminal size={14} className="text-accent" />
            </div>
            <p className="text-2xl font-mono font-bold text-text-pri">{totalMsgs}</p>
          </div>
          <div className="bg-bg-surface border border-border-subtle p-5 rounded-xl shadow-soft relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-16 h-16 bg-warning/5 rounded-full -mr-4 -mt-4 transition-transform group-hover:scale-110" />
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-text-faint font-bold uppercase tracking-widest">Active Sequence</span>
              <Flame size={14} className="text-warning" />
            </div>
            <p className="text-2xl font-mono font-bold text-warning">{streak}</p>
          </div>
          <div className="bg-bg-surface border border-border-subtle p-5 rounded-xl shadow-soft relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-16 h-16 bg-success/5 rounded-full -mr-4 -mt-4 transition-transform group-hover:scale-110" />
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-text-faint font-bold uppercase tracking-widest">Agent Swarm</span>
              <Bot size={14} className="text-success" />
            </div>
            <p className="text-2xl font-mono font-bold text-success">{agentCount}</p>
          </div>
          <div className="bg-bg-surface border border-border-subtle p-5 rounded-xl shadow-soft relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-16 h-16 bg-text-pri/5 rounded-full -mr-4 -mt-4 transition-transform group-hover:scale-110" />
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-text-faint font-bold uppercase tracking-widest">Neural Links</span>
              <Users size={14} className="text-text-sec" />
            </div>
            <p className="text-2xl font-mono font-bold text-text-pri">{followers + following}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* COLUMN 1: IDENTIFICATION & DESTRUCT */}
          <div className="space-y-6">
            <div className="bg-bg-surface border border-accent/20 p-6 rounded-xl relative overflow-hidden">
               <div className="absolute top-0 left-0 w-1 h-full bg-accent" />
               <h3 className="text-xs font-bold text-accent uppercase tracking-[0.2em] mb-4">Pilot Identification</h3>
               
               <div className="space-y-4">
                 <div>
                   <p className="text-[10px] text-text-faint uppercase font-bold mb-1">GitHub Endpoint</p>
                   <a href={`https://github.com/${githubUsername}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-text-sec hover:text-accent font-mono transition-colors">
                     <Github size={14} /> @{githubUsername}
                   </a>
                 </div>
                 <div>
                   <p className="text-[10px] text-text-faint uppercase font-bold mb-1">Assigned Node</p>
                   <p className="flex items-center gap-2 text-sm text-text-sec font-mono">
                     <Globe size={14} className="text-success" /> Global Edge
                   </p>
                 </div>
                 {user?.email && (
                   <div>
                     <p className="text-[10px] text-text-faint uppercase font-bold mb-1">Secure Comms</p>
                     <p className="flex items-center gap-2 text-sm text-text-sec font-mono">
                       <Mail size={14} /> {user.email}
                     </p>
                   </div>
                 )}
               </div>
            </div>

            <div className="bg-bg-surface border border-warning/20 p-6 rounded-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-warning" />
              <h3 className="text-xs font-bold text-warning uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                 <Search size={14} /> Establish Links
              </h3>
              <div className="relative mb-4">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Scan network..."
                  className="w-full bg-bg-elevated border border-border-mid rounded text-xs pl-3 pr-8 py-2 font-mono text-text-pri focus:border-warning outline-none transition-colors placeholder:text-text-faint"
                />
                {searchLoading && <Loader2 size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-warning animate-spin" />}
              </div>
              <div className="space-y-2">
                {searchResults.map(res => (
                  <div key={res.id} className="flex items-center justify-between bg-bg-elevated border border-border-subtle p-2 rounded hover:border-warning/50 transition-colors">
                    <span className="text-[11px] font-mono font-bold text-text-pri truncate">{res.display_name}</span>
                    <button
                      onClick={() => handleAddFriend(res.id, res.display_name)}
                      className="text-[10px] bg-warning/10 text-warning px-2 py-1 rounded border border-warning/20 hover:bg-warning hover:text-white transition-colors uppercase font-bold tracking-wider cursor-pointer"
                    >
                      Connect
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-bg-surface border border-danger/20 p-6 rounded-xl relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1 h-full bg-danger/50 group-hover:bg-danger transition-colors" />
              <h3 className="text-xs font-bold text-danger uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
                <AlertTriangle size={14} /> System Purge
              </h3>
              <p className="text-[10px] text-text-sec font-mono mb-4">Erases all localized telemetry shards. Irreversible.</p>
              <button 
                onClick={handleClearData} 
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-danger/10 border border-danger/30 text-danger text-[10px] font-bold uppercase tracking-widest rounded hover:bg-danger hover:text-white transition-all cursor-pointer"
              >
                <Trash2 size={12} />
                {confirmClear ? 'Confirm Purge' : 'Initiate Purge'}
              </button>
            </div>
          </div>

          {/* COLUMN 2 & 3: ACHIEVEMENTS & ACTIVITY */}
          <div className="lg:col-span-2 space-y-6">
            
            <div className="bg-bg-surface border border-border-subtle p-6 rounded-xl relative">
              <div className="flex items-center justify-between mb-6 relative z-10">
                <h3 className="text-xs font-bold text-text-pri uppercase tracking-[0.2em] flex items-center gap-2">
                  <Trophy size={14} className="text-accent"/> Unlocked Protocols
                </h3>
                <span className="text-[10px] text-text-faint font-mono font-bold bg-bg-elevated border border-border-subtle px-2 py-1 rounded">{earned.length} / {ACHIEVEMENTS.length} Online</span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative z-10">
                {earned.map(a => (
                  <div key={a.id} className="group relative flex items-start gap-3 bg-bg-elevated border border-border-mid px-4 py-4 rounded-xl hover:border-accent/50 transition-colors">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-xl pointer-events-none" />
                    <div className="w-8 h-8 rounded shrink-0 flex items-center justify-center bg-bg-surface border shadow-sm" style={{ borderColor: a.color, color: a.color, boxShadow: `0 0 10px ${a.color}20` }}>
                      <a.icon size={16} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-text-pri uppercase tracking-wider mb-1">{a.label}</p>
                      <p className="text-[10px] text-text-faint font-mono">{a.desc}</p>
                    </div>
                  </div>
                ))}
                {earned.length === 0 && (
                   <div className="col-span-1 sm:col-span-2 py-8 text-center border border-dashed border-border-mid rounded-xl bg-bg-elevated/30">
                     <Lock size={20} className="mx-auto mb-2 text-text-faint/50" />
                     <p className="text-[10px] text-text-faint uppercase tracking-widest font-bold">All protocols locked</p>
                   </div>
                )}
              </div>
            </div>

            <div className="bg-bg-surface border border-border-subtle p-6 rounded-xl min-h-[220px] flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xs font-bold text-text-pri uppercase tracking-[0.2em] flex items-center gap-2">
                  <Activity size={14} className="text-accent"/> Synaptic Output
                </h3>
              </div>
              <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-border-mid rounded-xl bg-bg-base/30 relative overflow-hidden">
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:15px_15px] pointer-events-none rounded-xl" />
                <div className="text-center relative z-10">
                   <p className="text-[10px] text-text-faint uppercase font-bold tracking-widest mb-3">Awaiting Telemetry</p>
                   <div className="flex items-center justify-center gap-1.5 h-10">
                     <div className="w-1.5 h-4 bg-accent/40 rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
                     <div className="w-1.5 h-8 bg-accent/60 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                     <div className="w-1.5 h-10 bg-accent rounded-full animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.5)]" style={{ animationDelay: '300ms' }} />
                     <div className="w-1.5 h-5 bg-accent/60 rounded-full animate-pulse" style={{ animationDelay: '450ms' }} />
                     <div className="w-1.5 h-3 bg-accent/40 rounded-full animate-pulse" style={{ animationDelay: '600ms' }} />
                   </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
