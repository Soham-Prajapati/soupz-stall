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

const DURATION_MAP = {
  queued: 'Queued',
  running: 'Running',
  completed: 'Done',
  failed: 'Failed',
};

const STATUS_COLORS = {
  queued: { bg: 'bg-yellow-500/10', text: 'text-yellow-600', label: 'Queued' },
  running: { bg: 'bg-blue-500/10', text: 'text-blue-600', label: 'Running' },
  completed: { bg: 'bg-green-500/10', text: 'text-green-600', label: 'Done' },
  failed: { bg: 'bg-red-500/10', text: 'text-red-600', label: 'Failed' },
};

export default function AgentDashboard({ daemon }) {
  const [agentStatus, setAgentStatus] = useState({});
  const [orders, setOrders] = useState([]);
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
      const status = await checkAgentAvailability();
      setAgentStatus(status);
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
            {Object.values(agentStatus).filter(v => v).length}/{CLI_AGENTS.length}
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
            CLI_AGENTS.map(agent => {
              const installed = agentStatus[agent.id];
              const Icon = agent.icon;
              return (
                <button
                  key={agent.id}
                  onClick={() => {
                    // Dispatch event to open stats and highlight agent
                    window.dispatchEvent(new CustomEvent('soupz_show_agent_stats', { detail: { agentId: agent.id } }));
                  }}
                  className="w-full flex items-center gap-3 p-2 rounded-md bg-bg-elevated/50 border border-border-subtle hover:border-border-mid transition-all text-left"
                >
                  <Icon size={16} style={{ color: agent.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-ui font-medium text-text-pri">{agent.name}</p>
                    <p className="text-[10px] text-text-faint">{agent.tier}</p>
                  </div>
                  {installed ? (
                    <CheckCircle2 size={14} className="text-success shrink-0" />
                  ) : (
                    <XCircle size={14} className="text-error shrink-0" />
                  )}
                </button>
              );
            })
          )}
        </div>
      )}

      {/* Section 2: Recent Tasks */}
      <button
        onClick={() => setTasksCollapsed(v => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-bg-elevated transition-colors border-t border-border-subtle"
      >
        <div className="flex items-center gap-2">
          <Clock size={13} className="text-info" />
          <span className="text-xs font-ui font-medium text-text-sec">Recent Tasks</span>
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
          {orders.length === 0 ? (
            <p className="text-[11px] text-text-faint font-ui py-2">No tasks yet</p>
          ) : (
            orders.map(order => {
              const statusInfo = STATUS_COLORS[order.status] || STATUS_COLORS.queued;
              const isExpanded = expandedOrder === order.id;
              return (
                <div key={order.id} className="rounded-md border border-border-subtle overflow-hidden">
                  <button
                    onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
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
