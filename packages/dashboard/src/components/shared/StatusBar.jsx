import { useState, useEffect, useRef, useMemo } from 'react';
import {
  GitBranch, AlertCircle, AlertTriangle, Bell, Bot,
  Wifi, WifiOff, MessageSquare, Flame, Zap, Check,
  BrainCircuit, Sparkles, Github, Cpu, X, ChevronUp,
  Radio, Clock, Terminal, RotateCcw,
} from 'lucide-react';
import { cn } from '../../lib/cn';
import { getAgentById, CLI_AGENTS } from '../../lib/agents';
import { checkAgentAvailability } from '../../lib/daemon';

const STORAGE_KEY = 'soupz_chat_history';
const USAGE_KEY   = 'soupz_agent_usage';
const STREAK_KEY  = 'soupz_streak';
const AGENT_KEY   = 'soupz_agent';

const AGENT_ICONS = {
  gemini: Sparkles,
  'claude-code': BrainCircuit,
  copilot: Github,
  kiro: Zap,
  ollama: Cpu,
};

function readJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; }
}

function StatusItem({ children, onClick, title, active, className }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      title={title}
      className={cn(
        'flex items-center gap-1 px-1.5 h-[22px] text-[11px] font-ui transition-colors whitespace-nowrap',
        onClick ? 'hover:bg-white/10 cursor-pointer' : '',
        active ? 'bg-white/15' : '',
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export default function StatusBar({
  workspaceOnline = false,
  machine,
  mode = 'simple',
  editorState = null,
}) {
  const [agentPopupOpen, setAgentPopupOpen] = useState(false);
  const [notifPopupOpen, setNotifPopupOpen] = useState(false);
  const [availability, setAvailability] = useState({});
  const [gitBranch, setGitBranch] = useState('main');
  const popupRef = useRef(null);
  const notifRef = useRef(null);

  const messages  = useMemo(() => readJSON(STORAGE_KEY, []), [agentPopupOpen]);
  const usage     = useMemo(() => readJSON(USAGE_KEY, {}), [agentPopupOpen]);
  const agentId   = localStorage.getItem(AGENT_KEY) || 'auto';
  const agent     = getAgentById(agentId);
  const AgentIcon = AGENT_ICONS[agentId] || Bot;

  const totalMsgs = messages.filter(m => m.role === 'user').length;
  const todayStr  = new Date().toDateString();
  const todayMsgs = messages.filter(m => m.role === 'user' && new Date(m.id).toDateString() === todayStr).length;
  const agentCount = Object.keys(usage).length;
  const streak     = readJSON(STREAK_KEY, { count: 0 }).count || 0;

  // Check which CLI agents are installed on the connected machine
  useEffect(() => {
    if (workspaceOnline) {
      checkAgentAvailability().then(a => setAvailability(a || {}));
      // Fetch git branch from daemon
      const token = localStorage.getItem('soupz_daemon_token');
      if (token) {
        fetch('http://localhost:7533/api/changes', {
          headers: { 'X-Soupz-Token': token },
          signal: AbortSignal.timeout(3000),
        })
          .then(r => r.ok ? r.json() : null)
          .then(d => { if (d?.branch) setGitBranch(d.branch); })
          .catch(() => {});
      }
    }
  }, [workspaceOnline]);

  // Close popups on outside click
  useEffect(() => {
    function handleClick(e) {
      if (popupRef.current && !popupRef.current.contains(e.target)) setAgentPopupOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifPopupOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const isRemote = workspaceOnline;
  const barBg = 'bg-bg-surface border-t border-border-subtle';
  const textColor = 'text-text-faint';

  const { cursorPos, activeFile, lang, tabSize = 2 } = editorState || {};

  // Notification items
  const notifications = useMemo(() => {
    const items = [];
    if (!workspaceOnline) {
      items.push({ id: 'offline', type: 'warning', text: 'Workspace disconnected. Run npx soupz to connect.' });
    }
    return items;
  }, [workspaceOnline]);

  return (
    <div className={cn('h-[22px] flex items-center shrink-0 select-none z-20', barBg, textColor)}>
      {/* ── LEFT SIDE ────────────────────────────────────────────── */}
      <div className="flex items-center">
        {/* Connection status */}
        <StatusItem title={isRemote ? `Connected: ${machine || 'local'}` : 'Not connected to workspace'}>
          {isRemote ? (
            <>
              <Radio size={11} />
              <span className="hidden sm:inline">{machine || 'Connected'}</span>
            </>
          ) : (
            <>
              <WifiOff size={11} />
              <span className="hidden sm:inline">Offline</span>
            </>
          )}
        </StatusItem>

        {/* Git branch */}
        <StatusItem title="Source Control">
          <GitBranch size={11} />
          <span>{gitBranch}</span>
        </StatusItem>

        {/* Errors & Warnings */}
        <StatusItem title="No Problems">
          <AlertCircle size={10} />
          <span>0</span>
          <AlertTriangle size={10} />
          <span>0</span>
        </StatusItem>
      </div>

      {/* ── SPACER ───────────────────────────────────────────────── */}
      <div className="flex-1" />

      {/* ── RIGHT SIDE ───────────────────────────────────────────── */}
      <div className="flex items-center">
        {/* Editor-specific items (IDE mode + file open) */}
        {mode === 'pro' && activeFile && (
          <>
            <StatusItem title="Go to Line/Column">
              Ln {cursorPos?.line || 1}, Col {cursorPos?.col || 1}
            </StatusItem>
            <StatusItem title="Select Indentation">
              Spaces: {tabSize}
            </StatusItem>
            <StatusItem title="Select Encoding">UTF-8</StatusItem>
            <StatusItem title="Select End of Line Sequence">LF</StatusItem>
            <StatusItem title="Select Language Mode">
              <span className="capitalize">{(lang || 'plaintext').replace(/([A-Z])/g, ' $1').trim()}</span>
            </StatusItem>
          </>
        )}

        {/* Chat mode indicator */}
        {mode === 'simple' && (
          <StatusItem title="Chat Mode">
            <MessageSquare size={10} />
            <span className="hidden sm:inline">Chat</span>
          </StatusItem>
        )}

        {/* ── Agent status (like Copilot icon) ─────────────────── */}
        <div className="relative" ref={popupRef}>
          <StatusItem
            onClick={() => { setAgentPopupOpen(v => !v); setNotifPopupOpen(false); }}
            active={agentPopupOpen}
            title="Soupz Agent Status"
          >
            <AgentIcon size={11} />
            <span className="hidden sm:inline">{agent?.name || 'Auto'}</span>
            {isRemote && <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse ml-0.5" />}
          </StatusItem>

          {agentPopupOpen && (
            <AgentPopup
              agent={agent}
              agentId={agentId}
              totalMsgs={totalMsgs}
              todayMsgs={todayMsgs}
              agentCount={agentCount}
              streak={streak}
              usage={usage}
              availability={availability}
              workspaceOnline={workspaceOnline}
              onClose={() => setAgentPopupOpen(false)}
            />
          )}
        </div>

        {/* ── Notifications ────────────────────────────────────── */}
        <div className="relative" ref={notifRef}>
          <StatusItem
            onClick={() => { setNotifPopupOpen(v => !v); setAgentPopupOpen(false); }}
            active={notifPopupOpen}
            title="Notifications"
          >
            <Bell size={11} />
            {notifications.length > 0 && (
              <span className={cn(
                'w-1.5 h-1.5 rounded-full ml-0.5',
                'bg-warning',
              )} />
            )}
          </StatusItem>

          {notifPopupOpen && (
            <NotifPopup
              notifications={notifications}
              onClose={() => setNotifPopupOpen(false)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Agent Status Popup (like VS Code Copilot popup)
   ═══════════════════════════════════════════════════════════════════════════ */

function AgentPopup({
  agent, agentId, totalMsgs, todayMsgs, agentCount, streak,
  usage, availability, workspaceOnline, onClose,
}) {
  const AgentIcon = AGENT_ICONS[agentId] || Bot;
  const sortedUsage = Object.entries(usage)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  return (
    <div className="absolute bottom-full right-0 mb-1 w-72 bg-bg-elevated border border-border-mid rounded-lg shadow-soft overflow-hidden z-50">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-border-subtle flex items-center gap-2">
        <AgentIcon size={14} style={{ color: agent?.color || '#6366F1' }} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-ui font-medium text-text-pri">{agent?.name || 'Auto'} Agent</p>
          <p className="text-[10px] text-text-faint">
            {workspaceOnline ? 'Active' : 'No workspace connected'}
          </p>
        </div>
        <button onClick={onClose} className="text-text-faint hover:text-text-sec transition-colors">
          <X size={12} />
        </button>
      </div>

      {/* Session stats */}
      <div className="px-3 py-2.5 border-b border-border-subtle">
        <p className="text-[10px] text-text-faint font-ui uppercase tracking-wider mb-2">Session</p>
        <div className="grid grid-cols-2 gap-2">
          <StatBox icon={MessageSquare} label="Today" value={todayMsgs} color="text-accent" />
          <StatBox icon={MessageSquare} label="Total" value={totalMsgs} color="text-text-sec" />
          <StatBox icon={Bot} label="Agents Used" value={agentCount} color="text-success" />
          <StatBox icon={Flame} label="Streak" value={`${streak}d`} color="text-warning" />
        </div>
      </div>

      {/* Per-agent usage with estimated tokens */}
      {sortedUsage.length > 0 && (
        <div className="px-3 py-2.5 border-b border-border-subtle">
          <p className="text-[10px] text-text-faint font-ui uppercase tracking-wider mb-2">Agent Usage</p>
          <div className="space-y-2">
            {sortedUsage.map(([id, count]) => {
              const a = getAgentById(id);
              const Icon = AGENT_ICONS[id] || Bot;
              const maxCount = sortedUsage[0]?.[1] || 1;
              const pct = Math.round((count / maxCount) * 100);
              // Rough token estimate: ~800 tokens per message exchange (prompt + response)
              const estTokens = count * 800;
              const tokenStr = estTokens >= 1000 ? `~${(estTokens / 1000).toFixed(1)}k` : `~${estTokens}`;
              return (
                <div key={id}>
                  <div className="flex items-center gap-2 mb-0.5">
                    <Icon size={10} style={{ color: a?.color }} className="shrink-0" />
                    <span className="text-[11px] font-ui text-text-sec flex-1 min-w-0 truncate">
                      {a?.name || id}
                    </span>
                    <span className="text-[10px] font-mono text-text-faint">{count} msg</span>
                  </div>
                  <div className="flex items-center gap-2 pl-[18px]">
                    <div className="flex-1 h-1.5 bg-bg-overlay rounded-full overflow-hidden">
                      <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[9px] font-mono text-text-faint w-10 text-right">{tokenStr} tok</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Agent availability */}
      <div className="px-3 py-2.5">
        <p className="text-[10px] text-text-faint font-ui uppercase tracking-wider mb-2">Installed Agents</p>
        <div className="space-y-1">
          {CLI_AGENTS.map(a => {
            const Icon = AGENT_ICONS[a.id] || Bot;
            const installed = availability[a.id] || false;
            return (
              <div key={a.id} className="flex items-center gap-2">
                <Icon size={10} style={{ color: a.color }} className="shrink-0" />
                <span className="text-[11px] font-ui text-text-sec flex-1">{a.name}</span>
                <span className={cn(
                  'text-[10px] font-ui px-1.5 py-0.5 rounded',
                  a.tier === 'free' ? 'text-success bg-success/10' :
                  a.tier === 'freemium' ? 'text-warning bg-warning/10' :
                  'text-accent bg-accent/10',
                )}>
                  {a.tier}
                </span>
                {workspaceOnline ? (
                  installed ? (
                    <Check size={10} className="text-success shrink-0" />
                  ) : (
                    <X size={10} className="text-text-faint shrink-0" />
                  )
                ) : (
                  <span className="text-[10px] text-text-faint">--</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Free tier info */}
      <div className="px-3 py-2 border-t border-border-subtle bg-bg-surface">
        <p className="text-[10px] text-text-faint font-ui leading-relaxed">
          Gemini: unlimited free tier &middot; Copilot: ~2k/mo &middot; Ollama: unlimited local
        </p>
      </div>
    </div>
  );
}

function StatBox({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-bg-overlay rounded-md px-2 py-1.5 flex items-center gap-2">
      <Icon size={11} className={color} />
      <div>
        <p className="text-xs font-ui font-semibold text-text-pri leading-none">{value}</p>
        <p className="text-[9px] text-text-faint mt-0.5">{label}</p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Notifications Popup
   ═══════════════════════════════════════════════════════════════════════════ */

function NotifPopup({ notifications, onClose }) {
  return (
    <div className="absolute bottom-full right-0 mb-1 w-72 bg-bg-elevated border border-border-mid rounded-lg shadow-soft overflow-hidden z-50">
      <div className="px-3 py-2 border-b border-border-subtle flex items-center justify-between">
        <span className="text-xs font-ui font-medium text-text-pri">Notifications</span>
        <button onClick={onClose} className="text-text-faint hover:text-text-sec transition-colors">
          <X size={12} />
        </button>
      </div>
      <div className="max-h-48 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="px-3 py-4 text-center">
            <Bell size={16} className="text-text-faint mx-auto mb-1.5 opacity-30" />
            <p className="text-[11px] text-text-faint font-ui">No new notifications</p>
          </div>
        ) : (
          notifications.map(n => (
            <div key={n.id} className="px-3 py-2 border-b border-border-subtle last:border-0 flex items-start gap-2">
              {n.type === 'warning' ? (
                <AlertTriangle size={11} className="text-warning mt-0.5 shrink-0" />
              ) : (
                <Sparkles size={11} className="text-accent mt-0.5 shrink-0" />
              )}
              <p className="text-[11px] text-text-sec font-ui leading-relaxed">{n.text}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
