import { useState, useEffect } from 'react';
import {
  CheckCircle2, XCircle, Zap, Clock, AlertCircle,
  PlayCircle, ChevronDown, ChevronUp, Loader2,
} from 'lucide-react';
import { cn } from '../../lib/cn';
import { CLI_AGENTS } from '../../lib/agents.js';
import { AGENT_TEAMS } from '../../lib/teams.js';
import {
  checkAgentAvailability,
  getOrders,
  getOrderDetail,
} from '../../lib/daemon.js';

const STATUS_COLORS = {
  queued: { bg: 'bg-yellow-500/10', text: 'text-yellow-600', label: 'Queued' },
  running: { bg: 'bg-blue-500/10', text: 'text-blue-600', label: 'Running' },
  completed: { bg: 'bg-green-500/10', text: 'text-green-600', label: 'Done' },
  failed: { bg: 'bg-red-500/10', text: 'text-red-600', label: 'Failed' },
};

const REASON_LABELS = {
  not_installed: 'CLI not installed',
  missing_cli: 'CLI not installed',
  auth_required: 'Sign-in required',
  login_required: 'Sign-in required',
  setup_required: 'Setup required',
  config_missing: 'Configuration missing',
  unavailable: 'Unavailable',
};

function normalizeAgentStatus(raw = {}) {
  const normalized = {};
  for (const [id, value] of Object.entries(raw || {})) {
    if (typeof value === 'boolean') {
      normalized[id] = {
        installed: value,
        ready: value,
        reason: value ? '' : 'unavailable',
        hint: '',
      };
      continue;
    }

    const installed = typeof value?.installed === 'boolean'
      ? value.installed
      : Boolean(value?.ready);
    const ready = typeof value?.ready === 'boolean'
      ? value.ready
      : Boolean(value?.installed);

    normalized[id] = {
      installed,
      ready,
      reason: value?.reason || '',
      hint: value?.hint || '',
      source: value?.source || '',
    };
  }
  return normalized;
}

function formatReason(reason = '') {
  if (!reason) return '';
  if (REASON_LABELS[reason]) return REASON_LABELS[reason];
  return reason.replace(/[_-]+/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

export default function AgentDashboard({ daemon }) {
  const [agentStatus, setAgentStatus] = useState({});
  const [orders, setOrders] = useState([]);
  const [orderDetails, setOrderDetails] = useState({});
  const [orderDetailsLoading, setOrderDetailsLoading] = useState(null);
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [agentsCollapsed, setAgentsCollapsed] = useState(false);
  const [tasksCollapsed, setTasksCollapsed] = useState(false);
  const [teamsCollapsed, setTeamsCollapsed] = useState(false);
  const [skillsCollapsed, setSkillsCollapsed] = useState(false);
  const [skills, setSkills] = useState([]);

  // Fetch agent availability & load skills
  useEffect(() => {
    async function checkAgents() {
      const info = await checkAgentAvailability();
      const detailed = info?.detailed || info?.simple || {};
      const hasSignals = Object.keys(detailed || {}).length > 0;
      if (hasSignals) {
        setAgentStatus(normalizeAgentStatus(detailed));
      }
      setLoading(false);
    }

    async function loadSkills() {
      try {
        const module = await import('../../lib/skills.js');
        if (module?.SKILLS) setSkills(module.SKILLS);
      } catch {
        setSkills([]);
      }
    }

    checkAgents();
    loadSkills();
    const interval = setInterval(checkAgents, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  // Fetch orders
  useEffect(() => {
    async function fetchOrders() {
      const data = await getOrders();
      setOrders(data.slice(0, 10)); // Last 10 orders
    }
    fetchOrders();
    const interval = setInterval(fetchOrders, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, []);

  async function toggleExpandedOrder(orderId) {
    const nextExpanded = expandedOrder === orderId ? null : orderId;
    setExpandedOrder(nextExpanded);
    if (!nextExpanded || orderDetails[nextExpanded]) return;

    setOrderDetailsLoading(nextExpanded);
    try {
      const detail = await getOrderDetail(nextExpanded);
      if (detail) {
        setOrderDetails((prev) => ({ ...prev, [nextExpanded]: detail }));
      }
    } finally {
      setOrderDetailsLoading(null);
    }
  }

  async function handleTeamRun(teamId) {
    const team = AGENT_TEAMS.find(t => t.id === teamId);
    if (!team) return;
    try {
      await daemon.sendPrompt({
        prompt: `Execute team workflow: ${team.name}`,
        agentId: 'auto',
        buildMode: 'planned'
      });
    } catch (err) {
      console.error('Failed to run team:', err);
    }
  }

  function truncatePrompt(prompt, maxChars = 60) {
    if (!prompt || prompt.length <= maxChars) return prompt;
    return prompt.slice(0, maxChars) + '...';
  }

  function formatDuration(ms) {
    if (!ms) return '-';
    const secs = Math.floor(ms / 1000);
    if (secs < 60) return `${secs}s`;
    const mins = Math.floor(secs / 60);
    return `${mins}m`;
  }

  return (
    <div className="h-full overflow-y-auto border-t border-border-subtle space-y-0 pb-12">
      {/* Section 1: Agent Status */}
      <button
        onClick={() => setAgentsCollapsed(v => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-bg-elevated transition-colors"
      >
        <div className="flex items-center gap-2">
          <Zap size={13} className="text-accent" />
          <span className="text-xs font-ui font-medium text-text-sec">Agent Status</span>
          <span className="text-[10px] bg-accent/10 text-accent px-1.5 py-0.5 rounded font-mono">
            {Object.values(agentStatus).filter(v => v?.ready).length}/{CLI_AGENTS.length}
          </span>
        </div>
        {agentsCollapsed
          ? <ChevronDown size={12} className="text-text-faint" />
          : <ChevronUp size={12} className="text-text-faint" />
        }
      </button>

      {!agentsCollapsed && (
        <div className="px-4 pb-3 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-3">
              <Loader2 size={14} className="text-text-faint animate-spin" />
            </div>
          ) : (
            CLI_AGENTS.map(agent => (
              <AgentRow key={agent.id} agent={agent} status={agentStatus[agent.id]} />
            ))
          )}
        </div>
      )}

      {/* Section 2: Recent Runs */}
      <button
        onClick={() => setTasksCollapsed(v => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-bg-elevated transition-colors border-t border-border-subtle"
      >
        <div className="flex items-center gap-2">
          <Clock size={13} className="text-info" />
          <span className="text-xs font-ui font-medium text-text-sec">Recent Runs</span>
          {orders.length > 0 && (
            <span className="text-[10px] bg-info/10 text-info px-1.5 py-0.5 rounded font-mono">
              {orders.length}
            </span>
          )}
        </div>
        {tasksCollapsed
          ? <ChevronDown size={12} className="text-text-faint" />
          : <ChevronUp size={12} className="text-text-faint" />
        }
      </button>

      {!tasksCollapsed && (
        <div className="px-4 pb-3 space-y-2">
          <p className="text-[10px] text-text-faint">Snapshot of latest orders, not a live process list.</p>
          {orders.length === 0 ? (
            <p className="text-[11px] text-text-faint font-ui py-2">No runs yet</p>
          ) : (
            orders.map(order => {
              const statusInfo = STATUS_COLORS[order.status] || STATUS_COLORS.queued;
              const isExpanded = expandedOrder === order.id;
              const orderDetail = orderDetails[order.id];
              return (
                <div key={order.id} className="rounded-md border border-border-subtle overflow-hidden">
                  <button
                    onClick={() => toggleExpandedOrder(order.id)}
                    className="w-full flex items-center gap-2 p-2 bg-bg-elevated/50 hover:bg-bg-elevated transition-colors"
                  >
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: order.status === 'completed' ? '#22C55E' : order.status === 'failed' ? '#EF4444' : order.status === 'running' ? '#3B82F6' : '#FBBF24' }} />
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-xs font-mono text-text-pri truncate">
                        {truncatePrompt(order.prompt)}
                      </p>
                      <p className="text-[9px] text-text-faint flex items-center gap-1.5 mt-0.5">
                        <span>{formatDuration(order.duration)} • {order.agent || 'unknown'}</span>
                        {order.isFleet && <span className="px-1 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30 text-[8px] font-bold leading-none py-0.5">FLEET</span>}
                      </p>
                    </div>
                    <span className={cn('text-[9px] font-ui font-medium px-1.5 py-0.5 rounded', statusInfo.bg, statusInfo.text)}>
                      {statusInfo.label}
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="px-3 py-2 bg-bg-base text-[10px] text-text-sec border-t border-border-subtle space-y-1">
                      <p><strong>ID:</strong> {order.id}</p>
                      <p><strong>Prompt:</strong> {order.prompt}</p>
                      <p><strong>Agent:</strong> {order.agent}</p>
                      <p><strong>Status:</strong> {order.status}</p>
                      {orderDetailsLoading === order.id && (
                        <div className="flex items-center gap-1 text-text-faint">
                          <Loader2 size={10} className="animate-spin" />
                          Loading order details...
                        </div>
                      )}
                      {orderDetail && (
                        <>
                          <p><strong>Events:</strong> {Array.isArray(orderDetail.events) ? orderDetail.events.length : 0}</p>
                          {Array.isArray(orderDetail.events) && orderDetail.events.length > 0 && (
                            <p><strong>Last Event:</strong> {orderDetail.events[orderDetail.events.length - 1]?.type || 'unknown'}</p>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Section 3: Team Workflows */}
      <button
        onClick={() => setTeamsCollapsed(v => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-bg-elevated transition-colors border-t border-border-subtle"
      >
        <div className="flex items-center gap-2">
          <PlayCircle size={13} className="text-success" />
          <span className="text-xs font-ui font-medium text-text-sec">Team Workflows</span>
        </div>
        {teamsCollapsed
          ? <ChevronDown size={12} className="text-text-faint" />
          : <ChevronUp size={12} className="text-text-faint" />
        }
      </button>

      {!teamsCollapsed && (
        <div className="px-4 pb-3 space-y-2">
          {AGENT_TEAMS.map(team => (
            <div
              key={team.id}
              className="p-3 rounded-md border border-border-subtle bg-bg-elevated/30"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-ui font-medium text-text-pri">{team.name}</p>
                  <p className="text-[10px] text-text-faint line-clamp-2">{team.description}</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-text-faint font-mono">
                  {team.members.length} agents
                </span>
                <button
                  onClick={() => handleTeamRun(team.id)}
                  className="text-[10px] px-2 py-1 rounded border border-accent/30 text-accent hover:bg-accent/10 transition-colors font-ui font-medium"
                >
                  Run
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Section 4: Active Skills */}
      {skills.length > 0 && (
        <>
          <button
            onClick={() => setSkillsCollapsed(v => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-bg-elevated transition-colors border-t border-border-subtle"
          >
            <div className="flex items-center gap-2">
              <AlertCircle size={13} className="text-warning" />
              <span className="text-xs font-ui font-medium text-text-sec">Active Skills</span>
              <span className="text-[10px] bg-warning/10 text-warning px-1.5 py-0.5 rounded font-mono">
                {skills.length}
              </span>
            </div>
            {skillsCollapsed
              ? <ChevronDown size={12} className="text-text-faint" />
              : <ChevronUp size={12} className="text-text-faint" />
            }
          </button>

          {!skillsCollapsed && (
            <div className="px-4 pb-3">
              <div className="flex flex-wrap gap-1.5">
                {skills.map(skill => (
                  <button
                    key={skill.id}
                    className="text-[10px] px-2 py-1 rounded-full border border-warning/30 text-warning bg-warning/5 hover:bg-warning/10 transition-colors font-ui"
                    title={skill.description || skill.name}
                  >
                    {skill.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function AgentRow({ agent, status }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const Icon = agent.icon;
  const installed = status?.installed !== false;
  const ready = !!status?.ready;
  const reason = !ready ? formatReason(status?.reason) : '';
  const hint = !ready ? status?.hint : '';

  const indicator = ready
    ? { label: 'Ready', className: 'text-success', icon: CheckCircle2 }
    : installed
      ? { label: 'Setup', className: 'text-amber-400', icon: AlertCircle }
      : { label: 'Missing', className: 'text-error', icon: XCircle };
  const StatusIcon = indicator.icon;

  return (
    <div className="space-y-1">
      <button
        onClick={() => {
          if (agent.models) setIsExpanded(!isExpanded);
          window.dispatchEvent(new CustomEvent('soupz_show_agent_stats', { detail: { agentId: agent.id } }));
        }}
        className="w-full flex items-center gap-3 p-2 rounded-md bg-bg-elevated/50 border border-border-subtle hover:border-border-mid transition-all text-left group"
      >
        <Icon size={16} style={{ color: agent.color }} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-ui font-medium text-text-pri">{agent.name}</p>
          <p className="text-[10px] text-text-faint">
            {agent.tier}
            {!ready && reason ? ` • ${reason}` : ''}
          </p>
          {!ready && hint ? (
            <p className="text-[10px] text-text-faint mt-0.5 line-clamp-2">{hint}</p>
          ) : null}
        </div>
        {agent.models && (
          <ChevronDown size={12} className={cn("text-text-faint transition-transform", isExpanded && "rotate-180")} />
        )}
        <div className={cn('flex items-center gap-1 shrink-0 text-[9px] uppercase font-mono', indicator.className)}>
          <StatusIcon size={12} />
          <span>{indicator.label}</span>
        </div>
      </button>

      {isExpanded && agent.models && (
        <div className="ml-4 pl-4 border-l border-border-subtle space-y-2 py-1 animate-fade-in">
          {agent.models.map(model => (
            <div key={model.id} className="flex items-center justify-between text-[10px] rounded border border-border-subtle bg-bg-elevated/40 px-2 py-1">
              <span className="text-text-sec font-mono">{model.name}</span>
              <span className="text-text-faint">
                {model.usage !== undefined ? `usage ${model.usage}%` : 'ready'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
