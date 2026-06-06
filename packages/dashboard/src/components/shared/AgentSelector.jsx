import { useState, useEffect, useRef } from 'react';
import {
  ChevronDown, Check,
  Cpu, Palette, Code2, Search, TrendingUp, Server, DollarSign, Bot,
  Zap, BrainCircuit, Sparkles, Github,
} from 'lucide-react';
import { cn } from '../../lib/cn';
import { CLI_AGENTS, SPECIALISTS, getAgentById } from '../../lib/agents';

// Map specialist ids to Lucide icon overrides
const ICON_MAP = {
  auto: Cpu,
  designer: Palette,
  dev: Code2,
  researcher: Search,
  strategist: TrendingUp,
  devops: Server,
  finance: DollarSign,
  'ai-engineer': Bot,
  gemini: Sparkles,
  codex: Code2,
  'claude-code': BrainCircuit,
  copilot: Github,
  kiro: Zap,
};

export function getAgentIcon(id) {
  const entry = [...CLI_AGENTS, ...SPECIALISTS].find(a => a.id === id);
  return ICON_MAP[id] || entry?.icon || Bot;
}

// ─── Agent option row inside the dropdown ────────────────────────────────────

function AgentOption({ agent, selected, onSelect }) {
  const Icon = getAgentIcon(agent.id);
  return (
    <button
      type="button"
      onClick={() => onSelect(agent.id)}
      className={cn(
        'w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-bg-overlay transition-colors',
        selected === agent.id ? 'bg-bg-overlay' : '',
      )}
    >
      <Icon size={14} style={{ color: agent.color }} className="shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-ui font-medium text-text-pri">{agent.name}</div>
        <div className="text-[11px] text-text-faint truncate">{agent.description || agent.desc}</div>
      </div>
      {agent.freeModel && (
        <span className="text-[10px] px-1 py-0.5 rounded bg-success/10 text-success font-ui shrink-0">
          Free
        </span>
      )}
      {selected === agent.id && <Check size={11} className="text-accent shrink-0" />}
    </button>
  );
}

// ─── Floating dropdown panel ─────────────────────────────────────────────────

function AgentDropdownPanel({ selected, onSelect, onClose }) {
  const [tab, setTab] = useState('cli');
  const panelRef = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [onClose]);

  return (
    <div
      ref={panelRef}
      className="absolute top-full left-0 mt-1 w-72 bg-bg-elevated border border-border-mid rounded-xl shadow-soft z-50 overflow-hidden"
    >
      {/* Tabs */}
      <div className="flex border-b border-border-subtle">
        {['cli', 'specialist'].map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              'flex-1 py-2 text-xs font-ui font-medium transition-colors',
              tab === t
                ? 'text-text-pri border-b-2 border-accent -mb-px'
                : 'text-text-faint hover:text-text-sec',
            )}
          >
            {t === 'cli' ? 'CLI Agents' : 'Specialists'}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="max-h-56 overflow-y-auto py-1">
        {tab === 'cli' ? (
          <>
            <AgentOption
              agent={{ id: 'auto', name: 'Auto', color: '#A855F7', description: 'AI picks best agent' }}
              selected={selected}
              onSelect={onSelect}
            />
            {CLI_AGENTS.map(a => (
              <AgentOption key={a.id} agent={a} selected={selected} onSelect={onSelect} />
            ))}
          </>
        ) : (
          SPECIALISTS
            .filter(s => s.id !== 'auto' && s.id !== 'orchestrator')
            .map(a => (
              <AgentOption
                key={a.id}
                agent={{ ...a, description: a.desc }}
                selected={selected}
                onSelect={onSelect}
              />
            ))
        )}
      </div>
    </div>
  );
}

// ─── AgentSelector (exported default) ────────────────────────────────────────

/**
 * Props:
 *   selectedId  string          Currently selected agent id
 *   onChange    (id) => void    Called when user picks a different agent
 *   compact     boolean         Show just icon + name, hide chevron label on mobile
 */
export default function AgentSelector({ selectedId = 'auto', onChange, compact = false }) {
  const [open, setOpen] = useState(false);

  const agent = getAgentById(selectedId) || { id: 'auto', name: 'Auto', color: '#A855F7' };
  const Icon = getAgentIcon(selectedId);

  function handleSelect(id) {
    onChange?.(id);
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={cn(
          'flex items-center gap-1.5 rounded-md bg-bg-elevated border border-border-subtle hover:border-border-mid text-text-pri font-ui transition-all',
          compact ? 'px-2 py-1 text-xs' : 'px-2.5 py-1.5 text-xs',
        )}
      >
        <Icon size={12} style={{ color: agent.color }} />
        <span>{agent.name}</span>
        {!compact && <ChevronDown size={10} className="text-text-faint ml-0.5" />}
        {compact && <ChevronDown size={9} className="text-text-faint ml-0.5 hidden sm:block" />}
      </button>

      {open && (
        <AgentDropdownPanel
          selected={selectedId}
          onSelect={handleSelect}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
