import { useState, useEffect } from 'react';
import {
  Package, Download, Check, Star, Search, Filter,
  Code2, Bot, Database, Globe, Zap, Palette, Shield,
  TrendingUp, FileText, Cpu, Server, GitBranch,
  X, ExternalLink, ArrowLeft, Loader2
} from 'lucide-react';
import { cn } from '../../lib/cn';
import { createCustomAgent } from '../../lib/learning';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

const ICON_MAP = { Code2, Bot, Database, Globe, Zap, Palette, Shield, TrendingUp, FileText, Cpu, Server, GitBranch };

const CATEGORIES = [
  { id: 'all',       label: 'All' },
  { id: 'agents',    label: 'Agent Packs' },
  { id: 'tools',     label: 'Tool Integrations' },
  { id: 'workflows', label: 'Workflows' },
];

export default function ExtensionsMarketplace({ onClose }) {
  const [installed, setInstalled] = useState(() => {
    try { return JSON.parse(localStorage.getItem('soupz_installed_extensions') || '[]'); } catch { return []; }
  });
  const [extensions, setExtensions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [selectedId, setSelectedId] = useState(null);
  const [installing, setInstalling] = useState(null);

  useEffect(() => {
    async function fetchExtensions() {
      if (!isSupabaseConfigured()) {
        setExtensions([]);
        setLoading(false);
        return;
      }
      try {
        const { data } = await supabase.from('soupz_extensions').select('*').order('stars', { ascending: false });
        setExtensions(data || []);
      } catch (err) {
        console.error('Failed to fetch extensions:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchExtensions();
  }, []);

  const isInstalled = (id) => installed.includes(id);

  async function install(ext) {
    if (isInstalled(ext.id)) return;
    setInstalling(ext.id);
    await new Promise(r => setTimeout(r, 600));

    const agents = ext.agents || [];
    for (const agent of agents) {
      createCustomAgent(agent.name, agent.description, agent.cli, agent.specialist, ext.tags || [], false);
    }

    const next = [...installed, ext.id];
    setInstalled(next);
    localStorage.setItem('soupz_installed_extensions', JSON.stringify(next));
    setInstalling(null);
  }

  function uninstall(extId) {
    const next = installed.filter(id => id !== extId);
    setInstalled(next);
    localStorage.setItem('soupz_installed_extensions', JSON.stringify(next));
  }

  const filtered = extensions.filter(e => {
    const matchCat = category === 'all' || e.category === category;
    const matchSearch = !search || e.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const selected = extensions.find(e => e.id === selectedId);

  if (loading) return (
    <div className="flex-1 flex items-center justify-center p-8 bg-bg-surface">
      <Loader2 size={20} className="text-accent animate-spin" />
    </div>
  );

  if (selected) {
    const Icon = ICON_MAP[selected.icon_name] || Package;
    return (
      <div className="flex flex-col h-full bg-bg-surface">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border-subtle shrink-0">
          <button onClick={() => setSelectedId(null)} className="p-1 -ml-1 rounded hover:bg-bg-elevated text-text-faint hover:text-text-sec transition-colors">
            <ArrowLeft size={16} />
          </button>
          <span className="text-xs font-ui font-bold text-text-pri uppercase tracking-widest">{selected.name}</span>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border border-border-subtle bg-bg-base" style={{ color: selected.color }}>
              <Icon size={28} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-ui font-bold text-text-pri">{selected.name}</h3>
              <p className="text-xs text-text-faint font-ui">by {selected.author || 'Soupz Community'} · v{selected.version || '1.0.0'}</p>
              <div className="flex items-center gap-3 mt-2">
                <div className="flex items-center gap-1 text-[11px] text-warning">
                  <Star size={10} className="fill-warning" />
                  <span className="font-bold">{selected.stars || '4.5'}</span>
                </div>
                <span className="text-[11px] text-text-faint font-mono uppercase tracking-tighter">{selected.installs || '0'} installs</span>
              </div>
            </div>
          </div>
          
          <div className="space-y-4">
            <p className="text-sm text-text-sec font-ui leading-relaxed bg-bg-base/50 p-3 rounded-xl border border-border-subtle italic">
              "{selected.description}"
            </p>
            
            {selected.agents?.length > 0 && (
              <div className="space-y-3">
                <p className="text-[10px] text-text-faint font-bold uppercase tracking-widest px-1">Bundle Components</p>
                <div className="space-y-2">
                  {selected.agents.map((a, i) => (
                    <div key={i} className="flex items-center gap-3 bg-bg-elevated/50 border border-border-subtle rounded-xl px-3 py-2.5">
                      <div className="w-8 h-8 rounded-lg bg-bg-base flex items-center justify-center border border-border-subtle">
                        <Bot size={14} className="text-accent" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-ui font-semibold text-text-pri">{a.name}</p>
                        <p className="text-[10px] text-text-faint truncate">{a.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => isInstalled(selected.id) ? uninstall(selected.id) : install(selected)}
            disabled={installing === selected.id}
            className={cn(
              'w-full py-3 rounded-xl text-sm font-ui font-bold transition-all flex items-center justify-center gap-2 shadow-soft',
              isInstalled(selected.id)
                ? 'bg-bg-elevated border border-border-mid text-text-sec hover:text-danger hover:border-danger/30'
                : 'bg-accent hover:bg-accent-hover text-white',
              installing === selected.id && 'opacity-70 cursor-wait',
            )}
          >
            {installing === selected.id ? (
              <><Loader2 size={16} className="animate-spin" />Syncing Bundle...</>
            ) : isInstalled(selected.id) ? (
              <><X size={16} />Remove Bundle</>
            ) : (
              <><Download size={16} />Install to Workspace</>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-bg-surface">
      <div className="px-4 py-3 border-b border-border-subtle flex items-center gap-2 shrink-0">
        <Package size={14} className="text-accent" />
        <span className="text-xs font-ui font-bold text-text-pri uppercase tracking-widest flex-1">Extension Forge</span>
        {onClose && (
          <button onClick={onClose} className="p-1 rounded hover:bg-bg-elevated text-text-faint hover:text-text-sec transition-colors">
            <X size={14} />
          </button>
        )}
      </div>

      <div className="p-3 space-y-3 shrink-0">
        <div className="relative">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search Marketplace..."
            className="w-full bg-bg-base border border-border-subtle rounded-xl pl-9 pr-3 py-2 text-xs font-ui text-text-pri placeholder:text-text-faint focus:outline-none focus:border-accent transition-colors"
          />
        </div>

        <div className="flex bg-bg-base p-0.5 rounded-lg border border-border-subtle">
          {CATEGORIES.map(c => (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              className={cn(
                'flex-1 py-1.5 rounded-md text-[10px] font-ui font-bold uppercase tracking-wider transition-all',
                category === c.id ? 'bg-bg-elevated text-accent shadow-sm border border-border-subtle' : 'text-text-faint hover:text-text-sec',
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-2.5 custom-scrollbar">
        {filtered.length === 0 && !loading && (
          <div className="py-12 text-center opacity-40">
            <Package size={32} className="mx-auto text-text-faint mb-3" />
            <p className="text-xs font-ui">No modules found in this sector</p>
          </div>
        )}
        {filtered.map(ext => {
          const Icon = ICON_MAP[ext.icon_name] || Package;
          const inst = isInstalled(ext.id);
          return (
            <button
              key={ext.id}
              onClick={() => setSelectedId(ext.id)}
              className="w-full text-left bg-bg-elevated/40 border border-border-subtle hover:border-border-mid rounded-2xl p-4 transition-all group relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-1 h-full transition-all group-hover:w-1.5" style={{ background: ext.color }} />
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-bg-base border border-border-subtle group-hover:scale-105 transition-transform" style={{ color: ext.color }}>
                  <Icon size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-ui font-bold text-text-pri truncate">{ext.name}</span>
                    {inst && <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />}
                  </div>
                  <p className="text-[11px] text-text-faint font-ui line-clamp-2 mt-1 leading-relaxed">{ext.description}</p>
                  <div className="flex items-center gap-3 mt-3">
                    <div className="flex items-center gap-1 text-[9px] text-text-faint font-bold">
                      <Star size={9} className="text-warning fill-warning" /> {ext.stars}
                    </div>
                    <span className="text-[9px] text-text-faint font-mono uppercase">{ext.installs} DL</span>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
