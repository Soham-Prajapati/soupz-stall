// LearnedAgents.jsx — Frequently-used, suggested, and custom ("My agents") sections
// Rendered inside the agent dropdown to surface learned patterns to the user.

import { useState, useEffect, useCallback } from 'react';
import {
  History, Sparkles, Plus, Trash2, X, Check, ChevronDown, ChevronUp, Info,
} from 'lucide-react';
import { cn } from '../../lib/cn';
import { CLI_AGENTS, SPECIALISTS } from '../../lib/agents';
import {
  getTopAgents,
  getCustomAgents,
  getAgentSuggestions,
  createCustomAgent,
  deleteCustomAgent,
  clearAllLearning,
} from '../../lib/learning';

// ---------------------------------------------------------------------------
// Icon resolution — custom agents store icon names as strings for serialization
// ---------------------------------------------------------------------------

// Lazy-import all the icons we might need for custom agents at runtime
const LUCIDE_ICON_MAP = {
  Sparkles,
};

// Resolve a string icon name → Lucide component, falling back to Sparkles
function resolveIcon(iconNameOrComponent) {
  if (!iconNameOrComponent) return Sparkles;
  if (typeof iconNameOrComponent === 'string') {
    return LUCIDE_ICON_MAP[iconNameOrComponent] || Sparkles;
  }
  return iconNameOrComponent;
}

// Get color/icon from CLI_AGENTS or SPECIALISTS by id
function getAgentMeta(id) {
  return [...CLI_AGENTS, ...SPECIALISTS].find(a => a.id === id) || null;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionHeader({ icon: Icon, label, action }) {
  return (
    <div className="flex items-center justify-between px-3 pt-2.5 pb-1">
      <div className="flex items-center gap-1.5">
        <Icon size={11} className="text-text-faint" />
        <span className="text-[10px] font-ui font-medium text-text-faint uppercase tracking-wider">
          {label}
        </span>
      </div>
      {action}
    </div>
  );
}

function AgentRow({ id, name, description, color, IconComponent, selected, onSelect, onDelete, badge }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      className={cn(
        'w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-bg-overlay transition-colors group',
        selected === id ? 'bg-bg-overlay' : '',
      )}
    >
      <IconComponent size={14} style={{ color }} className="shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-ui font-medium text-text-pri truncate">{name}</span>
          {badge}
        </div>
        {description && (
          <div className="text-[11px] text-text-faint truncate">{description}</div>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {selected === id && <Check size={11} className="text-accent" />}
        {onDelete && (
          <span
            role="button"
            tabIndex={0}
            onClick={e => { e.stopPropagation(); onDelete(id); }}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onDelete(id); } }}
            className="opacity-0 group-hover:opacity-100 text-text-faint hover:text-danger transition-all p-0.5 rounded"
            title="Remove agent"
          >
            <Trash2 size={10} />
          </span>
        )}
      </div>
    </button>
  );
}

// Inline "create agent" form
function CreateAgentForm({ onCreated, onCancel }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [keywords, setKeywords] = useState('');
  const [cliAgent, setCliAgent] = useState(CLI_AGENTS[0]?.id || 'claude-code');
  const [specialist, setSpecialist] = useState('auto');
  const [error, setError] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required'); return; }
    const triggerKeywords = keywords.split(',').map(k => k.trim()).filter(Boolean);
    const agent = createCustomAgent(name.trim(), description.trim(), cliAgent, specialist, triggerKeywords, false);
    onCreated(agent);
  }

  const inputCls = 'w-full bg-bg-base border border-border-subtle rounded-md px-2.5 py-1.5 text-xs font-ui text-text-pri placeholder:text-text-faint focus:outline-none focus:border-accent transition-colors';
  const selectCls = inputCls + ' cursor-pointer';

  return (
    <form onSubmit={handleSubmit} className="mx-3 mb-3 mt-1 bg-bg-base border border-border-subtle rounded-xl p-3 space-y-2.5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-ui font-medium text-text-pri">New agent</span>
        <button type="button" onClick={onCancel} className="text-text-faint hover:text-text-sec transition-colors">
          <X size={12} />
        </button>
      </div>

      {error && (
        <p className="text-[11px] text-danger font-ui">{error}</p>
      )}

      <div>
        <label className="text-[10px] text-text-faint font-ui block mb-1">Name</label>
        <input
          className={inputCls}
          value={name}
          onChange={e => { setName(e.target.value); setError(''); }}
          placeholder="e.g. Claude for React"
          autoFocus
        />
      </div>

      <div>
        <label className="text-[10px] text-text-faint font-ui block mb-1">Description</label>
        <input
          className={inputCls}
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="What does this agent do?"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-text-faint font-ui block mb-1">CLI Agent</label>
          <select className={selectCls} value={cliAgent} onChange={e => setCliAgent(e.target.value)}>
            {CLI_AGENTS.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-text-faint font-ui block mb-1">Specialist</label>
          <select className={selectCls} value={specialist} onChange={e => setSpecialist(e.target.value)}>
            <option value="auto">Auto</option>
            {SPECIALISTS.filter(s => s.id !== 'auto' && s.id !== 'orchestrator').map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="text-[10px] text-text-faint font-ui block mb-1">
          Trigger keywords <span className="text-text-faint">(comma-separated)</span>
        </label>
        <input
          className={inputCls}
          value={keywords}
          onChange={e => setKeywords(e.target.value)}
          placeholder="react, typescript, component"
        />
      </div>

      <div className="flex gap-2 pt-0.5">
        <button
          type="submit"
          className="flex-1 py-1.5 bg-accent hover:bg-accent-hover text-white text-xs font-ui font-medium rounded-md transition-colors"
        >
          Create agent
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 border border-border-subtle text-text-sec text-xs font-ui rounded-md hover:bg-bg-overlay transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// Suggestion row shown when the system detects a high-confidence pattern
function SuggestionRow({ suggestion, onAccept, onDismiss }) {
  return (
    <div className="mx-3 mb-2 bg-warning/5 border border-warning/20 rounded-lg px-3 py-2.5">
      <div className="flex items-start gap-2">
        <Info size={12} className="text-warning shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-ui font-medium text-text-pri truncate">{suggestion.name}</p>
          <p className="text-[11px] text-text-faint mt-0.5 leading-relaxed">{suggestion.description}</p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="text-text-faint hover:text-text-sec transition-colors shrink-0"
          title="Dismiss"
        >
          <X size={11} />
        </button>
      </div>
      <button
        type="button"
        onClick={onAccept}
        className="mt-2 w-full py-1 bg-warning/10 hover:bg-warning/20 border border-warning/30 text-warning text-[11px] font-ui font-medium rounded-md transition-colors"
      >
        Create this agent
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LearnedAgents — main export
// ---------------------------------------------------------------------------

/**
 * Props:
 *   onSelect    (agentId: string) => void   — called when user clicks an agent
 *   selectedId  string                      — currently selected agent id
 */
export default function LearnedAgents({ onSelect, selectedId }) {
  const [topAgentIds, setTopAgentIds] = useState([]);
  const [customAgents, setCustomAgents] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [dismissedSuggestions, setDismissedSuggestions] = useState(() => {
    try { return JSON.parse(localStorage.getItem('soupz_dismissed_suggestions') || '[]'); } catch { return []; }
  });
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showMyAgents, setShowMyAgents] = useState(true);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const refresh = useCallback(() => {
    setTopAgentIds(getTopAgents(3));
    setCustomAgents(getCustomAgents());
    setSuggestions(
      getAgentSuggestions().filter(s => !dismissedSuggestions.includes(`${s.cliAgent}::${s.specialist}`)),
    );
  }, [dismissedSuggestions]);

  useEffect(() => { refresh(); }, [refresh]);

  function handleDelete(id) {
    deleteCustomAgent(id);
    refresh();
  }

  function handleCreated(agent) {
    setShowCreateForm(false);
    refresh();
    onSelect(agent.id);
  }

  function handleAcceptSuggestion(suggestion) {
    const agent = createCustomAgent(
      suggestion.name,
      suggestion.description,
      suggestion.cliAgent,
      suggestion.specialist,
      [],
      false,
    );
    refresh();
    onSelect(agent.id);
  }

  function handleDismissSuggestion(suggestion) {
    const key = `${suggestion.cliAgent}::${suggestion.specialist}`;
    const next = [...dismissedSuggestions, key];
    setDismissedSuggestions(next);
    localStorage.setItem('soupz_dismissed_suggestions', JSON.stringify(next));
    setSuggestions(prev => prev.filter(s => `${s.cliAgent}::${s.specialist}` !== key));
  }

  function handleClearAll() {
    clearAllLearning();
    setShowClearConfirm(false);
    refresh();
  }

  // Nothing to show yet — return null so the parent can hide the section entirely
  const hasContent = topAgentIds.length > 0 || customAgents.length > 0 || suggestions.length > 0;
  if (!hasContent && !showCreateForm) {
    return (
      <div className="px-3 py-2.5 border-t border-border-subtle">
        <button
          type="button"
          onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-1.5 text-[11px] font-ui text-text-faint hover:text-accent transition-colors"
        >
          <Plus size={11} />
          Add custom provider
        </button>
        {showCreateForm && (
          <CreateAgentForm onCreated={handleCreated} onCancel={() => setShowCreateForm(false)} />
        )}
      </div>
    );
  }

  return (
    <div className="border-t border-border-subtle">

      {/* ── Frequently used ──────────────────────────────────────────── */}
      {topAgentIds.length > 0 && (
        <div>
          <SectionHeader icon={History} label="Frequently used" />
          {topAgentIds.map(id => {
            const meta = getAgentMeta(id);
            if (!meta) return null;
            const Icon = resolveIcon(meta.icon);
            return (
              <AgentRow
                key={id}
                id={id}
                name={meta.name}
                description={meta.description || meta.desc}
                color={meta.color}
                IconComponent={Icon}
                selected={selectedId}
                onSelect={onSelect}
              />
            );
          })}
        </div>
      )}

      {/* ── Suggestions ───────────────────────────────────────────────── */}
      {suggestions.length > 0 && (
        <div>
          <SectionHeader icon={Sparkles} label="Suggested" />
          {suggestions.map((s, i) => (
            <SuggestionRow
              key={i}
              suggestion={s}
              onAccept={() => handleAcceptSuggestion(s)}
              onDismiss={() => handleDismissSuggestion(s)}
            />
          ))}
        </div>
      )}

      {/* ── My Agents ─────────────────────────────────────────────────── */}
      {(customAgents.length > 0 || showCreateForm) && (
        <div>
          <SectionHeader
            icon={Sparkles}
            label="My agents"
            action={
              <button
                type="button"
                onClick={() => setShowMyAgents(v => !v)}
                className="text-text-faint hover:text-text-sec transition-colors"
              >
                {showMyAgents ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              </button>
            }
          />

          {showMyAgents && (
            <>
              {customAgents.map(agent => {
                const Icon = resolveIcon(agent.icon);
                return (
                  <AgentRow
                    key={agent.id}
                    id={agent.id}
                    name={agent.name}
                    description={agent.description}
                    color={agent.color}
                    IconComponent={Icon}
                    selected={selectedId}
                    onSelect={onSelect}
                    onDelete={handleDelete}
                    badge={
                      agent.autoCreated
                        ? <span className="text-[9px] font-ui text-text-faint bg-bg-overlay px-1 py-0.5 rounded border border-border-subtle">auto</span>
                        : null
                    }
                  />
                );
              })}

              {showCreateForm ? (
                <CreateAgentForm onCreated={handleCreated} onCancel={() => setShowCreateForm(false)} />
              ) : (
                <button
                  type="button"
                  onClick={() => setShowCreateForm(true)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-bg-overlay transition-colors text-text-faint hover:text-text-sec group"
                >
                  <Plus size={12} className="shrink-0" />
                  <span className="text-[11px] font-ui">Create agent</span>
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* ── No custom agents yet — just show create button ────────────── */}
      {customAgents.length === 0 && !showCreateForm && topAgentIds.length > 0 && (
        <div className="px-3 pb-2 pt-1">
          <button
            type="button"
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-1.5 text-[11px] font-ui text-text-faint hover:text-accent transition-colors"
          >
            <Plus size={11} />
            Add custom provider
          </button>
          {showCreateForm && (
            <CreateAgentForm onCreated={handleCreated} onCancel={() => setShowCreateForm(false)} />
          )}
        </div>
      )}

      {/* ── Clear learned data ────────────────────────────────────────── */}
      {hasContent && (
        <div className="border-t border-border-subtle px-3 py-2">
          {showClearConfirm ? (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-text-faint font-ui">Clear all learning data?</span>
              <button
                type="button"
                onClick={handleClearAll}
                className="text-[11px] font-ui text-danger hover:text-danger/80 transition-colors"
              >
                Yes, clear
              </button>
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="text-[11px] font-ui text-text-faint hover:text-text-sec transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowClearConfirm(true)}
              className="text-[10px] font-ui text-text-faint hover:text-text-sec transition-colors"
            >
              Clear learning data
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SuggestionDot — yellow dot badge for the agent selector button
// ---------------------------------------------------------------------------

/**
 * A small yellow dot shown on top of the agent selector button when there
 * are unseen suggestions. Import and use this in the trigger button.
 */
export function SuggestionDot() {
  const [hasSuggestions, setHasSuggestions] = useState(false);

  useEffect(() => {
    function check() {
      const dismissed = JSON.parse(localStorage.getItem('soupz_dismissed_suggestions') || '[]');
      const suggestions = getAgentSuggestions().filter(
        s => !dismissed.includes(`${s.cliAgent}::${s.specialist}`),
      );
      setHasSuggestions(suggestions.length > 0);
    }
    check();
    // Re-check whenever localStorage changes (cross-tab)
    window.addEventListener('storage', check);
    return () => window.removeEventListener('storage', check);
  }, []);

  if (!hasSuggestions) return null;

  return (
    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-warning border border-bg-surface" />
  );
}
