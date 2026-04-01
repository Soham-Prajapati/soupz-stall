import { useState, useEffect } from 'react';
import {
  Shield, Users, Activity, ArrowLeft, Loader2,
  Lock, Globe, Terminal, Database,
  Search, User as UserIcon
} from 'lucide-react';
import { cn } from '../../lib/cn';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

export default function AdminPage({ user, navigate }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [adminUsers, setAdminUsers] = useState([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalOrders: 0,
    totalCommands: 0,
    ordersToday: 0,
    agentBreakdown: [],
  });

  const isAdmin = user?.id === 'local'
    || user?.user_metadata?.user_name === 'Soham-Prajapati'
    || user?.user_metadata?.preferred_username === 'Soham-Prajapati'
    || user?.user_metadata?.user_name === 'shubhxms'
    || user?.user_metadata?.preferred_username === 'shubhxms';

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return; }

    async function fetchData() {
      if (!isSupabaseConfigured()) { setLoading(false); return; }

      try {
        // Real counts
        const [usersRes, cmdsRes, ordersRes] = await Promise.all([
          supabase.from('soupz_profiles').select('*', { count: 'exact', head: true }),
          supabase.from('soupz_commands').select('*', { count: 'exact', head: true }),
          supabase.from('soupz_orders').select('*', { count: 'exact', head: true }),
        ]);

        // Orders created today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const { count: ordersToday } = await supabase
          .from('soupz_orders')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', today.toISOString());

        // Agent usage breakdown from orders
        const { data: agentData } = await supabase
          .from('soupz_orders')
          .select('run_agent')
          .not('run_agent', 'is', null)
          .limit(500);

        const agentCounts = {};
        const AGENT_COLORS = {
          gemini: '#4285F4',
          codex: '#10B981',
          copilot: '#6E40C9',
          ollama: '#888888',
          'claude-code': '#D97706',
          kiro: '#F59E0B',
        };
        (agentData || []).forEach(row => {
          const agent = row.run_agent || 'unknown';
          agentCounts[agent] = (agentCounts[agent] || 0) + 1;
        });
        const agentBreakdown = Object.entries(agentCounts)
          .map(([name, count]) => ({ name, count, color: AGENT_COLORS[name] || '#666' }))
          .sort((a, b) => b.count - a.count);

        // Top users
        const { data: recentUsers } = await supabase
          .from('soupz_profiles')
          .select('*')
          .order('xp', { ascending: false })
          .limit(20);

        setAdminUsers(recentUsers || []);
        setStats({
          totalUsers: usersRes.count || 0,
          totalOrders: ordersRes.count || 0,
          totalCommands: cmdsRes.count || 0,
          ordersToday: ordersToday || 0,
          agentBreakdown,
        });
      } catch (err) {
        console.error('Admin fetch failed:', err);
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
        <p className="text-sm text-text-sec font-ui">Loading admin data...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-bg-surface border border-danger/20 rounded-xl p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-danger/10 flex items-center justify-center mx-auto mb-6 border border-danger/20">
            <Lock size={32} className="text-danger" />
          </div>
          <h1 className="text-xl font-ui font-bold text-text-pri mb-2">Unauthorized</h1>
          <p className="text-sm text-text-faint mb-8">You do not have admin access.</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full py-2.5 bg-bg-elevated border border-border-subtle rounded-md text-text-pri text-sm font-ui hover:bg-bg-overlay transition-all"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-base flex flex-col font-ui">
      {/* Header */}
      <header className="h-12 border-b border-border-subtle bg-bg-surface flex items-center px-6 gap-4 shrink-0">
        <button onClick={() => navigate('/dashboard')} className="p-1.5 rounded hover:bg-bg-elevated text-text-faint hover:text-text-sec transition-all">
          <ArrowLeft size={16} />
        </button>
        <div className="h-5 w-px bg-border-subtle" />
        <div className="flex items-center gap-2">
          <Shield size={14} className="text-accent" />
          <span className="text-sm font-bold text-text-pri uppercase tracking-widest">Admin</span>
        </div>
        <div className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success/10 border border-success/20">
          <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
          <span className="text-[10px] font-mono font-bold text-success uppercase">Live</span>
        </div>
      </header>

      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-56 border-r border-border-subtle bg-bg-surface/50 flex flex-col p-3 gap-1 overflow-y-auto">
          {[
            { id: 'overview', label: 'Overview', icon: Activity },
            { id: 'users', label: 'Users', icon: Users },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-all',
                activeTab === item.id
                  ? 'bg-accent/10 text-accent border border-accent/20'
                  : 'text-text-faint hover:text-text-sec hover:bg-bg-elevated'
              )}
            >
              <item.icon size={14} />
              {item.label}
            </button>
          ))}
        </aside>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-5xl mx-auto space-y-6">

            {/* Stat Cards (always visible) */}
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'text-accent' },
                { label: 'Total Orders', value: stats.totalOrders, icon: Terminal, color: 'text-warning' },
                { label: 'Orders Today', value: stats.ordersToday, icon: Activity, color: 'text-success' },
                { label: 'Total Commands', value: stats.totalCommands, icon: Database, color: 'text-purple-400' },
              ].map(stat => (
                <div key={stat.label} className="bg-bg-surface border border-border-subtle rounded-lg p-5">
                  <div className="flex items-center justify-between mb-3">
                    <stat.icon size={16} className={stat.color} />
                  </div>
                  <div className="text-2xl font-bold text-text-pri font-mono">{stat.value.toLocaleString()}</div>
                  <p className="text-[11px] text-text-faint mt-1 uppercase tracking-wider">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <>
                {/* Agent Usage */}
                <div className="bg-bg-surface border border-border-subtle rounded-lg p-6">
                  <h3 className="text-xs font-bold text-text-pri uppercase tracking-widest mb-4">Agent Usage (from orders)</h3>
                  {stats.agentBreakdown.length > 0 ? (
                    <div className="space-y-3">
                      {stats.agentBreakdown.map(agent => {
                        const maxCount = stats.agentBreakdown[0]?.count || 1;
                        const pct = Math.round((agent.count / maxCount) * 100);
                        return (
                          <div key={agent.name} className="flex items-center gap-3">
                            <span className="text-xs font-mono text-text-sec w-28 truncate">{agent.name}</span>
                            <div className="flex-1 h-5 bg-bg-elevated rounded overflow-hidden">
                              <div className="h-full rounded transition-all" style={{ width: `${pct}%`, backgroundColor: agent.color }} />
                            </div>
                            <span className="text-xs font-mono text-text-faint w-12 text-right">{agent.count}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-text-faint text-xs">No order data yet.</p>
                  )}
                </div>
              </>
            )}

            {/* Users Tab */}
            {activeTab === 'users' && (
              <div className="bg-bg-surface border border-border-subtle rounded-lg overflow-hidden">
                <div className="px-5 py-3 border-b border-border-subtle flex items-center justify-between">
                  <h3 className="text-xs font-bold text-text-pri uppercase tracking-widest">User Directory</h3>
                  <span className="text-[10px] text-text-faint font-mono">{adminUsers.length} users</span>
                </div>
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-bg-base/50">
                      <th className="px-5 py-2.5 text-[10px] font-bold text-text-faint uppercase tracking-widest">User</th>
                      <th className="px-5 py-2.5 text-[10px] font-bold text-text-faint uppercase tracking-widest">ID</th>
                      <th className="px-5 py-2.5 text-[10px] font-bold text-text-faint uppercase tracking-widest">XP</th>
                      <th className="px-5 py-2.5 text-[10px] font-bold text-text-faint uppercase tracking-widest">Joined</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle/50">
                    {adminUsers.length > 0 ? adminUsers.map((u, i) => (
                      <tr key={i} className="hover:bg-bg-elevated/30 transition-colors">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-md bg-accent/10 border border-border-subtle flex items-center justify-center overflow-hidden shrink-0">
                              {u.avatar_url ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" /> : <UserIcon size={13} className="text-accent" />}
                            </div>
                            <span className="text-xs font-bold text-text-pri truncate">{u.display_name || 'Anonymous'}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <code className="text-[10px] font-mono text-text-faint">{u.id?.slice(0, 8)}...</code>
                        </td>
                        <td className="px-5 py-3">
                          <span className="text-xs font-mono text-text-pri font-bold">{u.xp || 0}</span>
                        </td>
                        <td className="px-5 py-3 text-[11px] text-text-faint font-mono">
                          {u.created_at ? new Date(u.created_at).toLocaleDateString() : '-'}
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan="4" className="px-5 py-8 text-center text-xs text-text-faint">No users found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}
