import { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Loader2, RefreshCw, Send, Trash2 } from 'lucide-react';

const CORE_AGENTS = [
  { id: 'auto', label: 'Auto (Smart Route)' },
  { id: 'gemini', label: 'Gemini' },
  { id: 'copilot', label: 'Copilot' },
  { id: 'ollama', label: 'Ollama' },
  { id: 'claude-code', label: 'Claude Code' },
  { id: 'kiro', label: 'Kiro' },
];

const TESTING_CWD = '/Users/shubh/Developer/ai-testing';
const ACTIVE_ORDER_SESSION_KEY = 'soupz.core.activeOrderId';

const BENCHMARK_PROMPT = [
  'Build a complete mini project inside /Users/shubh/Developer/ai-testing/multi-agent-benchmark.',
  'Create these files with production-quality content: README.md, index.html, style.css, app.js, and run-report.md.',
  'Project spec: responsive task board app (add, edit, delete, filter, localStorage persistence, keyboard accessibility).',
  'Include a clear architecture section in README and a testing checklist in run-report.md.',
  'Do not use placeholders; provide fully working code in all files.',
  'At the end, print a short summary of created files and what each file does.',
].join(' ');

const DEEP_STRESS_PROMPT = [
  'Create a production-grade mini product inside /Users/shubh/Developer/ai-testing/deep-stress-suite.',
  'Build 3 artifacts: (1) a full web app (index.html, style.css, app.js), (2) a concise architecture doc (ARCHITECTURE.md), and (3) a QA + risk report (QA-RISKS.md).',
  'Web app spec: kanban + note board hybrid with add/edit/delete, drag-and-drop between columns, filters, search, localStorage persistence, and keyboard accessibility.',
  'Architecture doc must include data model, component boundaries, and tradeoff decisions.',
  'QA report must include edge cases, failure modes, and a manual test checklist with at least 12 checks.',
  'Write concrete file contents only. No placeholders, no TODOs, no pseudo-code.',
  'End with a short execution summary listing each file and what was implemented.',
].join(' ');

const DEEP_COMPLEX_PROMPT = [
  'Create an advanced production mini product inside /Users/shubh/Developer/ai-testing/parallel-systems-lab.',
  'Deliver artifacts: index.html, style.css, app.js, ARCHITECTURE.md, TEST_PLAN.md, and PERFORMANCE_NOTES.md.',
  'Feature spec: multi-column planning workspace with drag-drop, inline editing, markdown notes, advanced filtering, undo/redo, and localStorage persistence with migration versioning.',
  'Include keyboard-first accessibility, optimistic UI updates, graceful empty/error states, and a clear in-app activity log.',
  'ARCHITECTURE.md must include module boundaries, state design, and tradeoff decisions.',
  'TEST_PLAN.md must include at least 20 manual checks across functionality, accessibility, and edge cases.',
  'PERFORMANCE_NOTES.md must include bottleneck analysis and at least 5 concrete optimization decisions.',
  'UI quality constraints: cards must never clip behind action bars while hovering, and drag interaction must not rotate cards unless explicitly requested.',
  'Use predictable stacking contexts and overflow behavior so hover elevations are visually stable.',
  'No placeholders, no TODOs, no pseudo-code. End with a concise completion summary listing each file and what was implemented.',
].join(' ');

export default function CoreConsole({ workspace }) {
  const [agentId, setAgentId] = useState('auto');
  const [buildMode, setBuildMode] = useState('quick');
  const [cwd, setCwd] = useState(TESTING_CWD);
  const [prompt, setPrompt] = useState('');
  const [output, setOutput] = useState('');
  const [running, setRunning] = useState(false);
  const [lastOrderId, setLastOrderId] = useState(null);
  const [orderStatus, setOrderStatus] = useState('idle');
  const [orderEventCount, setOrderEventCount] = useState(0);
  const [workerStatus, setWorkerStatus] = useState({});
  const [synthesisStatus, setSynthesisStatus] = useState({ started: false, finished: false, exitCode: null });
  const [primaryRole, setPrimaryRole] = useState('');
  const [specialistsPlanned, setSpecialistsPlanned] = useState([]);
  const [roleMap, setRoleMap] = useState({});
  const [orderError, setOrderError] = useState('');
  const [agentLanes, setAgentLanes] = useState({});
  const [terminals, setTerminals] = useState([]);
  const [termLoading, setTermLoading] = useState(false);
  const [termError, setTermError] = useState('');
  const [killingId, setKillingId] = useState(null);
  const outputRef = useRef(null);
  const completionMarkedRef = useRef(false);
  const knownWorkersRef = useRef([]);
  const online = !!workspace?.online;

  const laneOrder = useMemo(() => {
    const keys = Object.keys(agentLanes || {});
    const workerFirst = keys.filter((k) => k !== 'synthesis').sort();
    return keys.includes('synthesis') ? [...workerFirst, 'synthesis'] : workerFirst;
  }, [agentLanes]);

  const orderActive = useMemo(
    () => !!lastOrderId && (orderStatus === 'queued' || orderStatus === 'running'),
    [lastOrderId, orderStatus],
  );

  const canRun = useMemo(() => !!prompt.trim() && !running && !orderActive && online, [prompt, running, orderActive, online]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const persisted = window.sessionStorage.getItem(ACTIVE_ORDER_SESSION_KEY);
    if (!persisted) return;
    setLastOrderId((prev) => prev || persisted);
    setOrderStatus('running');
    setRunning(true);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (lastOrderId && (orderStatus === 'queued' || orderStatus === 'running')) {
      window.sessionStorage.setItem(ACTIVE_ORDER_SESSION_KEY, lastOrderId);
      return;
    }
    if (!lastOrderId || orderStatus === 'completed' || orderStatus === 'failed' || orderStatus === 'cancelled') {
      window.sessionStorage.removeItem(ACTIVE_ORDER_SESSION_KEY);
    }
  }, [lastOrderId, orderStatus]);

  const laneMeta = useMemo(() => {
    const meta = {};
    for (const [agent, info] of Object.entries(workerStatus || {})) {
      meta[agent] = {
        state: info.state,
        exitCode: info.exitCode,
        label: info.label || '',
        specialist: info.specialist || '',
        focus: info.focus || '',
        agent: info.agent || agent,
        role: info.role || roleMap[agent] || '',
      };
    }
    if (synthesisStatus.started || synthesisStatus.finished) {
      meta.synthesis = {
        state: synthesisStatus.finished
          ? ((synthesisStatus.exitCode ?? 1) === 0 ? 'completed' : 'failed')
          : 'running',
        exitCode: synthesisStatus.finished ? (synthesisStatus.exitCode ?? 1) : null,
        role: 'lead-synthesizer',
      };
    }
    return meta;
  }, [workerStatus, synthesisStatus, roleMap]);

  async function handleRun() {
    const text = prompt.trim();
    if (!text || !workspace?.sendPrompt || running) return;

    setRunning(true);
    setOutput('');
    setLastOrderId(null);
    setOrderStatus('queued');
    setOrderEventCount(0);
    setWorkerStatus({});
    setSynthesisStatus({ started: false, finished: false, exitCode: null });
    setPrimaryRole('');
    setSpecialistsPlanned([]);
    setRoleMap({});
    setOrderError('');
    setAgentLanes({});
    knownWorkersRef.current = [];
    completionMarkedRef.current = false;

    try {
      const orderId = await workspace.sendPrompt(
        {
          prompt: text,
          agentId,
          buildMode,
          cwd,
          orchestrationMode: buildMode === 'deep' ? 'parallel' : 'single',
        },
        (chunk) => {
          setOutput((prev) => prev + chunk);
        },
      );
      setLastOrderId(orderId || null);
    } catch (err) {
      setOutput(`Error: ${err.message}`);
      setOrderStatus('failed');
      setOrderError(err?.message || 'Unknown error');
      setRunning(false);
    } finally {
      // Keep running state owned by order status polling.
    }
  }

  useEffect(() => {
    if (!outputRef.current) return;
    outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [output]);

  useEffect(() => {
    if (!workspace?.getOrderDetail || !lastOrderId) return;

    let cancelled = false;
    const parseOrder = (detail) => {
      if (!detail || cancelled) return;

      const events = Array.isArray(detail.events) ? detail.events : [];
      setOrderStatus(detail.status || 'unknown');
      setOrderEventCount(events.length);
      setRunning(detail.status === 'queued' || detail.status === 'running');
      const selected = events.find((e) => e.type === 'route.selected');
      setPrimaryRole(selected?.primaryRole || '');
      setSpecialistsPlanned(Array.isArray(selected?.specialistsPlanned) ? selected.specialistsPlanned : []);

      const nextWorkers = {};
      const nextRoles = {};
      for (const ev of events) {
        const workerKey = ev.workerId || ev.agent;
        if (ev.type === 'worker.started' && workerKey) {
          if (ev.role) nextRoles[workerKey] = ev.role;
          nextWorkers[workerKey] = {
            state: 'running',
            exitCode: null,
            role: ev.role || nextRoles[workerKey] || '',
            label: ev.workerLabel || workerKey,
            specialist: ev.specialist || '',
            focus: ev.focus || '',
            agent: ev.agent || workerKey,
          };
        }
        if (ev.type === 'worker.finished' && workerKey) {
          if (ev.role) nextRoles[workerKey] = ev.role;
          nextWorkers[workerKey] = {
            state: (ev.exitCode ?? 1) === 0 ? 'completed' : 'failed',
            exitCode: ev.exitCode ?? 1,
            role: ev.role || nextRoles[workerKey] || '',
            label: ev.workerLabel || workerKey,
            specialist: ev.specialist || '',
            focus: ev.focus || '',
            agent: ev.agent || workerKey,
          };
        }
      }
      setWorkerStatus(nextWorkers);
      setRoleMap(nextRoles);
      knownWorkersRef.current = Object.keys(nextWorkers);

      const synthesisStarted = events.some((e) => e.type === 'synthesis.started');
      const synthesisFinishedEv = events.find((e) => e.type === 'synthesis.finished');
      setSynthesisStatus({
        started: synthesisStarted,
        finished: !!synthesisFinishedEv,
        exitCode: synthesisFinishedEv?.exitCode ?? null,
      });

      if ((detail.status === 'completed' || detail.status === 'failed' || detail.status === 'cancelled') && !completionMarkedRef.current) {
        completionMarkedRef.current = true;
        const finalLine = detail.status === 'completed'
          ? `\n\n[core] Prompt completed successfully. exitCode=${detail.exitCode ?? 0}`
          : detail.status === 'cancelled'
            ? `\n\n[core] Prompt cancelled. exitCode=${detail.exitCode ?? 130}`
            : `\n\n[core] Prompt failed. exitCode=${detail.exitCode ?? 'unknown'}`;
        setOutput((prev) => prev + finalLine);
        setOrderError(detail.status === 'failed' ? ((detail.stderr || '').slice(-400) || 'Execution failed') : '');
      }

      const hasLaneBuffers = detail?.laneBuffers && typeof detail.laneBuffers === 'object';
      if (typeof detail.stdout === 'string' || hasLaneBuffers) {
        const laneSnapshot = {};
        for (const worker of Object.keys(nextWorkers)) laneSnapshot[worker] = '';
        if (synthesisStarted || synthesisFinishedEv) laneSnapshot.synthesis = '';
        if (hasLaneBuffers) {
          for (const [laneId, laneText] of Object.entries(detail.laneBuffers || {})) {
            laneSnapshot[laneId] = typeof laneText === 'string' ? laneText : '';
          }
        }
        const lines = String(detail.stdout).split('\n');
        for (const line of lines) {
          const synth = line.match(/^\[synthesis:([^\]]+)\]\s?(.*)$/i);
          if (synth) {
            laneSnapshot.synthesis = (laneSnapshot.synthesis || '') + `${synth[2]}\n`;
            continue;
          }
          const workerV2 = line.match(/^\[worker:([^|\]]+)\|agent:([^\]]+)\]\s?(.*)$/i);
          if (workerV2) {
            laneSnapshot[workerV2[1]] = (laneSnapshot[workerV2[1]] || '') + `${workerV2[3]}\n`;
            continue;
          }
          const worker = line.match(/^\[([a-z0-9-]+)\]\s?(.*)$/i);
          if (worker) {
            const lane = worker[1];
            laneSnapshot[lane] = (laneSnapshot[lane] || '') + `${worker[2]}\n`;
          }
        }
        const stderrLines = String(detail.stderr || '').split('\n');
        for (const line of stderrLines) {
          const workerErr = line.match(/^\[worker:([^|\]]+)\|agent:([^:\]]+):stderr\]\s?(.*)$/i);
          if (workerErr) {
            laneSnapshot[workerErr[1]] = (laneSnapshot[workerErr[1]] || '') + `[stderr] ${workerErr[3]}\n`;
          }
        }
        setAgentLanes(laneSnapshot);
      }

      if (detail.status === 'completed' || detail.status === 'failed' || detail.status === 'cancelled') {
        setRunning(false);
      }
    };

    const tick = async () => {
      try {
        const detail = await workspace.getOrderDetail(lastOrderId);
        parseOrder(detail);
      } catch {
        // Ignore polling errors; UI keeps last known state.
      }
    };

    tick();
    const interval = setInterval(tick, 1500);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [workspace, lastOrderId]);

  async function refreshTerminals() {
    if (!workspace?.listTerminals || !online) return;
    setTermLoading(true);
    setTermError('');
    try {
      const list = await workspace.listTerminals();
      const normalized = Array.isArray(list) ? list : [];
      setTerminals(normalized.sort((a, b) => (b.ageSec || 0) - (a.ageSec || 0)));
    } catch (err) {
      setTermError(err?.message || 'Failed to fetch terminals');
    } finally {
      setTermLoading(false);
    }
  }

  async function killTerminal(id) {
    if (!workspace?.killTerminal) return;
    setKillingId(id);
    setTermError('');
    try {
      await workspace.killTerminal(id);
      await refreshTerminals();
    } catch (err) {
      setTermError(err?.message || `Failed to kill terminal ${id}`);
    } finally {
      setKillingId(null);
    }
  }

  useEffect(() => {
    if (!online) return;
    refreshTerminals();
    const interval = setInterval(() => {
      refreshTerminals();
    }, 8000);
    return () => clearInterval(interval);
  }, [online]);

  return (
    <div className="min-h-screen bg-bg-base text-text-pri p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-accent/15 border border-accent/30 flex items-center justify-center">
            <Bot size={16} className="text-accent" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-ui font-semibold">Soupz Core Console</h1>
            <p className="text-xs text-text-faint">
              Minimal mode for core orchestration demo: prompt in, routed agent out.
            </p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-xs text-text-sec">
            Agent
            <select
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              className="mt-1 w-full bg-bg-surface border border-border-subtle rounded-md px-2 py-2 text-sm"
            >
              {CORE_AGENTS.map((a) => (
                <option key={a.id} value={a.id}>{a.label}</option>
              ))}
            </select>
          </label>

          <label className="text-xs text-text-sec">
            Build Mode
            <select
              value={buildMode}
              onChange={(e) => setBuildMode(e.target.value)}
              className="mt-1 w-full bg-bg-surface border border-border-subtle rounded-md px-2 py-2 text-sm"
            >
              <option value="quick">quick (single fastest)</option>
              <option value="balanced">balanced (single + better routing)</option>
              <option value="deep">deep (parallel workers + synthesis)</option>
            </select>
          </label>
        </div>

        <label className="block text-xs text-text-sec">
          Working Directory
          <input
            value={cwd}
            onChange={(e) => setCwd(e.target.value)}
            className="mt-1 w-full bg-bg-surface border border-border-subtle rounded-md px-3 py-2 text-sm focus:outline-none focus:border-accent"
            placeholder="/absolute/path"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              setCwd(TESTING_CWD);
              setPrompt(BENCHMARK_PROMPT);
            }}
            className="px-2 py-1 rounded-md text-xs bg-bg-elevated border border-border-subtle text-text-sec hover:text-text-pri"
          >
            Use AI-Testing Benchmark Prompt
          </button>
          <button
            onClick={() => {
              setCwd(TESTING_CWD);
              setBuildMode('deep');
              setPrompt(DEEP_STRESS_PROMPT);
            }}
            className="px-2 py-1 rounded-md text-xs bg-bg-elevated border border-border-subtle text-text-sec hover:text-text-pri"
          >
            Use Deep Multi-Agent Stress Prompt
          </button>
          <button
            onClick={() => {
              setCwd(TESTING_CWD);
              setBuildMode('deep');
              setPrompt(DEEP_COMPLEX_PROMPT);
            }}
            className="px-2 py-1 rounded-md text-xs bg-bg-elevated border border-border-subtle text-text-sec hover:text-text-pri"
          >
            Use Advanced Parallel Systems Prompt
          </button>
          <div className="w-full text-[11px] text-text-faint">
            UI guardrails: no overlapping hover layers, no decorative drag rotation, stable z-index and clipping behavior.
          </div>
        </div>

        <label className="block text-xs text-text-sec">
          Prompt
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe what you want to build..."
            rows={6}
            className="mt-1 w-full bg-bg-surface border border-border-subtle rounded-md px-3 py-2 text-sm focus:outline-none focus:border-accent"
          />
        </label>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRun}
            disabled={!canRun}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-accent text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {running ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {running ? 'Running...' : 'Run Prompt'}
          </button>

          <div className="text-xs text-text-faint">
            {online ? 'Daemon online' : 'Daemon offline. Run npx soupz.'}
            {lastOrderId ? ` • Order ${lastOrderId}` : ''}
            {buildMode === 'deep' ? ' • mode: parallel orchestration' : ' • mode: single-agent'}
            {lastOrderId ? ` • status: ${orderStatus}` : ''}
            {lastOrderId ? ` • events: ${orderEventCount}` : ''}
          </div>
        </div>

        {lastOrderId ? (
          <div className="bg-bg-surface border border-border-subtle rounded-md p-3 space-y-2">
            <div className="text-[11px] uppercase tracking-wider text-text-faint">Parallel Visibility</div>
            <div className="text-xs text-text-sec">
              Deep mode uses child worker processes (not PTY terminals), so active terminals can stay at 0 while workers still run in parallel.
            </div>
            {primaryRole ? (
              <div className="text-xs text-text-sec">
                primary route role: <span className="text-text-pri">{primaryRole}</span>
              </div>
            ) : null}
            {specialistsPlanned.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {specialistsPlanned.map((name) => (
                  <span key={name} className="px-2 py-0.5 rounded text-[11px] border border-border-subtle text-text-sec bg-bg-elevated">
                    {name}
                  </span>
                ))}
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {Object.keys(workerStatus).length === 0 ? (
                <span className="text-xs text-text-faint">No worker events yet.</span>
              ) : Object.entries(workerStatus).map(([workerKey, meta]) => (
                <span
                    key={workerKey}
                  className={`px-2 py-1 rounded text-xs border ${
                    meta.state === 'completed'
                      ? 'border-success/30 text-success bg-success/10'
                      : meta.state === 'failed'
                        ? 'border-danger/30 text-danger bg-danger/10'
                        : 'border-warning/30 text-warning bg-warning/10'
                  }`}
                  title={meta.focus || ''}
                >
                  {(meta.label || workerKey)}: {meta.state}{meta.specialist ? ` • ${meta.specialist}` : ''}{meta.exitCode != null ? ` (${meta.exitCode})` : ''}
                </span>
              ))}
            </div>
            <div className="text-xs text-text-sec">
              synthesis: {synthesisStatus.started ? 'started' : 'not-started'}
              {synthesisStatus.finished ? ` • finished (${synthesisStatus.exitCode ?? 0})` : ''}
            </div>
            {orderStatus === 'completed' ? (
              <div className="text-xs text-success">Prompt completed.</div>
            ) : null}
            {orderStatus === 'failed' ? (
              <div className="text-xs text-danger">Prompt failed. {orderError ? `Last error: ${orderError}` : ''}</div>
            ) : null}
          </div>
        ) : null}

        <div className="bg-bg-surface border border-border-subtle rounded-md p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-text-faint">Active Terminals</div>
              <div className="text-xs text-text-sec">{terminals.length} active</div>
            </div>
            <button
              onClick={refreshTerminals}
              disabled={termLoading || !online}
              className="inline-flex items-center gap-1 px-2 py-1 rounded border border-border-subtle text-xs text-text-sec hover:text-text-pri disabled:opacity-50"
            >
              <RefreshCw size={12} className={termLoading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>

          {termError ? <div className="text-xs text-danger">{termError}</div> : null}

          {terminals.length === 0 ? (
            <div className="text-xs text-text-faint">No active terminals. (Parallel worker children are tracked under order events above.)</div>
          ) : (
            <div className="space-y-1">
              {terminals.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-2 bg-bg-elevated border border-border-subtle rounded px-2 py-1.5">
                  <div className="text-xs text-text-sec">
                    <span className="font-mono text-text-pri">#{t.id}</span>
                    <span className="ml-2">pid {t.pid ?? 'n/a'}</span>
                    <span className="ml-2">{t.ageSec ?? 0}s</span>
                    <span className="ml-2">{t.lines ?? 0} lines</span>
                  </div>
                  <button
                    onClick={() => killTerminal(t.id)}
                    disabled={killingId === t.id}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded border border-danger/30 text-xs text-danger hover:bg-danger/10 disabled:opacity-50"
                  >
                    {killingId === t.id ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                    Kill
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-bg-surface border border-border-subtle rounded-md p-3 min-h-[240px]">
          <div className="text-[11px] uppercase tracking-wider text-text-faint mb-2">Output</div>
          <div ref={outputRef} className="max-h-[420px] overflow-y-auto pr-1">
            <pre className="text-xs whitespace-pre-wrap break-words leading-relaxed text-text-sec">{output || 'No output yet.'}</pre>
          </div>
        </div>

        <div className="bg-bg-surface border border-border-subtle rounded-md p-3 min-h-[180px]">
          <div className="text-[11px] uppercase tracking-wider text-text-faint mb-2">Agent Lanes (Live Stream)</div>
          {laneOrder.length === 0 ? (
            <div className="text-xs text-text-faint">No lane output yet.</div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {laneOrder.map((lane) => (
                <div key={lane} className="border border-border-subtle rounded p-2 bg-bg-elevated">
                  <div className="text-[11px] font-medium text-text-sec mb-1">
                    {laneMeta[lane]?.label || lane}
                    {laneMeta[lane]?.agent && laneMeta[lane]?.agent !== lane ? ` • ${laneMeta[lane].agent}` : ''}
                    {laneMeta[lane]?.specialist ? ` • ${laneMeta[lane].specialist}` : ''}
                    {laneMeta[lane]?.role ? ` • ${laneMeta[lane].role}` : ''}
                    {laneMeta[lane]?.state ? ` • ${laneMeta[lane].state}` : ''}
                    {laneMeta[lane]?.exitCode != null ? ` (${laneMeta[lane].exitCode})` : ''}
                  </div>
                  <div className="max-h-[180px] overflow-y-auto">
                    <pre className="text-[11px] whitespace-pre-wrap break-words leading-relaxed text-text-sec">{agentLanes[lane] || 'No output yet for this lane.'}</pre>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
