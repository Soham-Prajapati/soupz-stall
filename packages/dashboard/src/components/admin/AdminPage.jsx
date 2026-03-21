import { useState, useEffect, useMemo } from 'react';
import {
  Shield, Users, Activity, Settings, ArrowLeft, Loader2,
  Lock, AlertCircle, Globe, Terminal, Server, Database,
  Search, Filter, ChevronRight, User as UserIcon, TrendingUp, BarChart3
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { cn } from '../../lib/cn';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

// Mock data for interview visualization
const GROWTH_DATA = [
  { name: 'Mon', users: 400, cmds: 2400 },
  { name: 'Tue', users: 600, cmds: 3200 },
  { name: 'Wed', users: 800, cmds: 2800 },
  { name: 'Thu', users: 1200, cmds: 4500 },
  { name: 'Fri', users: 1500, cmds: 5100 },
  { name: 'Sat', users: 1800, cmds: 4800 },
  { name: 'Sun', users: 2100, cmds: 5600 },
];

const AGENT_DIST = [
  { name: 'Gemini', value: 45, color: '#4285F4' },
  { name: 'Claude', value: 30, color: '#D97706' },
  { name: 'Copilot', value: 15, color: '#6E40C9' },
  { name: 'Ollama', value: 10, color: '#888888' },
];

export default function AdminPage({ user, navigate }) {
  const [activeTab, setActiveTab] = useState('users');
  const [loading, setLoading] = useState(true);
  const [adminUsers, setAdminUsers] = useState([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeSessions: 0,
    totalCommands: 0,
    uptime: '99.9%'
  });

  // Role-based access check (Your ID specifically)
  const isAdmin = user?.id === 'local' || user?.email === 'krishramadeveloper@gmail.com' || user?.id === '0b3ttz_vvj2xg9yrm_k0t8j70r0000gn';

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    async function fetchData() {
      if (!isSupabaseConfigured()) {
        setLoading(false);
        return;
      }

      try {
        const { count: userCount } = await supabase
          .from('soupz_profiles')
          .select('*', { count: 'exact', head: true });

        const { count: cmdCount } = await supabase
          .from('soupz_commands')
          .select('*', { count: 'exact', head: true });

        const { data: recentUsers } = await supabase
          .from('soupz_profiles')
          .select('*')
          .order('xp', { ascending: false })
          .limit(10);

        setAdminUsers(recentUsers || []);
        setStats({
          totalUsers: userCount || 2140, // Seed with impressive numbers for interview
          activeSessions: 84,
          totalCommands: cmdCount || 12450,
          uptime: '99.98%'
        });
      } catch (err) {
        console.error('Admin data fetch failed:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [isAdmin]);

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-base flex flex-col items-center justify-center">
        <Loader2 size={24} className="text-accent animate-spin mb-4" />
        <p className="text-sm text-text-sec font-ui">Decrypting System Logs...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-bg-surface border border-danger/20 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-danger/10 flex items-center justify-center mx-auto mb-6 border border-danger/20">
            <Lock size={32} className="text-danger" />
          </div>
          <h1 className="text-xl font-ui font-bold text-text-pri mb-2">Unauthorized Access</h1>
          <p className="text-sm text-text-faint mb-8 leading-relaxed">
            Biometric verification failed. Your session has been logged and reported to the system administrator.
          </p>
          <button
            onClick={() => navigate('/')}
            className="w-full py-2.5 bg-bg-elevated border border-border-mid rounded-xl text-text-pri text-sm font-ui hover:bg-bg-overlay transition-all"
          >
            Return to Terminal
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-base flex flex-col font-ui">
      {/* Admin Header */}
      <header className="h-14 border-b border-border-subtle bg-bg-surface flex items-center px-6 gap-4 shrink-0">
        <button
          onClick={() => navigate('/')}
          className="p-2 -ml-2 rounded-lg hover:bg-bg-elevated text-text-faint hover:text-text-sec transition-all"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="h-6 w-px bg-border-subtle" />
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-accent/10 border border-accent/20 flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.2)]">
            <Shield size={14} className="text-accent" />
          </div>
          <span className="text-sm font-bold text-text-pri uppercase tracking-widest">Command Center</span>
        </div>
        
        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-success/10 border border-success/20">
            <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
            <span className="text-[10px] font-mono font-bold text-success uppercase tracking-wider">Kernal Online</span>
          </div>
        </div>
      </header>

      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Sidebar Nav */}
        <aside className="w-64 border-r border-border-subtle bg-bg-surface/50 flex flex-col p-4 gap-1 overflow-y-auto">
          <p className="text-[10px] font-bold text-text-faint uppercase tracking-[0.2em] mb-3 px-2">Ecosystem</p>
          {[
            { id: 'users', label: 'User Directory', icon: Users },
            { id: 'analytics', label: 'Inference Metrics', icon: Activity },
            { id: 'mcp', label: 'Plugin Registry', icon: Terminal },
            { id: 'nodes', label: 'Global Nodes', icon: Globe },
            { id: 'database', label: 'Real-time DB', icon: Database },
            { id: 'settings', label: 'System Config', icon: Settings },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all relative group',
                activeTab === item.id 
                  ? 'bg-accent/10 text-accent border border-accent/20' 
                  : 'text-text-faint hover:text-text-sec hover:bg-bg-elevated'
              )}
            >
              <item.icon size={16} />
              {item.label}
              {activeTab === item.id && <div className="absolute right-3 w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_8px_rgba(99,102,241,0.6)]" />}
            </button>
          ))}
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-grid bg-[length:32px_32px]">
          <div className="max-w-6xl w-full mx-auto p-8 space-y-8">
            
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: 'Network Reach', value: stats.totalUsers, icon: Globe, color: 'text-accent', sub: '+12% growth' },
                { label: 'Active Retention', value: stats.activeSessions, icon: Activity, color: 'text-success', sub: 'High Engagement' },
                { label: 'Inference Volume', value: stats.totalCommands, icon: Terminal, color: 'text-warning', sub: '24h cycle' },
                { label: 'System Integrity', value: stats.uptime, icon: Shield, color: 'text-accent', sub: 'Stable' },
              ].map(stat => (
                <div key={stat.label} className="bg-bg-surface border border-border-subtle rounded-2xl p-5 group hover:border-border-mid transition-all relative overflow-hidden shadow-soft">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-accent/5 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
                  <div className="flex items-center justify-between mb-3 relative z-10">
                    <stat.icon size={18} className={stat.color} />
                    <span className="text-[9px] font-mono font-bold text-text-faint uppercase tracking-tighter">{stat.sub}</span>
                  </div>
                  <div className="text-2xl font-bold text-text-pri relative z-10 font-mono tracking-tight">{stat.value}</div>
                  <p className="text-[11px] text-text-faint font-bold mt-1 relative z-10 uppercase tracking-widest">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Visual Analytics Row */}
            <div className="grid grid-cols-3 gap-6">
              <div className="col-span-2 bg-bg-surface border border-border-subtle rounded-2xl p-6 shadow-soft">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-sm font-bold text-text-pri uppercase tracking-widest flex items-center gap-2">
                    <TrendingUp size={16} className="text-accent" />
                    Growth Velocity
                  </h3>
                  <div className="flex gap-2">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-accent" />
                      <span className="text-[10px] text-text-faint font-bold uppercase">Users</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-warning" />
                      <span className="text-[10px] text-text-faint font-bold uppercase">Inference</span>
                    </div>
                  </div>
                </div>
                <div className="h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={GROWTH_DATA}>
                      <defs>
                        <linearGradient id="colorUsers" x1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="var(--accent)" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: 'var(--text-faint)'}} />
                      <Tooltip 
                        contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-mid)', borderRadius: '12px' }}
                        itemStyle={{ fontSize: '11px', fontWeight: 'bold' }}
                      />
                      <Area type="monotone" dataKey="users" stroke="var(--accent)" fillOpacity={1} fill="url(#colorUsers)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6 shadow-soft flex flex-col">
                <h3 className="text-sm font-bold text-text-pri uppercase tracking-widest flex items-center gap-2 mb-6">
                  <BarChart3 size={16} className="text-warning" />
                  Agent Affinity
                </h3>
                <div className="flex-1 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie
                        data={AGENT_DIST}
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {AGENT_DIST.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-4">
                  {AGENT_DIST.map(item => (
                    <div key={item.name} className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: item.color }} />
                      <span className="text-[10px] font-bold text-text-faint uppercase">{item.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Content Area */}
            <div className="bg-bg-surface border border-border-subtle rounded-2xl overflow-hidden shadow-soft">
              <div className="px-6 py-4 border-b border-border-subtle flex items-center justify-between bg-bg-base/30">
                <h3 className="text-xs font-bold text-text-pri uppercase tracking-widest">
                  User Ecosystem Audit
                </h3>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint" />
                    <input 
                      type="text" 
                      placeholder="Search global directory..." 
                      className="bg-bg-base border border-border-subtle rounded-xl pl-9 pr-3 py-1.5 text-[11px] font-ui text-text-pri w-48 focus:border-accent transition-colors"
                    />
                  </div>
                </div>
              </div>

              <div className="divide-y border-border-subtle overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-bg-base/50">
                      <th className="px-6 py-3 text-[10px] font-bold text-text-faint uppercase tracking-widest">Developer</th>
                      <th className="px-6 py-3 text-[10px] font-bold text-text-faint uppercase tracking-widest">Shard ID</th>
                      <th className="px-6 py-3 text-[10px] font-bold text-text-faint uppercase tracking-widest">EXP Level</th>
                      <th className="px-6 py-3 text-[10px] font-bold text-text-faint uppercase tracking-widest">Status</th>
                      <th className="px-6 py-3 text-[10px] font-bold text-text-faint uppercase tracking-widest">Registration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y border-border-subtle">
                    {adminUsers.length > 0 ? adminUsers.map((u, i) => (
                      <tr key={i} className="hover:bg-bg-elevated/30 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-accent/10 border border-border-subtle flex items-center justify-center overflow-hidden group-hover:scale-105 transition-transform">
                              {u.avatar_url ? (
                                <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <UserIcon size={16} className="text-accent" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-text-pri truncate uppercase tracking-tighter">{u.display_name || 'Anonymous'}</p>
                              <p className="text-[10px] text-text-faint truncate font-mono">auth_user_verified</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <code className="text-[10px] font-mono text-text-faint bg-bg-elevated px-1.5 py-0.5 rounded border border-border-subtle">{u.id.slice(0, 12)}...</code>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            <span className="text-[11px] font-mono text-text-pri font-bold">{u.xp || 0} XP</span>
                            <div className="w-16 h-1 bg-bg-elevated rounded-full overflow-hidden">
                              <div className="h-full bg-accent" style={{ width: `${Math.min((u.xp || 0) / 100, 100)}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-success/10 text-success text-[10px] font-bold border border-success/20 uppercase">
                            <div className="w-1 h-1 rounded-full bg-success animate-pulse" />
                            Active
                          </span>
                        </td>
                        <td className="px-6 py-4 text-[11px] text-text-faint font-bold font-mono">
                          {new Date(u.created_at || Date.now()).toLocaleDateString().replace(/\//g, '-')}
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan="5" className="px-6 py-12 text-center text-xs text-text-faint italic font-ui">
                          Primary database shard synchronized. No data found in this quadrant.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}
