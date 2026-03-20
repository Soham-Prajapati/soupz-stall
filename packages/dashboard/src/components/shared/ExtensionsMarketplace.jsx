import { useState } from 'react';
import {
  Package, Download, Check, Star, Search, Filter,
  Code2, Bot, Database, Globe, Zap, Palette, Shield,
  TrendingUp, FileText, Cpu, Server, GitBranch,
  X, ExternalLink, ArrowLeft,
} from 'lucide-react';
import { cn } from '../../lib/cn';
import { createCustomAgent } from '../../lib/learning';

const INSTALLED_KEY = 'soupz_installed_extensions';

function readInstalled() {
  try { return JSON.parse(localStorage.getItem(INSTALLED_KEY) || '[]'); } catch { return []; }
}
function saveInstalled(list) {
  localStorage.setItem(INSTALLED_KEY, JSON.stringify(list));
}

// Marketplace catalog — categorized extension packs
const EXTENSIONS = [
  // Agent Packs
  {
    id: 'fullstack-pack',
    name: 'Full-Stack Developer Pack',
    author: 'Soupz Team',
    version: '1.0.0',
    category: 'agents',
    description: 'Complete full-stack development toolkit: React, Node.js, database design, API building, and deployment.',
    icon: Code2,
    color: '#3B82F6',
    stars: 4.9,
    installs: '12k',
    agents: [
      { id: 'frontend-dev', name: 'Frontend Dev', description: 'React, Vue, CSS expert', cli: 'claude-code', specialist: 'dev' },
      { id: 'backend-dev',  name: 'Backend Dev',  description: 'APIs, databases, Node.js', cli: 'claude-code', specialist: 'architect' },
      { id: 'devops-pro',   name: 'DevOps Pro',   description: 'Docker, CI/CD, cloud', cli: 'gemini', specialist: 'devops' },
    ],
    tags: ['react', 'node', 'fullstack'],
  },
  {
    id: 'ai-ml-pack',
    name: 'AI/ML Engineering Pack',
    author: 'Soupz Team',
    version: '1.0.0',
    category: 'agents',
    description: 'Build ML pipelines, fine-tune models, implement RAG, and productionize AI. Includes prompt engineering expert.',
    icon: Bot,
    color: '#6366F1',
    stars: 4.8,
    installs: '8.3k',
    agents: [
      { id: 'ml-engineer', name: 'ML Engineer',      description: 'PyTorch, training, eval', cli: 'claude-code', specialist: 'ai-engineer' },
      { id: 'rag-builder',  name: 'RAG Builder',      description: 'Vector DBs, retrieval', cli: 'gemini', specialist: 'ai-engineer' },
      { id: 'prompt-eng',   name: 'Prompt Engineer',  description: 'LLM optimization', cli: 'copilot', specialist: 'ai-engineer' },
    ],
    tags: ['ai', 'ml', 'llm', 'rag'],
  },
  {
    id: 'startup-pack',
    name: 'Startup Toolkit',
    author: 'Soupz Team',
    version: '2.0.0',
    category: 'agents',
    description: 'Everything a startup needs: GTM strategy, pitch decks, financial modeling, legal basics, and growth hacking.',
    icon: TrendingUp,
    color: '#22C55E',
    stars: 4.7,
    installs: '6.1k',
    agents: [
      { id: 'growth-hacker-pro', name: 'Growth Expert',  description: 'SEO, acquisition, retention', cli: 'gemini', specialist: 'growth-hacker' },
      { id: 'pitch-master',      name: 'Pitch Master',   description: 'Decks, investor narratives', cli: 'claude-code', specialist: 'presenter' },
      { id: 'fin-model',         name: 'Finance Model',  description: 'Unit economics, P&L', cli: 'gemini', specialist: 'finance' },
    ],
    tags: ['startup', 'gtm', 'pitch', 'growth'],
  },
  {
    id: 'security-pack',
    name: 'Security Audit Pack',
    author: 'Community',
    version: '1.1.0',
    category: 'agents',
    description: 'Comprehensive security toolkit: threat modeling, OWASP audits, penetration testing guidance, and compliance.',
    icon: Shield,
    color: '#EF4444',
    stars: 4.6,
    installs: '4.5k',
    agents: [
      { id: 'sec-auditor', name: 'Security Auditor', description: 'OWASP, CVEs, code review', cli: 'claude-code', specialist: 'security' },
      { id: 'pen-tester',  name: 'Pen Test Guide',   description: 'Testing methodologies', cli: 'copilot', specialist: 'security' },
    ],
    tags: ['security', 'owasp', 'compliance'],
  },

  // Tool Integrations
  {
    id: 'github-tools',
    name: 'GitHub Deep Integration',
    author: 'Soupz Team',
    version: '1.0.0',
    category: 'tools',
    description: 'Advanced GitHub workflows: PR reviews, issue triage, code search, and automated release notes.',
    icon: GitBranch,
    color: '#6E40C9',
    stars: 4.8,
    installs: '15k',
    agents: [],
    tags: ['github', 'git', 'pr', 'automation'],
  },
  {
    id: 'database-tools',
    name: 'Database Toolkit',
    author: 'Community',
    version: '0.9.0',
    category: 'tools',
    description: 'SQL query optimization, schema design, migration scripts, and performance tuning for PostgreSQL, MySQL, SQLite.',
    icon: Database,
    color: '#F59E0B',
    stars: 4.5,
    installs: '7.2k',
    agents: [
      { id: 'db-expert', name: 'DB Expert', description: 'SQL, schema, optimization', cli: 'claude-code', specialist: 'analyst' },
    ],
    tags: ['sql', 'postgres', 'mysql', 'database'],
  },
  {
    id: 'web-scraping',
    name: 'Web Research Pack',
    author: 'Community',
    version: '1.0.0',
    category: 'tools',
    description: 'Market research, competitor analysis, web content extraction, and data aggregation workflows.',
    icon: Globe,
    color: '#06B6D4',
    stars: 4.4,
    installs: '5.8k',
    agents: [
      { id: 'web-researcher', name: 'Web Researcher', description: 'Research, scraping, analysis', cli: 'gemini', specialist: 'researcher' },
    ],
    tags: ['research', 'web', 'data', 'scraping'],
  },

  // Workflow Extensions
  {
    id: 'content-workflow',
    name: 'Content Creation Suite',
    author: 'Community',
    version: '1.0.0',
    category: 'workflows',
    description: 'End-to-end content pipeline: research → outline → draft → edit → SEO optimize → publish-ready.',
    icon: FileText,
    color: '#EC4899',
    stars: 4.3,
    installs: '3.9k',
    agents: [
      { id: 'content-strategist', name: 'Content Strategist', description: 'Strategy, calendar, briefs', cli: 'gemini', specialist: 'contentwriter' },
      { id: 'seo-writer',         name: 'SEO Writer',         description: 'Keyword-optimized content', cli: 'copilot', specialist: 'contentwriter' },
    ],
    tags: ['content', 'seo', 'blog', 'writing'],
  },
  {
    id: 'design-system-pack',
    name: 'Design System Pack',
    author: 'Soupz Team',
    version: '1.0.0',
    category: 'workflows',
    description: 'Component libraries, design tokens, accessibility audits, and Figma-to-code workflows.',
    icon: Palette,
    color: '#8B5CF6',
    stars: 4.7,
    installs: '5.2k',
    agents: [
      { id: 'design-sys-expert', name: 'Design System', description: 'Tokens, components, a11y', cli: 'claude-code', specialist: 'ui-builder' },
    ],
    tags: ['design', 'figma', 'components', 'a11y'],
  },
  {
    id: 'infrastructure-pack',
    name: 'Infrastructure Pack',
    author: 'Community',
    version: '1.0.0',
    category: 'workflows',
    description: 'Terraform, Kubernetes, cloud architecture, cost optimization, and incident response playbooks.',
    icon: Server,
    color: '#F97316',
    stars: 4.6,
    installs: '4.8k',
    agents: [
      { id: 'infra-architect', name: 'Infra Architect', description: 'Terraform, K8s, cloud', cli: 'copilot', specialist: 'devops' },
      { id: 'cost-opt-pro',    name: 'Cost Optimizer', description: 'Cloud spend reduction', cli: 'gemini', specialist: 'cost-optimizer' },
    ],
    tags: ['terraform', 'k8s', 'cloud', 'infra'],
  },
];

const CATEGORIES = [
  { id: 'all',       label: 'All' },
  { id: 'agents',    label: 'Agent Packs' },
  { id: 'tools',     label: 'Tool Integrations' },
  { id: 'workflows', label: 'Workflows' },
];

export default function ExtensionsMarketplace({ onClose }) {
  const [installed, setInstalled] = useState(readInstalled);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [selected, setSelected] = useState(null);
  const [installing, setInstalling] = useState(null);

  const isInstalled = (id) => installed.includes(id);

  async function install(ext) {
    if (isInstalled(ext.id)) return;
    setInstalling(ext.id);

    // Simulate install delay
    await new Promise(r => setTimeout(r, 800));

    // Install all agents from this extension
    for (const agent of ext.agents) {
      createCustomAgent(
        agent.name,
        agent.description,
        agent.cli,
        agent.specialist,
        ext.tags,
        false, // not autoCreated — user installed
      );
    }

    const next = [...installed, ext.id];
    setInstalled(next);
    saveInstalled(next);
    setInstalling(null);
  }

  function uninstall(ext) {
    const next = installed.filter(id => id !== ext.id);
    setInstalled(next);
    saveInstalled(next);
  }

  const filtered = EXTENSIONS.filter(e => {
    const matchCat = category === 'all' || e.category === category;
    const matchSearch = !search ||
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.description.toLowerCase().includes(search.toLowerCase()) ||
      e.tags.some(t => t.includes(search.toLowerCase()));
    return matchCat && matchSearch;
  });

  if (selected) {
    const ext = EXTENSIONS.find(e => e.id === selected);
    const Icon = ext.icon;
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border-subtle">
          <button onClick={() => setSelected(null)} className="text-text-faint hover:text-text-sec transition-colors">
            <ArrowLeft size={16} />
          </button>
          <span className="text-sm font-ui font-medium text-text-pri">{ext.name}</span>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${ext.color}15` }}>
              <Icon size={22} style={{ color: ext.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-ui font-semibold text-text-pri">{ext.name}</h3>
              <p className="text-xs text-text-faint font-ui">by {ext.author} · v{ext.version}</p>
              <div className="flex items-center gap-1 mt-1">
                <Star size={10} className="text-warning fill-warning" />
                <span className="text-[11px] text-text-sec font-ui">{ext.stars} · {ext.installs} installs</span>
              </div>
            </div>
          </div>
          <p className="text-xs text-text-sec font-ui leading-relaxed">{ext.description}</p>
          {ext.agents.length > 0 && (
            <div>
              <p className="text-[11px] text-text-faint font-ui font-medium uppercase tracking-wider mb-2">Included Agents ({ext.agents.length})</p>
              <div className="space-y-2">
                {ext.agents.map(a => (
                  <div key={a.id} className="flex items-center gap-2 bg-bg-elevated border border-border-subtle rounded-lg px-3 py-2">
                    <Bot size={13} className="text-accent shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-ui font-medium text-text-pri">{a.name}</p>
                      <p className="text-[10px] text-text-faint">{a.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-1.5">
            {ext.tags.map(t => (
              <span key={t} className="text-[10px] font-mono bg-bg-elevated border border-border-subtle text-text-faint px-2 py-0.5 rounded-full">{t}</span>
            ))}
          </div>
          <button
            onClick={() => isInstalled(ext.id) ? uninstall(ext) : install(ext)}
            disabled={installing === ext.id}
            className={cn(
              'w-full py-2.5 rounded-lg text-sm font-ui font-medium transition-all flex items-center justify-center gap-2',
              isInstalled(ext.id)
                ? 'bg-bg-elevated border border-border-mid text-text-sec hover:text-danger hover:border-danger/30'
                : 'bg-accent hover:bg-accent-hover text-white',
              installing === ext.id && 'opacity-70 cursor-wait',
            )}
          >
            {installing === ext.id ? (
              <><Zap size={14} className="animate-pulse" />Installing...</>
            ) : isInstalled(ext.id) ? (
              <><Check size={14} />Installed — Click to remove</>
            ) : (
              <><Download size={14} />Install</>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border-subtle flex items-center gap-2">
        <Package size={14} className="text-accent" />
        <span className="text-sm font-ui font-semibold text-text-pri flex-1">Extensions</span>
        {onClose && (
          <button onClick={onClose} className="text-text-faint hover:text-text-sec transition-colors">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Search */}
      <div className="px-3 pt-3 pb-2">
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-faint" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search extensions..."
            className="w-full bg-bg-elevated border border-border-subtle rounded-md pl-7 pr-3 py-1.5 text-xs font-ui text-text-pri placeholder:text-text-faint focus:outline-none focus:border-accent transition-colors"
          />
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex gap-0.5 px-3 pb-2">
        {CATEGORIES.map(c => (
          <button
            key={c.id}
            onClick={() => setCategory(c.id)}
            className={cn(
              'px-2.5 py-1 rounded text-[11px] font-ui transition-all',
              category === c.id
                ? 'bg-accent/10 text-accent font-medium'
                : 'text-text-faint hover:text-text-sec',
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Extension list */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2">
        {filtered.length === 0 && (
          <div className="py-8 text-center">
            <Package size={24} className="mx-auto text-text-faint opacity-30 mb-2" />
            <p className="text-xs text-text-faint font-ui">No extensions found</p>
          </div>
        )}
        {filtered.map(ext => {
          const Icon = ext.icon;
          const inst = isInstalled(ext.id);
          return (
            <button
              key={ext.id}
              onClick={() => setSelected(ext.id)}
              className="w-full text-left bg-bg-elevated border border-border-subtle hover:border-border-mid rounded-xl p-3 transition-all group"
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform" style={{ background: `${ext.color}15` }}>
                  <Icon size={17} style={{ color: ext.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-ui font-semibold text-text-pri truncate">{ext.name}</span>
                    {inst && <Check size={10} className="text-success shrink-0" />}
                  </div>
                  <p className="text-[11px] text-text-faint font-ui line-clamp-2 mt-0.5">{ext.description}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="flex items-center gap-0.5 text-[10px] text-text-faint">
                      <Star size={9} className="text-warning fill-warning" /> {ext.stars}
                    </span>
                    <span className="text-[10px] text-text-faint">{ext.installs} installs</span>
                    {ext.agents.length > 0 && (
                      <span className="text-[10px] text-text-faint">{ext.agents.length} agents</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); inst ? uninstall(ext) : install(ext); }}
                  disabled={installing === ext.id}
                  className={cn(
                    'shrink-0 p-1.5 rounded-md transition-all',
                    inst
                      ? 'text-success bg-success/10 hover:bg-danger/10 hover:text-danger'
                      : 'text-text-faint bg-bg-base hover:bg-accent/10 hover:text-accent',
                    installing === ext.id && 'opacity-50 cursor-wait',
                  )}
                  title={inst ? 'Uninstall' : 'Install'}
                >
                  {installing === ext.id ? <Zap size={13} className="animate-pulse" /> : inst ? <Check size={13} /> : <Download size={13} />}
                </button>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
