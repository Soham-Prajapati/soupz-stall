import { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Check, Loader2, RefreshCw, Send, Trash2, Square } from 'lucide-react';
import { cancelOrder, checkAgentAvailability } from '../../lib/daemon';

const CORE_AGENTS = [
  { id: 'auto', label: 'Auto (Smart Route)' },
  { id: 'gemini', label: 'Gemini' },
  { id: 'codex', label: 'Codex' },
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

const HACKATHON_RADIATOR_ROUTES_PROMPT = [
  'Hackathon PS: Radiator Routes. Build an implementation-ready intelligent travel planning system with voice-first interaction and adaptive trip management.',
  'Deliver architecture, data model, APIs, and execution plan for: voice+text context continuity, regret-aware what-if planning, personal AI proxy per traveler, and persistent travel personality memory.',
  'Include multi-source travel integration (flights, trains, hotels, local transport), live disruption monitoring, automatic itinerary replanning, and explainable trade-offs for cost, fatigue, and risk.',
  'Add collaborative group itinerary editing with in-line rationale, role-aware group balancing, and social-vibe matching for activities.',
  'Return concrete output only: system architecture, SQL schema, API contracts, event-driven replanning flow, fallback behavior, and 24-hour hackathon MVP plan + 5-minute demo script.',
].join(' ');

const ENABLED_CORE_AGENTS_KEY = 'soupz_enabled_core_agents';

export default function CoreConsole({ workspace }) {
  const [agentId, setAgentId] = useState('auto');
  const [buildMode, setBuildMode] = useState('quick');
  const [useAiPlanner, setUseAiPlanner] = useState(true);
  const [plannerStyle, setPlannerStyle] = useState('balanced');
  const [plannerNotes, setPlannerNotes] = useState('');
  const [showPlannerSettings, setShowPlannerSettings] = useState(false);
  const [cwd, setCwd] = useState(TESTING_CWD);
  const [prompt, setPrompt] = useState('');
  const [output, setOutput] = useState('');
  const [running, setRunning] = useState(false);
  const [lastOrderId, setLastOrderId] = useState(null);
  const [enabledAgents, setEnabledAgents] = useState(() => {
    try {
      const stored = localStorage.getItem(ENABLED_CORE_AGENTS_KEY);
      const parsed = stored ? JSON.parse(stored) : CORE_AGENTS.filter(a => a.id !== 'auto').map(a => a.id);
      return parsed.filter(id => id !== 'auto');
    } catch {
      return CORE_AGENTS.filter(a => a.id !== 'auto').map(a => a.id);
    }
  });
  const [orderStatus, setOrderStatus] = useState('idle');
  const [orderEventCount, setOrderEventCount] = useState(0);
  const [workerStatus, setWorkerStatus] = useState({});
  const [synthesisStatus, setSynthesisStatus] = useState({ started: false, finished: false, exitCode: null });
  const [primaryRole, setPrimaryRole] = useState('');
  const [specialistsPlanned, setSpecialistsPlanned] = useState([]);
  const [resolvedWorkerCount, setResolvedWorkerCount] = useState(null);
  const [maxWorkerCount, setMaxWorkerCount] = useState(null);
  const [plannerInfo, setPlannerInfo] = useState({ useAiPlanner: true, plannerUsed: null, plannerStyle: '', plannerReason: '' });
  const [pendingQuestions, setPendingQuestions] = useState([]);
  const [pendingInputAnswers, setPendingInputAnswers] = useState({});
  const [questionCursor, setQuestionCursor] = useState(0);
  const [optionCursorByQuestion, setOptionCursorByQuestion] = useState({});
  const [submittingInput, setSubmittingInput] = useState(false);
  const [roleMap, setRoleMap] = useState({});
  const [orderError, setOrderError] = useState('');
  const [agentLanes, setAgentLanes] = useState({});
  const [terminals, setTerminals] = useState([]);
  const [termLoading, setTermLoading] = useState(false);
  const [termError, setTermError] = useState('');
  const [killingId, setKillingId] = useState(null);
  const [agentAvailability, setAgentAvailability] = useState({});
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState('');
  const outputRef = useRef(null);
  const questionPanelRef = useRef(null);
  const completionMarkedRef = useRef(false);
  const knownWorkersRef = useRef([]);
  const online = !!workspace?.online;

  const readyAgents = useMemo(
    () => CORE_AGENTS.filter(a => a.id !== 'auto' && agentAvailability[a.id]).map(a => a.label),
    [agentAvailability],
  );

  const missingAgents = useMemo(
    () => CORE_AGENTS.filter(a => a.id !== 'auto' && agentAvailability[a.id] === false).map(a => a.label),
    [agentAvailability],
  );

  const autoAgentsEmpty = agentId === 'auto' && enabledAgents.length === 0;

  function persistEnabledAgents(list) {
    const sanitized = list.filter(id => id !== 'auto');
    try {
      localStorage.setItem(ENABLED_CORE_AGENTS_KEY, JSON.stringify(sanitized));
    } catch { /* ignore */ }
  }

  function toggleAgent(agentIdToToggle) {
    if (agentIdToToggle !== 'auto' && agentAvailability[agentIdToToggle] === false) {
      return;
    }
    setEnabledAgents(prev => {
      const next = prev.includes(agentIdToToggle)
        ? prev.filter(id => id !== agentIdToToggle)
        : [...prev, agentIdToToggle];
      const sanitized = next.filter(id => id !== 'auto');
      persistEnabledAgents(sanitized);
      return sanitized;
    });
  }

  function toggleAllAgents(enable) {
    const next = enable
      ? CORE_AGENTS.filter(a => a.id !== 'auto' && agentAvailability[a.id] !== false).map(a => a.id)
      : [];
    setEnabledAgents(next);
    persistEnabledAgents(next);
  }

  useEffect(() => {
    let active = true;
    async function detectAgents() {
      setAvailabilityLoading(true);
      setAvailabilityError('');
      try {
        const avail = await checkAgentAvailability();
        if (!active) return;
        const normalized = CORE_AGENTS.reduce((acc, agent) => {
          if (agent.id === 'auto') return acc;
          const map = avail?.simple || avail;
          acc[agent.id] = Boolean(map?.[agent.id]);
          return acc;
        }, {});
        setAgentAvailability(normalized);
        setEnabledAgents(prev => {
          const filtered = prev.filter(id => id !== 'auto' && (normalized[id] || normalized[id] === undefined));
          const fallback = Object.keys(normalized).filter(id => normalized[id]);
          const next = filtered.length ? filtered : fallback;
          const same = next.length === prev.length && next.every(id => prev.includes(id));
          if (same) return prev;
          persistEnabledAgents(next);
          return next;
        });
      } catch (err) {
        if (!active) return;
        setAvailabilityError(err?.message || 'Unable to detect CLI agents.');
      } finally {
        if (active) setAvailabilityLoading(false);
      }
    }
    detectAgents();
    const timer = setInterval(detectAgents, 60000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  async function handleStop() {
    if (!lastOrderId) return;
    try {
      await cancelOrder(lastOrderId);
      setOutput(prev => prev + '\n\n[core] Order cancelled by user\n');
      setRunning(false);
      setOrderStatus('cancelled');
    } catch (err) {
      console.error('Failed to cancel order:', err);
      if (String(err?.message || '').includes('(404)')) {
        setOutput(prev => prev + '\n\n[core] Cancel target no longer exists on daemon. Clearing stale run state.\n');
        setRunning(false);
        setOrderStatus('failed');
        setLastOrderId(null);
        return;
      }
      setOutput(prev => prev + `\n\n[core] Failed to cancel: ${err.message}\n`);
    }
  }

  const laneOrder = useMemo(() => {
    const keys = Object.keys(agentLanes || {});
    const workerFirst = keys.filter((k) => k !== 'synthesis').sort();
    return keys.includes('synthesis') ? [...workerFirst, 'synthesis'] : workerFirst;
  }, [agentLanes]);

  const orderActive = useMemo(
    () => !!lastOrderId && (orderStatus === 'queued' || orderStatus === 'running' || orderStatus === 'waiting_input'),
    [lastOrderId, orderStatus],
  );

  const canRun = useMemo(() => {
    if (!prompt.trim() || running || orderActive || !online) return false;
    if (agentId === 'auto' && enabledAgents.length === 0) return false;
    return true;
  }, [prompt, running, orderActive, online, agentId, enabledAgents.length]);

  useEffect(() => {
    if (agentId === 'auto') return;
    if (enabledAgents.includes(agentId)) return;
    setAgentId('auto');
  }, [agentId, enabledAgents]);

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
    if (lastOrderId && (orderStatus === 'queued' || orderStatus === 'running' || orderStatus === 'waiting_input')) {
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

  function laneHeading(laneId, meta = {}) {
    if (laneId === 'synthesis') {
      const persona = meta.role || 'lead-synthesizer';
      return `Synthesis · persona: ${persona}`;
    }

    const match = String(laneId).match(/^([a-z-]+)-(\d+)$/i);
    const agentBase = (meta.agent || match?.[1] || laneId || 'agent')
      .split(/[-_\s]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
    const index = match?.[2] || '?';
    const persona = meta.specialist || meta.role || 'generalist';
    return `${agentBase} (${index}) · persona: ${persona}`;
  }

  function appendLiveChunk(chunk) {
    const text = String(chunk || '');
    if (!text) return;

    const cleanedLines = [];
    const workerSeen = new Set();
    let synthesisSeen = false;

    setAgentLanes((prev) => {
      const next = { ...(prev || {}) };
      for (const line of text.split('\n')) {
        const synth = line.match(/^\[synthesis:([^\]]+)\]\s?(.*)$/i);
        if (synth) {
          synthesisSeen = true;
          next.synthesis = (next.synthesis || '') + `${synth[2]}\n`;
          cleanedLines.push(synth[2]);
          continue;
        }

        const workerStdErr = line.match(/^\[worker:([^|\]]+)\|agent:([^:\]]+):stderr\]\s?(.*)$/i);
        if (workerStdErr) {
          const workerId = workerStdErr[1];
          workerSeen.add(workerId);
          next[workerId] = (next[workerId] || '') + `[stderr] ${workerStdErr[3]}\n`;
          cleanedLines.push(`[stderr] ${workerStdErr[3]}`);
          continue;
        }

        const worker = line.match(/^\[worker:([^|\]]+)\|agent:([^\]]+)\]\s?(.*)$/i);
        if (worker) {
          const workerId = worker[1];
          workerSeen.add(workerId);
          next[workerId] = (next[workerId] || '') + `${worker[3]}\n`;
          cleanedLines.push(worker[3]);
          continue;
        }

        cleanedLines.push(line);
      }
      return next;
    });

    if (workerSeen.size > 0) {
      setWorkerStatus((prev) => {
        const next = { ...(prev || {}) };
        for (const workerId of workerSeen) {
          if (!next[workerId]) {
            next[workerId] = {
              state: 'running',
              exitCode: null,
              role: roleMap[workerId] || '',
              label: workerId,
              specialist: '',
              focus: '',
              agent: workerId.split('-')[0] || workerId,
            };
          }
        }
        return next;
      });
    }

    if (synthesisSeen) {
      setSynthesisStatus((prev) => ({ ...prev, started: true }));
    }

    const cleaned = cleanedLines.join('\n');
    setOutput((prev) => prev + cleaned);
  }

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
    setResolvedWorkerCount(null);
    setMaxWorkerCount(null);
    setPlannerInfo({ useAiPlanner: true, plannerUsed: null, plannerStyle: '', plannerReason: '' });
    setPendingQuestions([]);
    setPendingInputAnswers({});
    setQuestionCursor(0);
    setOptionCursorByQuestion({});
    setSubmittingInput(false);
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
          allowedAgents: agentId === 'auto' ? enabledAgents : undefined,
          sameAgentOnly: buildMode === 'deep' && agentId !== 'auto',
          buildMode,
          cwd,
          orchestrationMode: buildMode === 'deep' ? 'parallel' : 'single',
          useAiPlanner,
          plannerStyle,
          plannerNotes,
          returnOrderImmediately: true,
        },
        (chunk, done) => {
          if (done) return;
          appendLiveChunk(chunk);
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
    if (pendingQuestions.length > 0) {
      questionPanelRef.current?.focus?.();
    }
  }, [pendingQuestions.length]);

  useEffect(() => {
    if (!workspace?.getOrderDetail || !lastOrderId) return;

    let cancelled = false;
    const parseOrder = (detail) => {
      if (!detail || cancelled) return;

      const events = Array.isArray(detail.events) ? detail.events : [];
      setOrderStatus(detail.status || 'unknown');
      setOrderEventCount(events.length);
      setRunning(detail.status === 'queued' || detail.status === 'running' || detail.status === 'waiting_input');
      const selected = events.find((e) => e.type === 'route.selected');
      setPrimaryRole(selected?.primaryRole || '');
      setSpecialistsPlanned(Array.isArray(selected?.specialistsPlanned) ? selected.specialistsPlanned : []);
      setResolvedWorkerCount(Number.isFinite(selected?.deepPolicy?.workerCountResolved) ? selected.deepPolicy.workerCountResolved : null);
      setMaxWorkerCount(Number.isFinite(selected?.deepPolicy?.workerCountMax) ? selected.deepPolicy.workerCountMax : null);
      setPlannerInfo({
        useAiPlanner: selected?.deepPolicy?.useAiPlanner !== false,
        plannerUsed: selected?.deepPolicy?.plannerUsed === true,
        plannerStyle: selected?.deepPolicy?.plannerStyle || '',
        plannerReason: selected?.deepPolicy?.plannerReason || '',
      });

      const incomingQuestions = Array.isArray(detail?.pendingQuestions) ? detail.pendingQuestions : [];
      setPendingQuestions(incomingQuestions);
      if (incomingQuestions.length === 0) {
        setPendingInputAnswers({});
        setQuestionCursor(0);
        setOptionCursorByQuestion({});
        setSubmittingInput(false);
      }

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
        const createdFiles = Array.isArray(detail?.createdFiles) ? detail.createdFiles : [];
        const filesLine = createdFiles.length > 0
          ? `\n[core] Created artifacts:\n- ${createdFiles.join('\n- ')}`
          : '';
        const finalLine = detail.status === 'completed'
          ? `\n\n[core] Prompt completed successfully. exitCode=${detail.exitCode ?? 0}${filesLine}`
          : detail.status === 'cancelled'
            ? `\n\n[core] Prompt cancelled. exitCode=${detail.exitCode ?? 130}${filesLine}`
            : `\n\n[core] Prompt failed. exitCode=${detail.exitCode ?? 'unknown'}${filesLine}`;
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
        if (!detail) {
          setOutput(prev => prev + '\n\n[core] Order no longer exists on daemon. Clearing stale session state.\n');
          setRunning(false);
          setOrderStatus('failed');
          setLastOrderId(null);
          return;
        }
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

  function setAnswerForQuestion(question, optionId) {
    setPendingInputAnswers((prev) => {
      const current = Array.isArray(prev[question.id]) ? prev[question.id] : [];
      let next;
      if (question.multiSelect) {
        next = current.includes(optionId)
          ? current.filter((id) => id !== optionId)
          : [...current, optionId];
      } else {
        next = [optionId];
      }
      return { ...prev, [question.id]: next };
    });
  }

  async function submitPendingQuestions() {
    if (!lastOrderId || pendingQuestions.length === 0 || !workspace?.submitOrderInput) return;
    setSubmittingInput(true);
    setTermError('');
    try {
      const answers = {};
      for (const q of pendingQuestions) {
        const selected = Array.isArray(pendingInputAnswers[q.id]) ? pendingInputAnswers[q.id] : [];
        answers[q.id] = q.multiSelect ? selected : selected.slice(0, 1);
      }
      await workspace.submitOrderInput(lastOrderId, answers);
    } catch (err) {
      setTermError(err?.message || 'Failed to submit planner answers');
    } finally {
      setSubmittingInput(false);
    }
  }

  function handleQuestionPanelKeyDown(event) {
    if (pendingQuestions.length === 0) return;
    const activeQuestion = pendingQuestions[Math.max(0, Math.min(questionCursor, pendingQuestions.length - 1))];
    const activeOptionIndex = optionCursorByQuestion[activeQuestion.id] || 0;
    const activeOptions = Array.isArray(activeQuestion.options) ? activeQuestion.options : [];

    if (event.key === 'Tab') {
      event.preventDefault();
      setQuestionCursor((prev) => {
        if (event.shiftKey) return Math.max(0, prev - 1);
        return Math.min(pendingQuestions.length - 1, prev + 1);
      });
      return;
    }

    if (event.key === 'ArrowUp' && (event.altKey || event.metaKey)) {
      event.preventDefault();
      setQuestionCursor((prev) => Math.max(0, prev - 1));
      return;
    }
    if (event.key === 'ArrowDown' && (event.altKey || event.metaKey)) {
      event.preventDefault();
      setQuestionCursor((prev) => Math.min(pendingQuestions.length - 1, prev + 1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setOptionCursorByQuestion((prev) => ({
        ...prev,
        [activeQuestion.id]: Math.max(0, activeOptionIndex - 1),
      }));
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOptionCursorByQuestion((prev) => ({
        ...prev,
        [activeQuestion.id]: Math.min(activeOptions.length - 1, activeOptionIndex + 1),
      }));
      return;
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setOptionCursorByQuestion((prev) => ({
        ...prev,
        [activeQuestion.id]: Math.max(0, activeOptionIndex - 1),
      }));
      return;
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      setOptionCursorByQuestion((prev) => ({
        ...prev,
        [activeQuestion.id]: Math.min(activeOptions.length - 1, activeOptionIndex + 1),
      }));
      return;
    }
    if (event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      const opt = activeOptions[activeOptionIndex];
      if (opt) setAnswerForQuestion(activeQuestion, opt.id);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      void submitPendingQuestions();
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(1200px_500px_at_10%_-10%,rgba(56,189,248,0.14),transparent),radial-gradient(1000px_500px_at_100%_0%,rgba(99,102,241,0.12),transparent)] bg-bg-base text-text-pri p-4 sm:p-8">
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
          <div className="border border-border-subtle/60 rounded-md bg-bg-surface/60 p-3 space-y-3">
            <div>
              <label className="text-xs text-text-sec block mb-1">Agent</label>
              <select
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
                className="w-full bg-bg-surface border border-border-subtle rounded-md px-2 py-2 text-sm"
              >
                {CORE_AGENTS.map((a) => (
                  <option key={a.id} value={a.id} disabled={a.id !== 'auto' && agentAvailability[a.id] === false}>
                    {a.label}
                    {a.id !== 'auto' && agentAvailability[a.id] === false ? ' (install first)' : ''}
                  </option>
                ))}
              </select>
            </div>
            
            {agentId === 'auto' && (
              <div className="border-t border-border-subtle pt-3">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-text-faint">Enable Agents</label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => toggleAllAgents(true)}
                      className="text-[10px] px-1.5 py-0.5 rounded text-accent hover:bg-accent/10"
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleAllAgents(false)}
                      className="text-[10px] px-1.5 py-0.5 rounded text-text-faint hover:text-text-pri hover:bg-text-pri/5"
                    >
                      None
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  {CORE_AGENTS.filter(a => a.id !== 'auto').map(a => {
                    const available = agentAvailability[a.id] !== false;
                    const enabled = enabledAgents.includes(a.id);
                    return (
                      <button
                        key={a.id}
                        type="button"
                        disabled={!available}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleAgent(a.id);
                        }}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-sm transition-colors border border-transparent disabled:opacity-40 disabled:cursor-not-allowed hover:bg-text-pri/5"
                      >
                        <span
                          className={`w-3 h-3 rounded border flex items-center justify-center flex-shrink-0 ${
                            enabled
                              ? 'bg-accent border-accent'
                              : 'border-border-subtle bg-bg-base'
                          }`}
                        >
                          {enabled && <Check size={9} className="text-bg-base" />}
                        </span>
                        <span className="flex-1">{a.label}</span>
                        <span className={`text-[10px] font-mono uppercase ${available ? 'text-success' : 'text-warning'}`}>
                          {available ? 'ready' : 'missing'}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="text-[11px] text-text-faint mt-2 space-y-1">
                  <div>
                    {availabilityLoading
                      ? 'Detecting installed CLIs…'
                      : readyAgents.length
                        ? `Detected: ${readyAgents.join(', ')}`
                        : 'No CLI agents detected yet.'}
                    {availabilityError && <span className="text-warning ml-2">{availabilityError}</span>}
                  </div>
                  {missingAgents.length > 0 && (
                    <div className="text-warning">
                      Missing: {missingAgents.join(', ')} — runs will skip these until installed.
                    </div>
                  )}
                  {autoAgentsEmpty && (
                    <div className="text-warning">Select at least one ready agent so auto mode can run.</div>
                  )}
                </div>
              </div>
            )}
          </div>

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

        {autoAgentsEmpty && (
          <div className="text-[11px] text-warning">
            Auto mode is disabled until you enable at least one installed agent (Gemini, Codex, Kiro, etc.).
          </div>
        )}

        {buildMode === 'deep' ? (
          <div className="bg-bg-surface/80 border border-border-subtle/60 rounded-md p-3 space-y-3">
            <div className="text-[11px] uppercase tracking-wider text-text-faint">Planner Controls</div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-xs text-text-sec">
                <input
                  type="checkbox"
                  checked={useAiPlanner}
                  onChange={(e) => setUseAiPlanner(e.target.checked)}
                />
                AI planner enabled
              </label>
              <button
                type="button"
                onClick={() => setShowPlannerSettings((prev) => !prev)}
                className="px-2 py-1 rounded-md text-xs bg-bg-elevated border border-border-subtle text-text-sec hover:text-text-pri"
              >
                {showPlannerSettings ? 'Hide planner options' : 'Show planner options'}
              </button>
            </div>

            {showPlannerSettings ? (
              <>
                <div className="text-xs text-text-sec">Planning profile</div>
                <div className="text-[11px] text-accent">Selected: {plannerStyle}</div>
                <div className="grid sm:grid-cols-2 gap-2">
                  {[
                    {
                      id: 'balanced',
                      title: 'Balanced Plan',
                      desc: 'Mix feasibility, delivery speed, and quality checks.',
                    },
                    {
                      id: 'judge-defense',
                      title: 'Judge Defense',
                      desc: 'Prioritize research rigor, tradeoffs, and cross-question prep.',
                    },
                    {
                      id: 'build-fast',
                      title: 'Build Fast',
                      desc: 'Bias to fastest realistic execution and MVP shipping.',
                    },
                    {
                      id: 'research-heavy',
                      title: 'Research Heavy',
                      desc: 'Bias toward alternatives, benchmarking, and evidence depth.',
                    },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setPlannerStyle(opt.id)}
                      className={`text-left border rounded-md px-2 py-2 ${plannerStyle === opt.id ? 'border-accent bg-accent/20 text-text-pri ring-2 ring-accent/60' : 'border-border-subtle/60 text-text-sec bg-bg-elevated/70'}`}
                    >
                      <div className="text-xs font-medium flex items-center gap-1.5">
                        {plannerStyle === opt.id ? <Check size={12} className="text-accent" /> : null}
                        {opt.title}
                      </div>
                      <div className="text-[11px] text-text-faint">{opt.desc}</div>
                    </button>
                  ))}
                </div>

                <label className="block text-xs text-text-sec">
                  Notes For Planner (optional)
                  <textarea
                    value={plannerNotes}
                    onChange={(e) => setPlannerNotes(e.target.value)}
                    rows={3}
                    placeholder="Example: prioritize feasibility over flashy features, include fallback demo path, and generate likely judge Q&A."
                    className="mt-1 w-full bg-bg-elevated border border-border-subtle rounded-md px-3 py-2 text-sm focus:outline-none focus:border-accent"
                  />
                </label>
              </>
            ) : null}
          </div>
        ) : null}

        <label className="block text-xs text-text-sec">
          Working Directory
          <input
            value={cwd}
            onChange={(e) => setCwd(e.target.value)}
            className="mt-1 w-full bg-bg-surface/80 border border-border-subtle/60 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-accent/80"
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
          <button
            onClick={() => {
              setCwd(TESTING_CWD);
              setBuildMode('deep');
              setPrompt(HACKATHON_RADIATOR_ROUTES_PROMPT);
            }}
            className="px-2 py-1 rounded-md text-xs bg-bg-elevated border border-border-subtle text-text-sec hover:text-text-pri"
          >
            Use Hackathon PS (Radiator Routes)
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
            className="mt-1 w-full bg-bg-surface/80 border border-border-subtle/60 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-accent/80"
          />
        </label>

        <div className="flex items-center gap-3">
          {running ? (
            <button
              onClick={handleStop}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white transition-colors"
            >
              <Square size={14} />
              Stop
            </button>
          ) : (
            <button
              onClick={handleRun}
              disabled={!canRun}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-accent text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={14} />
              Run Prompt
            </button>
          )}

          <div className="text-xs text-text-faint">
            {online ? 'Daemon online' : 'Daemon offline. Run npx soupz.'}
            {lastOrderId ? ` • Order ${lastOrderId}` : ''}
            {buildMode === 'deep' ? ' • mode: parallel orchestration' : ' • mode: single-agent'}
            {lastOrderId ? ` • status: ${orderStatus}` : ''}
            {lastOrderId ? ` • events: ${orderEventCount}` : ''}
          </div>
        </div>

        {lastOrderId ? (
          <div className="bg-bg-surface/80 border border-border-subtle/60 rounded-md p-3 space-y-2">
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
            {resolvedWorkerCount != null ? (
              <div className="text-xs text-text-sec">
                resolved workers: <span className="text-text-pri">{resolvedWorkerCount}</span>
                {maxWorkerCount != null ? ` / max ${maxWorkerCount}` : ''}
              </div>
            ) : null}
            {plannerInfo ? (
              <div className="text-xs text-text-sec">
                planner: <span className="text-text-pri">{plannerInfo.useAiPlanner === false ? 'off' : (plannerInfo.plannerUsed ? 'ai' : 'fallback')}</span>
                {plannerInfo.plannerStyle ? ` • style: ${plannerInfo.plannerStyle}` : ''}
                {plannerInfo.plannerReason ? ` • reason: ${plannerInfo.plannerReason}` : ''}
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

        <div className="bg-bg-surface/80 border border-border-subtle/60 rounded-md p-3 space-y-2">
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

        <div className="bg-bg-surface/80 border border-border-subtle/60 rounded-md p-3 min-h-[240px]">
          <div className="text-[11px] uppercase tracking-wider text-text-faint mb-2">Output</div>
          {orderStatus !== 'waiting_input' ? (
            <div className="mb-2 text-[11px] text-text-faint">Interactive planner questions will appear here only when the run enters waiting-input.</div>
          ) : null}
          {orderStatus === 'waiting_input' && pendingQuestions.length > 0 ? (
            <div
              ref={questionPanelRef}
              tabIndex={0}
              onKeyDown={handleQuestionPanelKeyDown}
              className="mb-3 bg-bg-surface/85 border border-sky-400/35 rounded-md p-3 space-y-3 outline-none shadow-[0_0_0_1px_rgba(56,189,248,0.14)]"
            >
              <div className="text-[11px] uppercase tracking-wider text-sky-300">Planner Needs Input</div>
              <div className="text-xs text-text-sec">Keys: up/down option, left/right option, tab next question, shift+tab previous, space select, enter submit, alt+up/down question.</div>
              {pendingQuestions.map((q, qIdx) => {
                const selected = Array.isArray(pendingInputAnswers[q.id]) ? pendingInputAnswers[q.id] : [];
                const activeOption = optionCursorByQuestion[q.id] || 0;
                const isActiveQuestion = qIdx === questionCursor;
                return (
                  <div key={q.id} className={`rounded-md border p-2 ${isActiveQuestion ? 'border-accent/60 bg-accent/10' : 'border-border-subtle bg-bg-elevated/70'}`}>
                    <div className="text-xs text-text-pri mb-1">{q.question}</div>
                    <div className="grid sm:grid-cols-2 gap-1">
                      {q.options.map((opt, oIdx) => {
                        const checked = selected.includes(opt.id);
                        const focused = isActiveQuestion && activeOption === oIdx;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              setQuestionCursor(qIdx);
                              setOptionCursorByQuestion((prev) => ({ ...prev, [q.id]: oIdx }));
                              setAnswerForQuestion(q, opt.id);
                            }}
                            className={`text-left rounded border px-2 py-1 ${checked ? 'border-emerald-400/60 bg-emerald-500/15 text-text-pri' : 'border-border-subtle text-text-sec bg-bg-surface'} ${focused ? 'ring-1 ring-sky-300' : ''}`}
                          >
                            <div className="text-xs">{opt.label}</div>
                            {opt.description ? <div className="text-[11px] text-text-faint">{opt.description}</div> : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => submitPendingQuestions()}
                  disabled={submittingInput}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-accent text-white disabled:opacity-50"
                >
                  {submittingInput ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  Submit & Continue
                </button>
                <div className="text-xs text-text-faint">{lastOrderId ? `order ${lastOrderId}` : ''}</div>
              </div>
            </div>
          ) : null}
          <div ref={outputRef} className="max-h-[420px] overflow-y-auto pr-1">
            <pre className="text-xs whitespace-pre-wrap break-words leading-relaxed text-text-sec">{output || 'No output yet.'}</pre>
          </div>
        </div>

        <div className="bg-bg-surface/80 border border-border-subtle/60 rounded-md p-3 min-h-[180px]">
          <div className="text-[11px] uppercase tracking-wider text-text-faint mb-2">Agent Lanes (Live Stream)</div>
          {laneOrder.length === 0 ? (
            <div className="text-xs text-text-faint">No lane output yet.</div>
          ) : (
            <div className="grid gap-2 grid-cols-2">
              {laneOrder.map((lane) => (
                <div key={lane} className="border border-border-subtle rounded p-2 bg-bg-elevated">
                  <div className="text-[10px] font-medium text-text-sec mb-1">
                    {laneHeading(lane, laneMeta[lane] || {})}
                    {laneMeta[lane]?.state ? ` • ${laneMeta[lane].state}` : ''}
                    {laneMeta[lane]?.exitCode != null ? ` (${laneMeta[lane].exitCode})` : ''}
                  </div>
                  <div className="max-h-[180px] overflow-y-auto">
                    <pre className="text-[10px] whitespace-pre-wrap break-words leading-[1.2] text-text-sec">{agentLanes[lane] || 'No output yet for this lane.'}</pre>
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
