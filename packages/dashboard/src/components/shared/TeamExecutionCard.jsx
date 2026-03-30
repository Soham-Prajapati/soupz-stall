import { useState } from 'react';
import { Users, CheckCircle, XCircle, Loader2, Clock, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/cn';
import { getSubAgentById } from '../../lib/teams';

/**
 * Parse raw streaming team content into structured agent data.
 *
 * Content format (built by SimpleMode's executeTeam callback):
 *   \n### agent-id started...\n
 *   [agent chunks]
 *   \n---\n
 *   ...repeated per agent...
 *   \n### Synthesizing results...\n
 *   [coordinator chunks]
 */
function parseTeamContent(content) {
  const agents = [];
  let synthesis = '';
  let synthesisStarted = false;

  const src = content || '';
  // Split on the \n### marker that precedes each section header
  const sections = src.split(/\n### /);

  for (const section of sections) {
    if (!section.trim()) continue;

    if (section.startsWith('Synthesizing results...')) {
      synthesisStarted = true;
      const newlineIdx = section.indexOf('\n');
      synthesis = newlineIdx >= 0 ? section.slice(newlineIdx + 1).trim() : '';
      continue;
    }

    // Match "agent-id started...\n<body>"
    const agentMatch = section.match(/^([\w-]+) started\.\.\.\n?([\s\S]*)/);
    if (!agentMatch) continue;

    const id = agentMatch[1];
    const body = agentMatch[2] || '';

    // Agent is done when its body contains the \n---\n separator
    const doneIdx = body.indexOf('\n---\n');
    const isDone = doneIdx >= 0;
    const output = isDone ? body.slice(0, doneIdx).trim() : body.trim();
    const isFailed = output.startsWith('Error:') || output.startsWith('error:');

    agents.push({
      id,
      name: getSubAgentById(id)?.name || id,
      status: isFailed ? 'failed' : isDone ? 'done' : 'running',
      output,
    });
  }

  return { agents, synthesis, synthesisStarted };
}

const STATUS_CONFIG = {
  running: {
    Icon: Loader2,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    label: 'Running',
    spin: true,
  },
  done: {
    Icon: CheckCircle,
    color: 'text-green-400',
    bg: 'bg-green-500/10',
    border: 'border-green-500/20',
    label: 'Done',
    spin: false,
  },
  failed: {
    Icon: XCircle,
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    label: 'Failed',
    spin: false,
  },
  pending: {
    Icon: Clock,
    color: 'text-text-faint',
    bg: 'bg-white/5',
    border: 'border-border-subtle',
    label: 'Pending',
    spin: false,
  },
};

function AgentRow({ agent, expanded, onToggle }) {
  const config = STATUS_CONFIG[agent.status] || STATUS_CONFIG.pending;
  const { Icon } = config;

  return (
    <div className={cn('rounded-md border overflow-hidden', config.border)}>
      <button
        onClick={onToggle}
        className={cn(
          'w-full flex items-center gap-2 px-3 min-h-[44px] text-left transition-colors hover:bg-white/5',
          config.bg
        )}
      >
        <Icon size={13} className={cn(config.color, config.spin && 'animate-spin')} />
        <span className="flex-1 text-[12px] font-ui font-medium text-text-pri truncate">
          {agent.name}
        </span>
        <span className={cn(
          'shrink-0 text-[10px] font-ui px-1.5 py-0.5 rounded border',
          config.color,
          config.bg,
          config.border
        )}>
          {config.label}
        </span>
        {agent.output && (
          <span className="shrink-0 ml-1">
            {expanded
              ? <ChevronDown size={12} className="text-text-faint" />
              : <ChevronRight size={12} className="text-text-faint" />
            }
          </span>
        )}
      </button>
      {expanded && agent.output && (
        <div className="px-3 py-2.5 border-t border-border-subtle bg-bg-base text-[12px] text-text-sec font-ui leading-relaxed whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
          {agent.output}
        </div>
      )}
    </div>
  );
}

/**
 * TeamExecutionCard — renders a structured view of a running or completed team workflow.
 *
 * @param {string} content - raw streaming content from the team message
 * @param {boolean} streaming - whether the message is still streaming
 */
export default function TeamExecutionCard({ content, streaming }) {
  const [expanded, setExpanded] = useState({});
  const { agents, synthesis, synthesisStarted } = parseTeamContent(content);

  function toggleAgent(id) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  }

  const doneCount = agents.filter(a => a.status === 'done' || a.status === 'failed').length;
  const totalCount = agents.length;
  const progress = totalCount > 0 ? doneCount / totalCount : 0;

  // Empty state — nothing has streamed yet
  if (!content || (!agents.length && !synthesisStarted)) {
    return (
      <div className="flex items-center gap-2 py-2">
        <Loader2 size={14} className="animate-spin text-accent" />
        <span className="text-[12px] text-text-faint font-ui">Assembling team...</span>
      </div>
    );
  }

  return (
    <div className="space-y-3 py-1">
      {/* Progress bar */}
      {totalCount > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Users size={12} className="text-text-faint" />
              <span className="text-[11px] text-text-faint font-ui">
                {doneCount}/{totalCount} agents complete
              </span>
            </div>
            {streaming && <Loader2 size={11} className="animate-spin text-accent" />}
          </div>
          <div className="h-1 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full rounded-full bg-accent transition-all duration-500"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Agent rows */}
      <div className="space-y-1.5">
        {agents.map((agent) => (
          <AgentRow
            key={agent.id}
            agent={agent}
            expanded={!!expanded[agent.id]}
            onToggle={() => toggleAgent(agent.id)}
          />
        ))}
      </div>

      {/* Synthesis section */}
      {synthesisStarted && (
        <div className="rounded-md border border-accent/20 bg-accent/5 overflow-hidden">
          <div className="px-3 py-2 flex items-center justify-between border-b border-accent/10">
            <span className="text-[11px] font-semibold text-accent uppercase tracking-wider font-ui">
              Synthesis
            </span>
            {streaming && !synthesis && (
              <Loader2 size={11} className="animate-spin text-accent" />
            )}
          </div>
          {synthesis ? (
            <div className="px-3 py-2.5 text-[12px] text-text-sec font-ui leading-relaxed whitespace-pre-wrap break-words">
              {synthesis}
            </div>
          ) : streaming ? (
            <div className="px-3 py-2.5 flex items-center gap-1">
              <span className="thinking-dot" />
              <span className="thinking-dot animate-delay-100" />
              <span className="thinking-dot animate-delay-200" />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
