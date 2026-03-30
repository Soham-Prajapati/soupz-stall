/**
 * Sub-agents & Agent Teams — orchestration primitives for Soupz
 *
 * Sub-agents: Isolated task contractors. Fire-and-forget with a focused task.
 *   They do the work and return the result without cluttering the orchestrator's context.
 *
 * Agent Teams: Persistent collaborative workers. They share context, coordinate,
 *   and adapt as the work evolves.
 */

import { CLI_AGENTS, SPECIALISTS } from './agents.js';
import { selectAgentLocally } from './routing.js';

// ─── Sub-Agent Definitions ──────────────────────────────────────────────────

/**
 * @typedef {Object} SubAgent
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {string} defaultCliAgent - preferred CLI agent to run this sub-agent
 * @property {string} specialist - specialist persona to use
 * @property {string} promptTemplate - template with {{task}} placeholder
 * @property {number} timeoutMs - max execution time
 * @property {boolean} parallel - can run in parallel with others
 */

export const SUB_AGENTS = [
  {
    id: 'code-reviewer',
    name: 'Code Reviewer',
    description: 'Reviews code for bugs, security issues, and best practices',
    defaultCliAgent: 'gemini',
    specialist: 'security',
    promptTemplate: 'Review this code critically. Focus on bugs, security vulnerabilities, and anti-patterns. Be specific with line numbers and fixes.\n\n{{task}}',
    timeoutMs: 60000,
    parallel: true,
  },
  {
    id: 'test-writer',
    name: 'Test Writer',
    description: 'Generates comprehensive test cases',
    defaultCliAgent: 'gemini',
    specialist: 'qa',
    promptTemplate: 'Write comprehensive tests for the following. Include edge cases, error scenarios, and integration tests.\n\n{{task}}',
    timeoutMs: 90000,
    parallel: true,
  },
  {
    id: 'researcher',
    name: 'Researcher',
    description: 'Researches external information, APIs, libraries',
    defaultCliAgent: 'gemini',
    specialist: 'researcher',
    promptTemplate: 'Research the following topic thoroughly. Provide current, accurate information with sources where possible.\n\n{{task}}',
    timeoutMs: 45000,
    parallel: true,
  },
  {
    id: 'refactorer',
    name: 'Refactorer',
    description: 'Refactors code for clarity, performance, and maintainability',
    defaultCliAgent: 'gemini',
    specialist: 'architect',
    promptTemplate: 'Refactor this code for better clarity, performance, and maintainability. Explain each change.\n\n{{task}}',
    timeoutMs: 90000,
    parallel: false,
  },
  {
    id: 'doc-writer',
    name: 'Doc Writer',
    description: 'Generates documentation, READMEs, API docs',
    defaultCliAgent: 'gemini',
    specialist: 'techwriter',
    promptTemplate: 'Write clear, comprehensive documentation for the following. Include examples and usage patterns.\n\n{{task}}',
    timeoutMs: 60000,
    parallel: true,
  },
  {
    id: 'ui-critic',
    name: 'UI Critic',
    description: 'Reviews UI/UX and suggests improvements',
    defaultCliAgent: 'gemini',
    specialist: 'ux-designer',
    promptTemplate: 'Critically review this UI/UX. Identify issues with usability, accessibility, visual hierarchy, and suggest specific improvements.\n\n{{task}}',
    timeoutMs: 45000,
    parallel: true,
  },
  {
    id: 'perf-auditor',
    name: 'Performance Auditor',
    description: 'Analyzes performance bottlenecks and optimization opportunities',
    defaultCliAgent: 'gemini',
    specialist: 'dev',
    promptTemplate: 'Audit this for performance. Identify bottlenecks, memory leaks, unnecessary re-renders, and suggest optimizations with benchmarks.\n\n{{task}}',
    timeoutMs: 60000,
    parallel: true,
  },
  {
    id: 'security-scanner',
    name: 'Security Scanner',
    description: 'Scans for security vulnerabilities and compliance issues',
    defaultCliAgent: 'gemini',
    specialist: 'security',
    promptTemplate: 'Perform a security audit. Check for OWASP top 10 vulnerabilities, authentication issues, data exposure, and injection risks.\n\n{{task}}',
    timeoutMs: 60000,
    parallel: true,
  },
];

// ─── Agent Team Definitions ─────────────────────────────────────────────────

/**
 * @typedef {Object} AgentTeam
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {string[]} members - sub-agent ids that form this team
 * @property {string} coordinator - the lead agent that synthesizes results
 * @property {'parallel'|'sequential'|'pipeline'} strategy
 * @property {string} promptTemplate - coordinator prompt template
 */

export const AGENT_TEAMS = [
  {
    id: 'full-review',
    name: 'Full Code Review',
    description: 'Comprehensive code review: security, tests, performance, docs',
    members: ['code-reviewer', 'test-writer', 'perf-auditor', 'security-scanner'],
    coordinator: 'gemini',
    strategy: 'parallel',
    promptTemplate: 'You are the lead reviewer. Synthesize these review results into a unified, prioritized action plan:\n\n{{results}}',
  },
  {
    id: 'feature-build',
    name: 'Feature Builder',
    description: 'End-to-end feature development: research, code, test, document',
    members: ['researcher', 'refactorer', 'test-writer', 'doc-writer'],
    coordinator: 'gemini',
    strategy: 'pipeline',
    promptTemplate: 'You are the lead developer. Based on the research and implementation, create a polished feature with tests and docs:\n\n{{results}}',
  },
  {
    id: 'ux-audit',
    name: 'UX Audit Team',
    description: 'Complete UX review: UI critique, accessibility, performance',
    members: ['ui-critic', 'perf-auditor', 'researcher'],
    coordinator: 'gemini',
    strategy: 'parallel',
    promptTemplate: 'You are the UX lead. Synthesize the UI review, performance audit, and research into a prioritized UX improvement plan:\n\n{{results}}',
  },
  {
    id: 'ship-check',
    name: 'Ship Readiness',
    description: 'Pre-launch checklist: security, tests, docs, performance',
    members: ['security-scanner', 'test-writer', 'doc-writer', 'perf-auditor'],
    coordinator: 'gemini',
    strategy: 'parallel',
    promptTemplate: 'You are the release manager. Based on all audits, provide a ship/no-ship recommendation with blockers and nice-to-haves:\n\n{{results}}',
  },
];

// ─── Orchestration Engine ────────────────────────────────────────────────────

/**
 * Create a sub-agent task ready for dispatch.
 * @param {string} subAgentId
 * @param {string} task - the specific task/code to process
 * @param {Record<string,boolean>} availableAgents - which CLI agents are installed
 * @returns {{ agentId: string, specialist: string, prompt: string, timeout: number } | null}
 */
export function createSubAgentTask(subAgentId, task, availableAgents = {}) {
  const subAgent = SUB_AGENTS.find(s => s.id === subAgentId);
  if (!subAgent) return null;

  // Resolve which CLI agent to use — prefer the sub-agent's default, fall back to available
  let agentId = subAgent.defaultCliAgent;
  if (availableAgents && Object.keys(availableAgents).length > 0) {
    if (!availableAgents[agentId]) {
      // Default not available — use routing to find best available
      const { cliAgent } = selectAgentLocally(task, availableAgents);
      agentId = cliAgent;
    }
  }

  const prompt = subAgent.promptTemplate.replace('{{task}}', task);

  return {
    subAgentId: subAgent.id,
    agentId,
    specialist: subAgent.specialist,
    prompt,
    timeout: subAgent.timeoutMs,
    parallel: subAgent.parallel,
  };
}

/**
 * Create a team execution plan.
 * @param {string} teamId
 * @param {string} task - the overall task
 * @param {Record<string,boolean>} availableAgents
 * @returns {{ team: AgentTeam, tasks: Array, coordinator: { agentId: string, prompt: string } } | null}
 */
export function createTeamPlan(teamId, task, availableAgents = {}, customPrompts = {}) {
  const team = AGENT_TEAMS.find(t => t.id === teamId);
  if (!team) return null;

  const tasks = team.members
    .map(memberId => createSubAgentTask(memberId, task, availableAgents))
    .filter(Boolean);

  // Apply custom prompts per sub-agent
  for (const planTask of tasks) {
    if (customPrompts[planTask.subAgentId]) {
      planTask.prompt += `\n\nADDITIONAL INSTRUCTIONS: ${customPrompts[planTask.subAgentId]}`;
    }
  }

  // Resolve coordinator agent
  let coordinatorAgent = team.coordinator;
  if (availableAgents && Object.keys(availableAgents).length > 0 && !availableAgents[coordinatorAgent]) {
    const { cliAgent } = selectAgentLocally(task, availableAgents);
    coordinatorAgent = cliAgent;
  }

  return {
    teamId: team.id,
    name: team.name,
    strategy: team.strategy,
    tasks,
    coordinator: {
      agentId: coordinatorAgent,
      promptTemplate: team.promptTemplate,
    },
  };
}

/**
 * Execute a sub-agent task via the daemon.
 * @param {Function} sendPrompt - workspace.sendPrompt function
 * @param {Object} task - from createSubAgentTask
 * @param {Function} onChunk - streaming callback
 * @returns {Promise<string>} - the complete response
 */
export async function executeSubAgent(sendPrompt, task, onChunk) {
  let result = '';
  let timedOut = false;
  let warningEmitted = false;

  const timeoutPromise = new Promise((resolve) => {
    const timer = setTimeout(() => {
      timedOut = true;
      // Return partial output with timeout indicator instead of rejecting
      resolve({
        isPartial: true,
        timedOut: true,
        output: result,
        message: `Sub-agent ${task.subAgentId} timed out after ${task.timeout}ms with partial output`
      });
    }, task.timeout);

    // Emit warning at 80% of timeout
    const warningTimer = setTimeout(() => {
      if (!warningEmitted) {
        warningEmitted = true;
        onChunk?.(`[⚠️ Timeout warning: ${task.subAgentId} approaching limit at ${(task.timeout * 0.8 / 1000).toFixed(0)}s]`, false);
      }
    }, task.timeout * 0.8);
  });

  const execPromise = new Promise((resolve, reject) => {
    sendPrompt(
      { prompt: task.prompt, agentId: task.agentId, buildMode: 'quick' },
      (chunk, done) => {
        result += chunk;
        onChunk?.(chunk, done);
        if (done) {
          resolve({
            isPartial: false,
            timedOut: false,
            output: result
          });
        }
      }
    ).catch(reject);
  });

  try {
    const outcome = await Promise.race([execPromise, timeoutPromise]);
    if (outcome.timedOut) {
      throw new Error(outcome.message);
    }
    const finalResult = outcome.output || result;

    // Quick quality check (heuristics only, no extra API call)
    const hasContent = finalResult.trim().length > 50;
    const hasError = /error|exception|failed|cannot|unable/i.test(finalResult.slice(0, 200));

    if (!hasContent || (hasError && finalResult.trim().length < 200)) {
      task._verificationStatus = 'low-quality';
      task._verificationNote = !hasContent ? 'Output too short' : 'Possible error in output';
    } else {
      task._verificationStatus = 'passed';
    }

    return finalResult;
  } catch (err) {
    // If error occurred, return what we have collected so far
    if (result.trim()) {
      return result + `\n\n[Execution interrupted: ${err.message}]`;
    }
    throw err;
  }
}

/**
 * Execute a full team workflow.
 * @param {Function} sendPrompt
 * @param {Object} plan - from createTeamPlan
 * @param {Function} onProgress - (phase, subAgentId, chunk) => void
 * @returns {Promise<{ results: Record<string,string>, synthesis: string }>}
 */
export async function executeTeam(sendPrompt, plan, onProgress) {
  const results = {};

  if (plan.strategy === 'parallel') {
    // Run all sub-agents in parallel
    const promises = plan.tasks.map(async (task) => {
      onProgress?.('sub-agent-start', task.subAgentId, '');
      try {
        const result = await executeSubAgent(sendPrompt, task, (chunk) => {
          onProgress?.('sub-agent-chunk', task.subAgentId, chunk);
        });
        results[task.subAgentId] = result;
        onProgress?.('sub-agent-done', task.subAgentId, result);
      } catch (err) {
        results[task.subAgentId] = `Error: ${err.message}`;
        if (err.message.includes('timed out')) task._timedOut = true;
        onProgress?.('sub-agent-error', task.subAgentId, err.message);
      }
    });
    await Promise.allSettled(promises);
  } else if (plan.strategy === 'sequential' || plan.strategy === 'pipeline') {
    // Run sub-agents one at a time, piping context forward
    for (const task of plan.tasks) {
      onProgress?.('sub-agent-start', task.subAgentId, '');
      // In pipeline mode, append previous results to the prompt
      if (plan.strategy === 'pipeline' && Object.keys(results).length > 0) {
        const prevContext = Object.entries(results)
          .map(([id, r]) => `[${id}]:\n${r}`)
          .join('\n\n---\n\n');
        task.prompt += `\n\nPrevious results:\n${prevContext}`;
      }
      try {
        const result = await executeSubAgent(sendPrompt, task, (chunk) => {
          onProgress?.('sub-agent-chunk', task.subAgentId, chunk);
        });
        results[task.subAgentId] = result;
        onProgress?.('sub-agent-done', task.subAgentId, result);
      } catch (err) {
        results[task.subAgentId] = `Error: ${err.message}`;
        if (err.message.includes('timed out')) task._timedOut = true;
        onProgress?.('sub-agent-error', task.subAgentId, err.message);
      }
    }
  }

  // Coordinator synthesis — merge all successful sub-agent outputs
  onProgress?.('coordinator-start', plan.coordinator.agentId, '');

  // Separate successful results from failed/timed-out ones
  const successfulResults = [];
  const failedAgents = [];
  const timedOutAgents = [];

  Object.entries(results).forEach(([id, result]) => {
    if (typeof result === 'string') {
      if (result.includes('timed out')) {
        // Extract partial output if present
        const hasPartial = result.includes('[Execution interrupted:');
        timedOutAgents.push({ id, timedOut: true, hasPartial, partial: result });
        if (hasPartial) {
          successfulResults.push({ id, result });
        }
      } else if (result.startsWith('Error:')) {
        failedAgents.push({ id, error: result });
      } else {
        successfulResults.push({ id, result });
      }
    } else {
      successfulResults.push({ id, result });
    }
  });

  // Build structured results text with clear labels
  const resultsText = [
    ...successfulResults.map(({ id, result }) => `### Worker: ${id}\n${result}`),
    ...(timedOutAgents.length > 0 ? [
      '\n---\n### Timed Out Workers (with partial output)',
      ...timedOutAgents
        .filter(a => a.hasPartial)
        .map(({ id, partial }) => `- ${id}: [TIMEOUT - partial output above]`)
    ] : []),
    ...(timedOutAgents.length > 0 ? [
      '### Timed Out Workers (no output)',
      ...timedOutAgents
        .filter(a => !a.hasPartial)
        .map(({ id }) => `- ${id}: [TIMEOUT - no output]`)
    ] : []),
    ...(failedAgents.length > 0 ? [
      '\n---\n### Failed Workers',
      ...failedAgents.map(({ id, error }) => `- ${id}: ${error}`)
    ] : [])
  ].join('\n\n');

  let coordinatorPrompt = plan.coordinator.promptTemplate.replace('{{results}}', resultsText);

  // Add verification status summary so coordinator can weigh results accordingly
  const verificationNotes = Object.entries(results)
    .map(([id]) => {
      const task = plan.tasks.find(t => t.subAgentId === id);
      const status = task?._verificationStatus || 'unknown';
      const note = task?._verificationNote || '';
      return `${id}: ${status}${note ? ` (${note})` : ''}`;
    })
    .join('\n');

  coordinatorPrompt += `\n\nVERIFICATION STATUS:\n${verificationNotes}\n`;
  coordinatorPrompt += '\nPrioritize outputs that passed verification. Note any low-quality results.';

  let synthesis = '';
  try {
    synthesis = await executeSubAgent(sendPrompt, {
      subAgentId: 'coordinator',
      agentId: plan.coordinator.agentId,
      prompt: coordinatorPrompt,
      timeout: 180000,
    }, (chunk) => {
      onProgress?.('coordinator-chunk', plan.coordinator.agentId, chunk);
    });
  } catch (err) {
    synthesis = `Coordinator error: ${err.message}\n\nFallback: Merging all successful results.\n\n${resultsText}`;
  }
  onProgress?.('coordinator-done', plan.coordinator.agentId, synthesis);

  return {
    results: Object.fromEntries(
      Object.entries(results).map(([id, output]) => {
        const task = plan.tasks.find(t => t.subAgentId === id);
        return [id, {
          output,
          status: task?._verificationStatus || 'unknown',
          agent: task?.agentId,
          timedOut: task?._timedOut || false,
        }];
      })
    ),
    synthesis,
    teamId: plan.teamId,
    strategy: plan.strategy,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function getSubAgentById(id) {
  return SUB_AGENTS.find(s => s.id === id) || null;
}

export function getTeamById(id) {
  return AGENT_TEAMS.find(t => t.id === id) || null;
}

/**
 * Detect if a prompt should trigger a team workflow.
 * @param {string} prompt
 * @returns {{ teamId: string, confidence: number } | null}
 */
export function detectTeamTrigger(prompt) {
  const lower = prompt.toLowerCase();

  const triggers = [
    { teamId: 'full-review', keywords: ['full review', 'code review', 'review everything', 'comprehensive review', 'audit code'], threshold: 1 },
    { teamId: 'feature-build', keywords: ['build feature', 'implement feature', 'end to end', 'full feature', 'research and build'], threshold: 1 },
    { teamId: 'ux-audit', keywords: ['ux audit', 'ux review', 'ui review', 'usability review', 'accessibility audit'], threshold: 1 },
    { teamId: 'ship-check', keywords: ['ship ready', 'pre-launch', 'launch check', 'release ready', 'ship checklist', 'ready to deploy'], threshold: 1 },
  ];

  for (const trigger of triggers) {
    const hits = trigger.keywords.filter(kw => lower.includes(kw)).length;
    if (hits >= trigger.threshold) {
      return { teamId: trigger.teamId, confidence: Math.min(hits / trigger.keywords.length, 1) };
    }
  }

  return null;
}
