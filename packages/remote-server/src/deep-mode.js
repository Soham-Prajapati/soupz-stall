// deep-mode.js — deep parallel orchestration: worker dispatch, nested delegation, synthesis

import { mkdir, writeFile, readFile } from 'fs/promises';
import { join, resolve } from 'path';
import {
    wss,
    authenticatedClients,
    REPO_ROOT,
    DEFAULT_DEEP_WORKERS,
    MAX_DEEP_WORKERS,
    DEFAULT_SPECIALIST_SEQUENCE,
    DEEP_NESTED_ENABLED_DEFAULT,
    DEEP_NESTED_MAX_PARENTS,
    DEEP_NESTED_SUBAGENTS_PER_PARENT,
    DEEP_NESTED_TIMEOUT_MS,
    DEEP_NESTED_SYNTH_TIMEOUT_MS,
    resolveTimeoutMs,
    createOrderRuntime,
    cleanupOrderRuntime,
    appendLaneBuffer,
    pushOrderOutputDelta,
    flushOrderOutputDeltas,
    startWorkerWatchdog,
    stopWorkerWatchdog,
    nowIso,
    pushOrderEvent,
    persistOrder,
    broadcastOrderUpdate,
    processOrderQueue,
    runChildAgent,
    toStreamChunk,
    specialistFocusSummary,
    nestedFocusSummary,
    inferSpecialistsFromPrompt,
    assignSpecialistsToWorkers,
    selectParallelWorkers,
    getReadyAgentsInPriorityOrder,
    fallbackSpecialistForAgent,
    inferExecutionRole,
    canAgentHandleSpecialist,
    estimateDeepWorkerCount,
    isPathInside,
    summarizePromptForWorkspace,
    registerCreatedFile,
    toWorkspaceRelativePath,
    getSelectedModelForAgent,
} from './shared.js';
import { archiveOrderResult } from './run-archive.js';

// ─── Nested delegation constants ──────────────────────────────────────────────

const NESTED_SUBAGENT_BLUEPRINTS = {
    architect: ['security', 'developer', 'qa'],
    developer: ['qa', 'security', 'devops'],
    researcher: ['analyst', 'strategist', 'finance'],
    strategist: ['researcher', 'pm', 'analyst'],
    pm: ['architect', 'developer', 'qa'],
    designer: ['researcher', 'qa', 'developer'],
    qa: ['developer', 'security', 'devops'],
    devops: ['security', 'developer', 'qa'],
    analyst: ['researcher', 'finance', 'strategist'],
    evaluator: ['researcher', 'qa', 'architect'],
    finance: ['analyst', 'researcher', 'strategist'],
    security: ['developer', 'qa', 'architect'],
};

const NESTED_SPECIALIST_PRIORITY = ['architect', 'developer', 'security', 'researcher', 'qa', 'devops', 'strategist', 'pm', 'analyst', 'finance', 'designer', 'evaluator'];

// ─── Nested policy builder ────────────────────────────────────────────────────

function buildNestedPolicy(deepPolicy = {}, workerCount = DEFAULT_DEEP_WORKERS) {
    const enabled = typeof deepPolicy.enableNestedDelegation === 'boolean'
        ? deepPolicy.enableNestedDelegation
        : DEEP_NESTED_ENABLED_DEFAULT;

    const maxParentsRaw = Number.parseInt(deepPolicy.nestedMaxParents, 10);
    const maxParents = Number.isFinite(maxParentsRaw)
        ? Math.max(1, Math.min(workerCount, maxParentsRaw))
        : Math.max(1, Math.min(workerCount, DEEP_NESTED_MAX_PARENTS));

    const perWorkerRaw = Number.parseInt(deepPolicy.nestedSubAgentsPerWorker, 10);
    const subAgentsPerWorker = Number.isFinite(perWorkerRaw)
        ? Math.max(1, Math.min(4, perWorkerRaw))
        : Math.max(1, Math.min(4, DEEP_NESTED_SUBAGENTS_PER_PARENT));

    const nestedTimeoutMs = resolveTimeoutMs(deepPolicy.nestedTimeoutMs, DEEP_NESTED_TIMEOUT_MS);
    const nestedSynthesisTimeoutMs = resolveTimeoutMs(deepPolicy.nestedSynthesisTimeoutMs, DEEP_NESTED_SYNTH_TIMEOUT_MS);

    return {
        enabled,
        maxParents,
        subAgentsPerWorker,
        enableTeamSynthesis: deepPolicy.enableNestedTeamSynthesis !== false,
        nestedTimeoutMs,
        nestedSynthesisTimeoutMs,
        depth: 1,
    };
}

function pickNestedEligibleWorkers(workers = [], workerMeta = {}, nestedPolicy = {}) {
    if (!nestedPolicy?.enabled || workers.length === 0) return new Set();

    const ranked = [...workers].sort((a, b) => {
        const aSpecialist = workerMeta[a.workerId]?.specialist || 'developer';
        const bSpecialist = workerMeta[b.workerId]?.specialist || 'developer';
        const aRank = NESTED_SPECIALIST_PRIORITY.indexOf(aSpecialist);
        const bRank = NESTED_SPECIALIST_PRIORITY.indexOf(bSpecialist);
        const ai = aRank >= 0 ? aRank : 999;
        const bi = bRank >= 0 ? bRank : 999;
        return ai - bi;
    });

    return new Set(ranked.slice(0, nestedPolicy.maxParents).map((w) => w.workerId));
}

function buildNestedSubAgentPlan(parentSpecialist = 'developer', nestedPolicy = {}) {
    const blueprint = NESTED_SUBAGENT_BLUEPRINTS[parentSpecialist] || NESTED_SUBAGENT_BLUEPRINTS.developer;
    const take = Math.max(1, Math.min(blueprint.length, nestedPolicy.subAgentsPerWorker || 1));
    return blueprint.slice(0, take).map((specialist, idx) => ({
        id: `${specialist}-${idx + 1}`,
        specialist,
        focus: nestedFocusSummary(specialist),
    }));
}

// ─── Prompt intent analysis ───────────────────────────────────────────────────

function analyzePromptIntent(prompt = '') {
    const text = String(prompt || '');
    const lower = text.toLowerCase();
    const lines = text.split(/\r?\n/).length;

    return {
        isHackathon: /\b(hackathon|finalist|judg(e|ing)|demo day|cross[-\s]?question|pitch)\b/.test(lower),
        needsResearch: /\b(research|competitor|benchmark|references?|market|survey)\b/.test(lower),
        needsFeasibility: /\b(feasible|feasibility|constraints?|trade-?offs?|realistic|timeline)\b/.test(lower),
        needsExecutionPlan: /\b(execution plan|roadmap|milestone|sprint|timeline|how to build)\b/.test(lower),
        needsCrossQuestionPrep: /\b(cross[-\s]?question|objection|defend|judge q&a|grill)\b/.test(lower),
        isBroadScope: lines >= 80 || /\b(end[-\s]?to[-\s]?end|full stack|complete system|production grade)\b/.test(lower),
    };
}

function buildDeepExecutionPolicy(prompt = '') {
    const intent = analyzePromptIntent(prompt);

    const policyLines = [
        'Execution policy (auto-injected by orchestrator):',
        '- Optimize for correctness, feasibility, and implementation realism over cosmetic language.',
        '- Every major claim must include at least one concrete justification, assumption, or tradeoff.',
        '- Produce output that can be converted directly into engineering tasks and review checklists.',
    ];

    if (intent.isHackathon) {
        policyLines.push('- Treat this as a competitive hackathon scenario: include judge-facing differentiation and demo defense points.');
    }
    if (intent.needsResearch || intent.isHackathon) {
        policyLines.push('- Include compact research synthesis: alternatives considered, why chosen approach wins, and known limitations.');
    }
    if (intent.needsFeasibility || intent.isBroadScope) {
        policyLines.push('- Add feasibility pass: risk table, dependency assumptions, and fallback path if critical components fail.');
    }
    if (intent.needsExecutionPlan || intent.isBroadScope) {
        policyLines.push('- Include phased execution plan: immediate MVP, stretch goals, and explicit time/cost constraints.');
    }
    if (intent.needsCrossQuestionPrep || intent.isHackathon) {
        policyLines.push('- Add cross-question prep: likely judge objections and concise, evidence-driven rebuttals.');
    }

    const outputContract = [
        'Output contract:',
        '1) Problem framing + assumptions',
        '2) Feasibility and tradeoffs',
        '3) Technical plan with implementation steps',
        '4) Risks, mitigations, and validation checklist',
        '5) Judge/defense notes (when relevant)',
    ];

    return {
        intent,
        policyText: [...policyLines, '', ...outputContract].join('\n'),
    };
}

// ─── JSON extraction ──────────────────────────────────────────────────────────

function extractJsonObject(text = '') {
    const raw = String(text || '').trim();
    if (!raw) return null;

    try {
        return JSON.parse(raw);
    } catch {
        // Continue with object-fragment extraction.
    }

    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) {
        const fragment = raw.slice(start, end + 1);
        try {
            return JSON.parse(fragment);
        } catch {
            return null;
        }
    }
    return null;
}

// ─── Planner normalizers ──────────────────────────────────────────────────────

function normalizePlannerSpecialists(items = [], targetCount = DEFAULT_DEEP_WORKERS) {
    const allowed = new Set([...DEFAULT_SPECIALIST_SEQUENCE, 'developer']);
    const normalized = [];

    for (const item of Array.isArray(items) ? items : []) {
        const name = String(item?.name || item?.specialist || '').trim().toLowerCase();
        if (!allowed.has(name)) continue;
        if (normalized.some((s) => s.name === name)) continue;
        normalized.push({
            name,
            focus: String(item?.focus || specialistFocusSummary(name)).trim() || specialistFocusSummary(name),
        });
    }

    for (const fallback of DEFAULT_SPECIALIST_SEQUENCE) {
        if (normalized.length >= targetCount) break;
        if (normalized.some((s) => s.name === fallback)) continue;
        normalized.push({ name: fallback, focus: specialistFocusSummary(fallback) });
    }

    return normalized.slice(0, targetCount);
}

function normalizePlannerIntent(input = {}) {
    const base = analyzePromptIntent('');
    return {
        isHackathon: input?.isHackathon === true || base.isHackathon,
        needsResearch: input?.needsResearch === true || base.needsResearch,
        needsFeasibility: input?.needsFeasibility === true || base.needsFeasibility,
        needsExecutionPlan: input?.needsExecutionPlan === true || base.needsExecutionPlan,
        needsCrossQuestionPrep: input?.needsCrossQuestionPrep === true || base.needsCrossQuestionPrep,
        isBroadScope: input?.isBroadScope === true || base.isBroadScope,
    };
}

function normalizePlannerQuestions(items = []) {
    const questions = [];
    for (const [idx, raw] of (Array.isArray(items) ? items : []).entries()) {
        const question = String(raw?.question || raw?.prompt || '').trim();
        const options = Array.isArray(raw?.options) ? raw.options : [];
        const normalizedOptions = options
            .map((opt, oIdx) => {
                const id = String(opt?.id || `opt_${oIdx + 1}`).trim();
                const label = String(opt?.label || opt?.text || '').trim();
                const description = String(opt?.description || '').trim();
                if (!id || !label) return null;
                return { id, label, description, recommended: opt?.recommended === true };
            })
            .filter(Boolean)
            .slice(0, 8);

        if (!question || normalizedOptions.length < 2) continue;
        questions.push({
            id: String(raw?.id || `q_${idx + 1}`).trim() || `q_${idx + 1}`,
            question,
            multiSelect: raw?.multiSelect === true,
            required: raw?.required !== false,
            options: normalizedOptions,
        });
    }
    return questions.slice(0, 8);
}

function buildFallbackClarifyingQuestions(intent = {}) {
    const base = [
        {
            id: 'priority_axis',
            question: 'What should the orchestrator optimize for first?',
            multiSelect: false,
            required: true,
            options: [
                { id: 'ship_fast', label: 'Speed to MVP', description: 'Prefer fastest demo-ready delivery path.', recommended: true },
                { id: 'technical_depth', label: 'Technical depth', description: 'Prefer robust architecture and deeper implementation detail.', recommended: false },
                { id: 'judge_defense', label: 'Judge defense', description: 'Prefer tradeoffs, rationale, and objection handling.', recommended: false },
            ],
        },
        {
            id: 'output_shape',
            question: 'Which output shape should be emphasized?',
            multiSelect: false,
            required: true,
            options: [
                { id: 'implementation_first', label: 'Implementation-first', description: 'Concrete APIs, schema, and execution steps.', recommended: true },
                { id: 'strategy_first', label: 'Strategy-first', description: 'Problem framing, positioning, and evaluation criteria.', recommended: false },
                { id: 'balanced_output', label: 'Balanced', description: 'Equal focus on implementation and strategy.', recommended: false },
            ],
        },
    ];

    if (intent?.isHackathon || intent?.needsCrossQuestionPrep) {
        base.push({
            id: 'demo_mode',
            question: 'How aggressive should demo framing be?',
            multiSelect: false,
            required: false,
            options: [
                { id: 'safe_demo', label: 'Safe and reliable', description: 'Minimize risk and keep flow stable.', recommended: true },
                { id: 'showcase_demo', label: 'High-impact showcase', description: 'Highlight bold differentiators for judges.', recommended: false },
            ],
        });
    }

    return normalizePlannerQuestions(base);
}

// ─── AI planner ───────────────────────────────────────────────────────────────

async function planDeepExecutionWithAI({ prompt, plannerAgent, plannerModel = null, cwd, mcpServers, plannerStyle = 'balanced', plannerNotes = '' }) {
    const style = String(plannerStyle || 'balanced').trim().toLowerCase();
    const notes = String(plannerNotes || '').trim();
    const planningPrompt = [
        'System role: You are an orchestration planner for a multi-agent coding daemon.',
        'Task: Produce an execution plan for deep parallel work. Reply with ONLY valid JSON and no surrounding markdown.',
        `Planning style requested by user: ${style}.`,
        notes ? `User planner notes: ${notes}` : 'User planner notes: none.',
        'Constraints:',
        `- workerCount must be an integer between 1 and ${MAX_DEEP_WORKERS}.`,
        `- specialist names must be chosen from: ${DEFAULT_SPECIALIST_SEQUENCE.join(', ')}.`,
        '- Provide 1 focus sentence per specialist.',
        '- Prefer feasibility and concrete implementation over generic advice.',
        '- If hackathon-like, include defense-oriented preparation cues in policy lines.',
        'JSON schema:',
        '{',
        '  "workerCount": number,',
        '  "intent": {',
        '    "isHackathon": boolean,',
        '    "needsResearch": boolean,',
        '    "needsFeasibility": boolean,',
        '    "needsExecutionPlan": boolean,',
        '    "needsCrossQuestionPrep": boolean,',
        '    "isBroadScope": boolean',
        '  },',
        '  "policyLines": [string, string, ...],',
        '  "specialists": [',
        '    { "name": string, "focus": string }',
        '  ],',
        '  "clarifyingQuestions": [',
        '    {',
        '      "id": string,',
        '      "question": string,',
        '      "multiSelect": boolean,',
        '      "required": boolean,',
        '      "options": [',
        '        { "id": string, "label": string, "description": string, "recommended": boolean }',
        '      ]',
        '    }',
        '  ]',
        '}',
        'User task to plan:',
        prompt,
    ].join('\n');

    const planResult = await runChildAgent({
        agent: plannerAgent,
        prompt: planningPrompt,
        cwd,
        mcpServers,
        model: plannerModel,
    });

    if ((planResult?.code ?? 1) !== 0) {
        return { ok: false, reason: 'planner_non_zero_exit', stderr: planResult?.stderr || '' };
    }

    const parsed = extractJsonObject(planResult?.stdout || '');
    if (!parsed || typeof parsed !== 'object') {
        return { ok: false, reason: 'planner_invalid_json' };
    }

    const requestedCount = Number.parseInt(parsed.workerCount, 10);
    const workerCount = Number.isFinite(requestedCount)
        ? Math.max(1, Math.min(MAX_DEEP_WORKERS, requestedCount))
        : null;
    const specialists = normalizePlannerSpecialists(parsed.specialists, workerCount || DEFAULT_DEEP_WORKERS);
    const intent = normalizePlannerIntent(parsed.intent || {});
    const policyLines = Array.isArray(parsed.policyLines)
        ? parsed.policyLines.map((line) => String(line || '').trim()).filter(Boolean).slice(0, 14)
        : [];
    const clarifyingQuestions = normalizePlannerQuestions(parsed.clarifyingQuestions);

    if (specialists.length === 0) {
        return { ok: false, reason: 'planner_empty_specialists' };
    }

    return {
        ok: true,
        workerCount,
        specialists,
        intent,
        policyLines,
        plannerAgent,
        clarifyingQuestions,
    };
}

// ─── Input utilities ──────────────────────────────────────────────────────────

function createInputAnswerSummary(questions = [], answers = {}) {
    const lines = [];
    for (const q of questions) {
        const selected = Array.isArray(answers?.[q.id]) ? answers[q.id] : [];
        if (selected.length === 0) continue;
        const optionLabels = selected
            .map((id) => q.options.find((opt) => opt.id === id)?.label || id)
            .join(', ');
        lines.push(`- ${q.question}: ${optionLabels}`);
    }
    return lines;
}

async function waitForOrderInput(order, runtime, questions = []) {
    if (!runtime || !Array.isArray(questions) || questions.length === 0) {
        return { answers: {}, timedOut: false, skipped: true };
    }

    return await new Promise((resolve) => {
        const request = {
            questions,
            createdAt: Date.now(),
            resolve,
            timeoutHandle: null,
        };
        runtime.inputRequest = request;

        order.status = 'waiting_input';
        order.pendingQuestions = questions;
        order.pendingAnswers = {};
        pushOrderEvent(order, 'input.requested', { questionCount: questions.length, timeoutMs: 0 });
        void persistOrder(order);
        broadcastOrderUpdate(order);
    });
}

// ─── Artifact persistence ─────────────────────────────────────────────────────

function toTitleToken(text = '') {
    return String(text)
        .split(/[-_\s]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

async function initializeDeepWorkspaceArtifacts(order, workers, workerMeta, executionPolicy) {
    const cwd = resolve(order.cwd || REPO_ROOT);
    const runRoot = join(cwd, '.soupz-runs', order.id);
    if (!isPathInside(cwd, runRoot)) {
        throw new Error('artifact_root_outside_workspace');
    }

    await mkdir(runRoot, { recursive: true });
    const briefPath = join(runRoot, 'RUN_BRIEF.md');
    const sharedPath = join(runRoot, 'SHARED_MEMORY.md');

    const workerPlan = workers.map((w, idx) => {
        const meta = workerMeta[w.workerId] || {};
        return `${idx + 1}. ${w.workerId} (${w.agent}) - specialist: ${meta.specialist || 'developer'} - focus: ${meta.focus || 'implementation guidance'}`;
    }).join('\n');

    const brief = [
        `# Soupz Deep Run ${order.id}`,
        '',
        '## Task',
        summarizePromptForWorkspace(order.prompt),
        '',
        '## Execution Policy',
        executionPolicy,
        '',
        '## Worker Plan',
        workerPlan,
        '',
        '## Notes',
        '- Worker outputs are persisted as markdown files in this folder.',
        '- Nested sub-agent outputs are persisted as parent__nested-*.md files when enabled.',
        '- SHARED_MEMORY.md aggregates distilled learnings from all workers + synthesis.',
    ].join('\n');

    await writeFile(briefPath, brief, 'utf8');
    await writeFile(sharedPath, '# Shared Memory\n\n', 'utf8');

    registerCreatedFile(order, toWorkspaceRelativePath(cwd, briefPath));
    registerCreatedFile(order, toWorkspaceRelativePath(cwd, sharedPath));

    return { cwd, runRoot, briefPath, sharedPath };
}

async function persistWorkerArtifact(order, artifactContext, workerId, agent, workerMetaInfo, result) {
    if (!artifactContext) return;
    const safeWorkerId = String(workerId || 'worker').replace(/[^a-zA-Z0-9-_]/g, '_');
    const safeSpecialist = String(workerMetaInfo?.specialist || 'developer').replace(/[^a-zA-Z0-9-_]/g, '_');
    const workerFile = join(artifactContext.runRoot, `${safeWorkerId}--${safeSpecialist}.md`);
    const body = [
        `# ${safeWorkerId}`,
        '',
        `- Agent: ${agent}`,
        `- Specialist: ${workerMetaInfo?.specialist || 'developer'}`,
        `- Focus: ${workerMetaInfo?.focus || 'implementation guidance'}`,
        `- Exit code: ${result?.code ?? 1}`,
        `- Timed out: ${result?.timedOut ? 'yes' : 'no'}`,
        '',
        '## Output',
        '```text',
        String(result?.stdout || result?.stderr || '').slice(0, 70000),
        '```',
    ].join('\n');

    await writeFile(workerFile, body, 'utf8');
    registerCreatedFile(order, toWorkspaceRelativePath(artifactContext.cwd, workerFile));

    const sharedSnippet = [
        `## ${safeWorkerId}`,
        `Agent: ${agent} | Specialist: ${workerMetaInfo?.specialist || 'developer'} | Exit: ${result?.code ?? 1}`,
        '',
        String(result?.stdout || result?.stderr || '').slice(0, 3000),
        '',
    ].join('\n');
    await writeFile(artifactContext.sharedPath, sharedSnippet, { encoding: 'utf8', flag: 'a' });
}

async function persistNestedWorkerArtifact(order, artifactContext, parentWorkerId, nestedMeta, result) {
    if (!artifactContext) return;
    const safeParent = String(parentWorkerId || 'worker').replace(/[^a-zA-Z0-9-_]/g, '_');
    const safeNested = String(nestedMeta?.nestedId || nestedMeta?.specialist || 'nested').replace(/[^a-zA-Z0-9-_]/g, '_');
    const safeSpecialist = String(nestedMeta?.specialist || 'developer').replace(/[^a-zA-Z0-9-_]/g, '_');
    const nestedFile = join(artifactContext.runRoot, `${safeParent}__nested-${safeNested}--${safeSpecialist}.md`);
    const body = [
        `# Nested ${safeNested}`,
        '',
        `- Parent worker: ${parentWorkerId}`,
        `- Agent: ${nestedMeta?.agent || 'unknown'}`,
        `- Specialist: ${nestedMeta?.specialist || 'developer'}`,
        `- Focus: ${nestedMeta?.focus || 'nested validation'}`,
        `- Exit code: ${result?.code ?? 1}`,
        `- Timed out: ${result?.timedOut ? 'yes' : 'no'}`,
        '',
        '## Output',
        '```text',
        String(result?.stdout || result?.stderr || '').slice(0, 40000),
        '```',
    ].join('\n');

    await writeFile(nestedFile, body, 'utf8');
    registerCreatedFile(order, toWorkspaceRelativePath(artifactContext.cwd, nestedFile));

    const sharedSnippet = [
        `### Nested ${safeNested} (${safeParent})`,
        `Agent: ${nestedMeta?.agent || 'unknown'} | Specialist: ${nestedMeta?.specialist || 'developer'} | Exit: ${result?.code ?? 1}`,
        '',
        String(result?.stdout || result?.stderr || '').slice(0, 2000),
        '',
    ].join('\n');
    await writeFile(artifactContext.sharedPath, sharedSnippet, { encoding: 'utf8', flag: 'a' });
}

async function persistNestedSynthesisArtifact(order, artifactContext, parentWorkerId, synthesis) {
    if (!artifactContext) return;
    const safeParent = String(parentWorkerId || 'worker').replace(/[^a-zA-Z0-9-_]/g, '_');
    const synthPath = join(artifactContext.runRoot, `${safeParent}__nested-team-synthesis.md`);
    const body = [
        `# Nested Team Synthesis (${safeParent})`,
        '',
        `- Agent: ${synthesis?.agent || 'unknown'}`,
        `- Exit code: ${synthesis?.code ?? 1}`,
        '',
        String(synthesis?.stdout || synthesis?.stderr || '').trim() || '_No nested synthesis output produced._',
    ].join('\n');

    await writeFile(synthPath, body, 'utf8');
    registerCreatedFile(order, toWorkspaceRelativePath(artifactContext.cwd, synthPath));

    const sharedSnippet = [
        `## Nested Team Synthesis (${safeParent})`,
        String(synthesis?.stdout || synthesis?.stderr || '').slice(0, 3000),
        '',
    ].join('\n');
    await writeFile(artifactContext.sharedPath, sharedSnippet, { encoding: 'utf8', flag: 'a' });
}

async function persistSynthesisArtifact(order, artifactContext, synthesisText, synthesisMeta = {}) {
    if (!artifactContext) return;
    const synthesisPath = join(artifactContext.runRoot, 'FINAL_SYNTHESIS.md');
    const body = [
        '# Final Synthesis',
        '',
        `- Agent: ${synthesisMeta.agent || 'unknown'}`,
        `- Exit code: ${synthesisMeta.exitCode ?? 1}`,
        `- Fallback used: ${synthesisMeta.fallbackUsed ? 'yes' : 'no'}`,
        '',
        String(synthesisText || '').trim() || '_No synthesis output produced._',
    ].join('\n');

    await writeFile(synthesisPath, body, 'utf8');
    registerCreatedFile(order, toWorkspaceRelativePath(artifactContext.cwd, synthesisPath));

    const sharedSnippet = [
        '## Synthesis',
        String(synthesisText || '').slice(0, 5000),
        '',
    ].join('\n');
    await writeFile(artifactContext.sharedPath, sharedSnippet, { encoding: 'utf8', flag: 'a' });
}

// ─── Nested delegation ────────────────────────────────────────────────────────

async function runNestedDelegationForWorker({
    order,
    runtime,
    worker,
    workerIndex,
    workers,
    workerMetaInfo,
    parentResult,
    executionPolicy,
    sharedMemoryForWorker,
    nestedPolicy,
    nestedReadyAgents,
    mcpServers,
    artifactContext,
}) {
    if (!nestedPolicy?.enabled || !parentResult || parentResult.code !== 0) return null;
    if (runtime?.cancelRequested) return null;

    const parentWorkerId = worker.workerId;
    const parentAgent = worker.agent;
    const nestedPlan = buildNestedSubAgentPlan(workerMetaInfo?.specialist || 'developer', nestedPolicy);
    if (nestedPlan.length === 0) return null;

    const resolveNestedAgent = (targetSpecialist) => {
        const ready = Array.isArray(nestedReadyAgents) ? nestedReadyAgents : [];
        if (ready.length === 0) return parentAgent;
        if (ready.includes(parentAgent) && canAgentHandleSpecialist(parentAgent, targetSpecialist)) {
            return parentAgent;
        }

        const capable = ready.filter((agentId) => canAgentHandleSpecialist(agentId, targetSpecialist));
        return capable[0] || ready[0] || parentAgent;
    };

    pushOrderEvent(order, 'nested.plan', {
        parentWorkerId,
        nestedCount: nestedPlan.length,
        nestedSpecialists: nestedPlan.map((item) => item.specialist),
    });

    const nestedResults = [];
    for (const [nestedIdx, nested] of nestedPlan.entries()) {
        if (runtime?.cancelRequested) break;

        const nestedAgent = resolveNestedAgent(nested.specialist);
        const nestedId = `${parentWorkerId}:${nested.id}`;
        const childKey = `nested:${nestedId}`;

        const nestedPrompt = [
            `You are nested sub-agent ${nestedIdx + 1}/${nestedPlan.length} for parent worker ${workerIndex + 1}/${workers.length}.`,
            `Parent worker id: ${parentWorkerId}. Parent specialist: ${workerMetaInfo?.specialist || 'developer'}.`,
            `Your assigned specialist persona: ${nested.specialist}.`,
            `Focus: ${nested.focus}.`,
            executionPolicy,
            sharedMemoryForWorker
                ? `Shared context snapshot:\n${sharedMemoryForWorker}`
                : 'Shared context snapshot: none.',
            'You must improve or validate the parent output. Be concrete and implementation-oriented.',
            'If you cite numbers or external claims, include URLs and explicitly label assumptions.',
            `Parent worker output:\n${String(parentResult.stdout || parentResult.stderr || '').slice(0, 22000)}`,
            `Original task:\n${order.prompt}`,
        ].join('\n\n');

        pushOrderEvent(order, 'nested.worker.started', {
            parentWorkerId,
            nestedId,
            specialist: nested.specialist,
            agent: nestedAgent,
            index: nestedIdx + 1,
        });

        const nestedResult = await runChildAgent({
            agent: nestedAgent,
            prompt: nestedPrompt,
            cwd: order.cwd,
            mcpServers,
            runtime,
            childKey,
            childMeta: { kind: 'nested', workerId: parentWorkerId, agent: nestedAgent },
            model: getSelectedModelForAgent(order, nestedAgent),
            onStdout: (text, pid) => {
                const tagged = `[nested:${nestedId}|agent:${nestedAgent}] ${text}`;
                order.stdout += tagged;
                if (order.stdout.length > 220000) order.stdout = order.stdout.slice(-220000);
                appendLaneBuffer(order, `nested:${parentWorkerId}`, text);
                pushOrderOutputDelta(order, runtime, `${childKey}:stdout`, 'nested.output.delta', {
                    parentWorkerId,
                    nestedId,
                    agent: nestedAgent,
                    stream: 'stdout',
                    chars: text.length,
                    pid,
                });
            },
            onStderr: (text, pid) => {
                const tagged = `[nested:${nestedId}|agent:${nestedAgent}:stderr] ${text}`;
                order.stderr += tagged;
                if (order.stderr.length > 130000) order.stderr = order.stderr.slice(-130000);
                appendLaneBuffer(order, `nested:${parentWorkerId}`, `[stderr] ${text}`);
                pushOrderOutputDelta(order, runtime, `${childKey}:stderr`, 'nested.output.delta', {
                    parentWorkerId,
                    nestedId,
                    agent: nestedAgent,
                    stream: 'stderr',
                    chars: text.length,
                    pid,
                });
            },
        });
        flushOrderOutputDeltas(order, runtime, `${childKey}:`);

        pushOrderEvent(order, 'nested.worker.finished', {
            parentWorkerId,
            nestedId,
            specialist: nested.specialist,
            agent: nestedAgent,
            exitCode: nestedResult?.code ?? 1,
            reason: nestedResult?.timedOut ? 'timeout' : 'exit',
        });

        const nestedMeta = {
            nestedId,
            specialist: nested.specialist,
            focus: nested.focus,
            agent: nestedAgent,
        };

        try {
            await persistNestedWorkerArtifact(order, artifactContext, parentWorkerId, nestedMeta, nestedResult);
        } catch (err) {
            pushOrderEvent(order, 'artifacts.nested_write_failed', {
                parentWorkerId,
                nestedId,
                message: err?.message || 'nested_artifact_write_failed',
            });
        }

        nestedResults.push({
            ...nestedMeta,
            code: nestedResult?.code ?? 1,
            stdout: nestedResult?.stdout || '',
            stderr: nestedResult?.stderr || '',
        });
    }

    if (nestedResults.length === 0) return null;

    let nestedSynthesis = null;
    if (nestedPolicy.enableTeamSynthesis && !runtime?.cancelRequested) {
        const synthesisAgent = nestedResults.find((r) => r.code === 0)?.agent || parentAgent;
        const synthesisPrompt = [
            'You are a nested team coordinator. Synthesize child sub-agent outputs into one actionable supplement for the parent worker.',
            `Parent worker: ${parentWorkerId} (${workerMetaInfo?.specialist || 'developer'})`,
            'Do not invoke tools. Return concrete implementation deltas and risk checks only.',
            `Original task:\n${order.prompt}`,
            'Nested outputs:',
            ...nestedResults.map((r) => `\n--- ${r.nestedId} via ${r.agent} (exit ${r.code}) ---\n${(r.stdout || r.stderr || '').slice(0, 12000)}`),
        ].join('\n');

        pushOrderEvent(order, 'nested.synthesis.started', { parentWorkerId, agent: synthesisAgent });
        const nestedSynthResult = await runChildAgent({
            agent: synthesisAgent,
            prompt: synthesisPrompt,
            cwd: order.cwd,
            mcpServers,
            runtime,
            childKey: `nested-synthesis:${parentWorkerId}`,
            childMeta: { kind: 'nested-synthesis', workerId: parentWorkerId, agent: synthesisAgent },
            model: getSelectedModelForAgent(order, synthesisAgent),
        });

        nestedSynthesis = {
            agent: synthesisAgent,
            code: nestedSynthResult?.code ?? 1,
            stdout: nestedSynthResult?.stdout || '',
            stderr: nestedSynthResult?.stderr || '',
        };

        pushOrderEvent(order, 'nested.synthesis.finished', {
            parentWorkerId,
            agent: synthesisAgent,
            exitCode: nestedSynthesis.code,
        });

        try {
            await persistNestedSynthesisArtifact(order, artifactContext, parentWorkerId, nestedSynthesis);
        } catch (err) {
            pushOrderEvent(order, 'artifacts.nested_synthesis_write_failed', {
                parentWorkerId,
                message: err?.message || 'nested_synthesis_write_failed',
            });
        }
    }

    const nestedBody = nestedSynthesis && nestedSynthesis.code === 0
        ? (nestedSynthesis.stdout || nestedSynthesis.stderr || '')
        : nestedResults
            .filter((r) => r.code === 0)
            .map((r) => `## ${r.nestedId} (${r.agent})\n${(r.stdout || r.stderr || '').slice(0, 9000)}`)
            .join('\n\n');

    const mergedOutput = [
        String(parentResult.stdout || parentResult.stderr || '').trim(),
        '',
        `### Nested Delegation Summary (${parentWorkerId})`,
        nestedBody || '_No successful nested output._',
    ].join('\n');

    return {
        nestedCount: nestedResults.length,
        nestedSucceeded: nestedResults.filter((r) => r.code === 0).length,
        nestedResults,
        nestedSynthesis,
        mergedOutput,
    };
}

// ─── Deep orchestration entry point ───────────────────────────────────────────

export async function startDeepOrchestratedOrder(order, runAgent, mcpServers) {
    const runtime = createOrderRuntime(order);
    const deepPolicy = order.deepPolicy || {};
    const nestedPolicy = buildNestedPolicy(deepPolicy, Number.isFinite(deepPolicy.workerCount) ? deepPolicy.workerCount : DEFAULT_DEEP_WORKERS);
    const plannerStyle = String(deepPolicy.plannerStyle || 'balanced');
    const plannerNotes = String(deepPolicy.plannerNotes || '');
    const useAiPlanner = deepPolicy.useAiPlanner !== false;
    let planner = null;
    if (useAiPlanner) {
        try {
            planner = await planDeepExecutionWithAI({
                prompt: order.prompt,
                plannerAgent: runAgent,
                plannerModel: getSelectedModelForAgent(order, runAgent),
                cwd: order.cwd,
                mcpServers,
                plannerStyle,
                plannerNotes,
            });
        } catch (err) {
            planner = { ok: false, reason: err?.message || 'planner_exception' };
        }
    }

    const heuristicPolicy = buildDeepExecutionPolicy(order.prompt);
    const promptIntent = planner?.ok ? planner.intent : heuristicPolicy.intent;
    const workerCount = Number.isFinite(deepPolicy.workerCount)
        ? Math.max(1, Math.min(MAX_DEEP_WORKERS, deepPolicy.workerCount))
        : (planner?.ok && Number.isFinite(planner.workerCount)
            ? planner.workerCount
            : estimateDeepWorkerCount(order.prompt, null));
    let executionPolicy = planner?.ok
        ? [
            'Execution policy (AI-planned by orchestrator):',
            ...planner.policyLines,
            '',
            'Output contract:',
            '1) Problem framing + assumptions',
            '2) Feasibility and tradeoffs',
            '3) Technical plan with implementation steps',
            '4) Risks, mitigations, and validation checklist',
            '5) Judge/defense notes (when relevant)',
        ].join('\n')
        : heuristicPolicy.policyText;

    let userClarifications = {};
    const plannerQuestions = (planner?.ok && Array.isArray(planner.clarifyingQuestions) && planner.clarifyingQuestions.length > 0)
        ? planner.clarifyingQuestions
        : [];
    if (plannerQuestions.length > 0) {
        const inputResult = await waitForOrderInput(order, runtime, plannerQuestions, 8 * 60 * 1000);
        if (!inputResult?.timedOut && inputResult?.answers) {
            const answerLines = createInputAnswerSummary(plannerQuestions, inputResult.answers);
            if (answerLines.length > 0) {
                executionPolicy = [
                    executionPolicy,
                    '',
                    'User Clarifications (selected interactively):',
                    ...answerLines,
                ].join('\n');
            }
            userClarifications = inputResult.answers;
        }
    }

    order.deepPolicy = {
        ...deepPolicy,
        useAiPlanner,
        plannerStyle,
        plannerUsed: !!planner?.ok,
        plannerReason: planner?.ok ? 'ok' : (planner?.reason || 'disabled'),
        workerCountResolved: workerCount,
        workerCountMax: MAX_DEEP_WORKERS,
        promptIntent,
        pendingQuestionCount: plannerQuestions.length,
        userClarifications,
        nestedPolicy,
    };
    const { workers, skipped } = selectParallelWorkers(runAgent, workerCount, order.cwd, deepPolicy, order.allowedAgents || null);
    const nestedReadyAgents = getReadyAgentsInPriorityOrder(order.cwd, order.allowedAgents || null).ready;
    const workerAgents = Object.fromEntries(workers.map((w) => [w.workerId, w.agent]));
    const specialistCandidates = planner?.ok
        ? planner.specialists.map((item) => item.name).slice(0, workers.length)
        : inferSpecialistsFromPrompt(order.prompt, workers.length);
    const specialistPlanByWorker = assignSpecialistsToWorkers(workers, specialistCandidates, order.prompt);
    const specialistFocusPlan = planner?.ok
        ? planner.specialists.reduce((acc, item) => {
            acc[item.name] = item.focus || specialistFocusSummary(item.name);
            return acc;
        }, {})
        : {};
    const labelCounts = {};
    const workerMeta = Object.fromEntries(workers.map((w, idx) => {
        const specialist = specialistPlanByWorker[w.workerId] || fallbackSpecialistForAgent(w.agent);
        const focus = specialistFocusSummary(specialist);
        const base = `${toTitleToken(w.agent)} · ${toTitleToken(specialist)}`;
        labelCounts[base] = (labelCounts[base] || 0) + 1;
        const workerLabel = labelCounts[base] > 1 ? `${base} #${labelCounts[base]}` : base;
        return [w.workerId, { workerLabel, specialist, focus }];
    }));
    const workerRoles = Object.fromEntries(workers.map((w) => [
        w.workerId,
        workerMeta[w.workerId]?.specialist || inferExecutionRole(w.agent, order.prompt),
    ]));
    const nestedEligibleWorkers = pickNestedEligibleWorkers(workers, workerMeta, nestedPolicy);
    order.status = 'running';
    order.startedAt = nowIso();
    pushOrderEvent(order, 'parallel.plan', {
        workers: workers.map((w) => w.workerId),
        workerAgents,
        workerRoles,
        workerMeta,
        workerCount: workers.length,
        mode: 'deep',
        deepPolicy: order.deepPolicy,
        nestedEligibleWorkers: Array.from(nestedEligibleWorkers),
        planner: planner?.ok
            ? {
                agent: planner.plannerAgent,
                workerCount: planner.workerCount,
                specialists: planner.specialists,
            }
            : { enabled: useAiPlanner, used: false, reason: planner?.reason || 'disabled' },
        skippedWorkers: skipped,
    });
    void persistOrder(order);
    broadcastOrderUpdate(order);

    let artifactContext = null;
    try {
        artifactContext = await initializeDeepWorkspaceArtifacts(order, workers, workerMeta, executionPolicy);
        pushOrderEvent(order, 'artifacts.initialized', {
            runRoot: toWorkspaceRelativePath(artifactContext.cwd, artifactContext.runRoot),
            brief: toWorkspaceRelativePath(artifactContext.cwd, artifactContext.briefPath),
            sharedMemory: toWorkspaceRelativePath(artifactContext.cwd, artifactContext.sharedPath),
        });
    } catch (err) {
        pushOrderEvent(order, 'artifacts.init_failed', { message: err?.message || 'artifact_init_failed' });
    }

    if (workers.length === 0) {
        order.status = 'failed';
        order.finishedAt = nowIso();
        pushOrderEvent(order, 'order.failed', { mode: 'deep', reason: 'no_ready_workers' });
        void persistOrder(order);
        void archiveOrderResult(order);
        broadcastOrderUpdate(order);
        processOrderQueue();
        return;
    }

    // Hard-disable deep worker timeouts to avoid interrupting long-running tasks.
    const finishedWorkerIds = new Set();
    const workerRuns = workers.map(async (worker, idx) => {
        const { workerId, agent } = worker;
        const childKey = `worker:${workerId}`;
        const meta = workerMeta[workerId] || { workerLabel: workerId, specialist: 'developer', focus: 'deliver concrete implementation guidance' };
        if (specialistFocusPlan[meta.specialist]) {
            meta.focus = specialistFocusPlan[meta.specialist];
        }

        let sharedMemoryForWorker = '';
        if (artifactContext?.sharedPath) {
            try {
                sharedMemoryForWorker = String(await readFile(artifactContext.sharedPath, 'utf8') || '').slice(-12000);
            } catch {
                sharedMemoryForWorker = '';
            }
        }

        const allowExternalResearch = ['researcher', 'analyst', 'finance', 'strategist', 'evaluator'].includes(meta.specialist);
        const workerPrompt = [
            `You are worker ${idx + 1}/${workers.length} (${meta.workerLabel}; id=${workerId}; agent=${agent}).`,
            `Assigned specialist persona: ${meta.specialist}.`,
            `Assigned focus: ${meta.focus}.`,
            executionPolicy,
            sharedMemoryForWorker
                ? `Shared context from SHARED_MEMORY.md (latest snapshot):\n${sharedMemoryForWorker}`
                : 'Shared context from SHARED_MEMORY.md: none yet.',
            'Focus on a distinct implementation strategy and return concrete, actionable output.',
            'If coding is needed, provide exact file paths and code blocks.',
            allowExternalResearch
                ? 'For research/analysis/finance tasks, use web/search tooling if available and cite sources with URLs. Do not fabricate numbers; label assumptions clearly.'
                : 'Return the answer directly. Do not invoke tools, shell commands, file writes, skills, or external actions.',
            'No preamble. No meta commentary. Output only the requested technical content.',
            `Original task:\n${order.prompt}`,
        ].join('\n\n');

        pushOrderEvent(order, 'worker.started', {
            workerId,
            workerLabel: meta.workerLabel,
            specialist: meta.specialist,
            focus: meta.focus,
            agent,
            role: workerRoles[workerId],
            index: idx + 1,
        });
        startWorkerWatchdog(order, runtime, childKey, {
            workerId,
            workerLabel: meta.workerLabel,
            specialist: meta.specialist,
            focus: meta.focus,
            agent,
            role: workerRoles[workerId],
        });

        let result;
        try {
            result = await runChildAgent({
                agent,
                prompt: workerPrompt,
                cwd: order.cwd,
                mcpServers,
                runtime,
                childKey,
                childMeta: { kind: 'worker', workerId, agent },
                model: getSelectedModelForAgent(order, agent),
                onStdout: (text, pid) => {
                    const tagged = `[worker:${workerId}|agent:${agent}] ${text}`;
                    order.stdout += tagged;
                    if (order.stdout.length > 180000) order.stdout = order.stdout.slice(-180000);
                    appendLaneBuffer(order, workerId, `${text}`);
                    pushOrderOutputDelta(order, runtime, `${childKey}:stdout`, 'worker.output.delta', { workerId, agent, stream: 'stdout', chars: text.length, pid });
                    const streamMsg = JSON.stringify({ type: 'agent_chunk', orderId: order.id, chunk: toStreamChunk(tagged), agentId: workerId });
                    for (const client of wss.clients) {
                        if (client.readyState === 1 && authenticatedClients.has(client)) {
                            client.send(streamMsg);
                        }
                    }
                },
                onStderr: (text, pid) => {
                    const tagged = `[worker:${workerId}|agent:${agent}:stderr] ${text}`;
                    order.stderr += tagged;
                    if (order.stderr.length > 120000) order.stderr = order.stderr.slice(-120000);
                    appendLaneBuffer(order, workerId, `[stderr] ${text}`);
                    pushOrderOutputDelta(order, runtime, `${childKey}:stderr`, 'worker.output.delta', { workerId, agent, stream: 'stderr', chars: text.length, pid });
                },
            });
        } catch (err) {
            result = { code: 1, stdout: '', stderr: err.message || 'worker_failed', pid: null, errored: true };
        } finally {
            flushOrderOutputDeltas(order, runtime, `${childKey}:`);
            stopWorkerWatchdog(runtime, childKey);
        }

        let nestedOutcome = null;
        const shouldRunNested = nestedPolicy.enabled
            && nestedEligibleWorkers.has(workerId)
            && !runtime.cancelRequested;

        if (shouldRunNested) {
            try {
                nestedOutcome = await runNestedDelegationForWorker({
                    order,
                    runtime,
                    worker,
                    workerIndex: idx,
                    workers,
                    workerMetaInfo: meta,
                    parentResult: result,
                    executionPolicy,
                    sharedMemoryForWorker,
                    nestedPolicy,
                    nestedReadyAgents,
                    mcpServers,
                    artifactContext,
                });
            } catch (err) {
                pushOrderEvent(order, 'nested.failed', {
                    parentWorkerId: workerId,
                    message: err?.message || 'nested_delegation_failed',
                });
            }
        }

        const resultForWorker = nestedOutcome?.mergedOutput
            ? { ...result, stdout: nestedOutcome.mergedOutput }
            : result;

        const exitCode = resultForWorker?.code ?? 1;
        pushOrderEvent(order, 'worker.finished', {
            workerId,
            workerLabel: meta.workerLabel,
            specialist: meta.specialist,
            focus: meta.focus,
            agent,
            role: workerRoles[workerId],
            exitCode,
            reason: runtime.cancelRequested ? 'cancelled' : (resultForWorker?.timedOut ? 'timeout' : (resultForWorker?.errored ? 'error' : 'exit')),
            nestedCount: nestedOutcome?.nestedCount || 0,
            nestedSucceeded: nestedOutcome?.nestedSucceeded || 0,
        });
        try {
            await persistWorkerArtifact(order, artifactContext, workerId, agent, meta, resultForWorker);
        } catch (err) {
            pushOrderEvent(order, 'artifacts.worker_write_failed', {
                workerId,
                message: err?.message || 'worker_artifact_write_failed',
            });
        }
        finishedWorkerIds.add(workerId);
        return { workerId, agent, ...resultForWorker };
    });

    const workerResults = [];
    const resultsByWorker = new Map();
    const syncResult = (result) => {
        if (!result || !result.workerId) return;
        if (resultsByWorker.has(result.workerId)) return;
        resultsByWorker.set(result.workerId, result);
        workerResults.push(result);
    };

    const all = await Promise.all(workerRuns);
    for (const result of all) syncResult(result);

    for (const worker of workers) {
        if (finishedWorkerIds.has(worker.workerId)) continue;
        const existing = resultsByWorker.get(worker.workerId);
        const meta = workerMeta[worker.workerId] || { workerLabel: worker.workerId, specialist: 'developer', focus: 'deliver concrete implementation guidance' };
        pushOrderEvent(order, 'worker.finished', {
            workerId: worker.workerId,
            workerLabel: meta.workerLabel,
            specialist: meta.specialist,
            focus: meta.focus,
            agent: worker.agent,
            role: workerRoles[worker.workerId],
            exitCode: existing?.code ?? 1,
            reason: 'reconciled_missing_finish',
        });
    }

    const successfulWorkers = workerResults.filter((r) => r.code === 0);
    const primaryWorker = workerResults.find((r) => r.agent === runAgent && r.code === 0);

    pushOrderEvent(order, 'parallel.collected', {
        workerCount: workerResults.length,
        successfulWorkers: successfulWorkers.length,
    });

    if (runtime.cancelRequested && successfulWorkers.length === 0) {
        order.exitCode = 130;
        order.finishedAt = nowIso();
        order.status = 'cancelled';
        order.cancelRequested = true;
        pushOrderEvent(order, 'order.cancelled', { mode: 'deep', reason: runtime.cancelReason || 'cancel_requested' });
        void persistOrder(order);
        void archiveOrderResult(order);
        broadcastOrderUpdate(order);
        cleanupOrderRuntime(order.id);
        return;
    }

    const synthesisAgent = (primaryWorker && primaryWorker.code === 0)
        ? runAgent
        : (successfulWorkers[0]?.agent || workers[0]?.agent || runAgent);

    let sharedMemoryExcerpt = '';
    if (artifactContext?.sharedPath) {
        try {
            sharedMemoryExcerpt = String(await readFile(artifactContext.sharedPath, 'utf8') || '').slice(0, 60000);
        } catch {
            sharedMemoryExcerpt = '';
        }
    }

    const synthesisPrompt = [
        'You are the lead synthesizer. Merge worker outputs into a single final answer.',
        executionPolicy,
        'Prioritize correctness, concrete file paths, and executable steps.',
        'Do not invoke tools, shell commands, file writes, skills, or external actions. Synthesize directly from provided worker outputs.',
        `Original task:\n${order.prompt}`,
        sharedMemoryExcerpt
            ? `Shared memory aggregate (from SHARED_MEMORY.md):\n${sharedMemoryExcerpt}`
            : 'Shared memory aggregate: unavailable',
        'Worker outputs:',
        ...workerResults.map((r) => `\n--- ${r.workerId} via ${r.agent} (exit ${r.code}) ---\n${(r.stdout || r.stderr || '').slice(0, 40000)}`),
    ].join('\n');

    pushOrderEvent(order, 'synthesis.started', { agent: synthesisAgent, role: 'lead-synthesizer' });
    const synth = await runChildAgent({
        agent: synthesisAgent,
        prompt: synthesisPrompt,
        cwd: order.cwd,
        mcpServers,
        runtime,
        childKey: 'synthesis',
        childMeta: { kind: 'synthesis', agent: synthesisAgent },
        model: getSelectedModelForAgent(order, synthesisAgent),
        onStdout: (text, pid) => {
            const tagged = `[synthesis:${synthesisAgent}] ${text}`;
            order.stdout += tagged;
            if (order.stdout.length > 200000) order.stdout = order.stdout.slice(-200000);
            appendLaneBuffer(order, 'synthesis', `${text}`);
            pushOrderOutputDelta(order, runtime, 'synthesis:stdout', 'synthesis.output.delta', { stream: 'stdout', chars: text.length, pid });
            const streamMsg = JSON.stringify({ type: 'agent_chunk', orderId: order.id, chunk: toStreamChunk(tagged), agentId: synthesisAgent });
            for (const client of wss.clients) {
                if (client.readyState === 1 && authenticatedClients.has(client)) {
                    client.send(streamMsg);
                }
            }
        },
        onStderr: (text, pid) => {
            order.stderr += text;
            if (order.stderr.length > 120000) order.stderr = order.stderr.slice(-120000);
            appendLaneBuffer(order, 'synthesis', `[stderr] ${text}`);
            pushOrderOutputDelta(order, runtime, 'synthesis:stderr', 'synthesis.output.delta', { stream: 'stderr', chars: text.length, pid });
        },
    });
    flushOrderOutputDeltas(order, runtime, 'synthesis:');

    const canFallbackComplete = deepPolicy.allowSynthesisFallback !== false
        && synth.code !== 0
        && successfulWorkers.length > 0;

    if (canFallbackComplete) {
        const ranked = [...successfulWorkers]
            .sort((a, b) => (b.stdout || '').length - (a.stdout || '').length)
            .slice(0, Math.min(3, successfulWorkers.length));
        const fallbackBody = ranked
            .map((r) => `## ${r.workerId} (${r.agent})\n${(r.stdout || r.stderr || '').slice(0, 12000)}`)
            .join('\n\n');
        const fallbackText = [
            '[synthesis:fallback] Primary synthesis timed out/failed; returning deterministic merge of successful worker outputs.',
            fallbackBody,
        ].join('\n\n');

        order.stdout += `\n${fallbackText}`;
        if (order.stdout.length > 200000) order.stdout = order.stdout.slice(-200000);
        appendLaneBuffer(order, 'synthesis', fallbackText);
        pushOrderEvent(order, 'synthesis.fallback.used', {
            synthesisExitCode: synth.code,
            selectedWorkers: ranked.map((r) => r.workerId),
        });
    }

    const synthesisText = canFallbackComplete
        ? [
            '[synthesis:fallback] Primary synthesis timed out/failed; deterministic merge below.',
            ...successfulWorkers.slice(0, 3).map((r) => `\n## ${r.workerId} (${r.agent})\n${(r.stdout || r.stderr || '').slice(0, 12000)}`),
        ].join('\n')
        : (synth.stdout || synth.stderr || '');
    try {
        await persistSynthesisArtifact(order, artifactContext, synthesisText, {
            agent: synthesisAgent,
            exitCode: canFallbackComplete ? 0 : synth.code,
            fallbackUsed: canFallbackComplete,
        });
    } catch (err) {
        pushOrderEvent(order, 'artifacts.synthesis_write_failed', {
            message: err?.message || 'synthesis_artifact_write_failed',
        });
    }

    const finalSynthesisExitCode = canFallbackComplete ? 0 : synth.code;
    pushOrderEvent(order, 'synthesis.finished', { agent: synthesisAgent, role: 'lead-synthesizer', exitCode: finalSynthesisExitCode });

    order.exitCode = finalSynthesisExitCode;
    order.finishedAt = nowIso();
    if (finalSynthesisExitCode === 0) {
        order.status = 'completed';
        pushOrderEvent(order, 'order.completed', {
            exitCode: finalSynthesisExitCode,
            mode: 'deep',
            workers: workers.map((w) => w.workerId),
            fallbackUsed: canFallbackComplete,
            synthesisExitCode: synth.code,
            successfulWorkers: successfulWorkers.length,
            createdFiles: order.createdFiles || [],
        });
    } else if (runtime.cancelRequested) {
        order.status = 'cancelled';
        order.cancelRequested = true;
        pushOrderEvent(order, 'order.cancelled', { exitCode: finalSynthesisExitCode, mode: 'deep', reason: runtime.cancelReason || 'cancel_requested' });
    } else {
        order.status = 'failed';
        pushOrderEvent(order, 'order.failed', { exitCode: finalSynthesisExitCode, mode: 'deep', workers: workers.map((w) => w.workerId) });
    }

    void persistOrder(order);
    void archiveOrderResult(order);
    broadcastOrderUpdate(order);
    processOrderQueue();
    cleanupOrderRuntime(order.id);
}
