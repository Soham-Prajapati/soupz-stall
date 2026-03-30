import { describe, it, expect } from 'vitest';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname || '.', '..');
const DASH = resolve(ROOT, 'packages/dashboard/src');

let teams;
let routing;
let agents;

// Load modules once
describe('Module loading', () => {
  it('loads teams.js', async () => {
    teams = await import(resolve(DASH, 'lib/teams.js'));
    expect(teams).toBeDefined();
  });

  it('loads routing.js', async () => {
    routing = await import(resolve(DASH, 'lib/routing.js'));
    expect(routing).toBeDefined();
  });

  it('loads agents.js', async () => {
    agents = await import(resolve(DASH, 'lib/agents.js'));
    expect(agents).toBeDefined();
  });
});

// --- detectTeamTrigger ---
describe('detectTeamTrigger', () => {
  it('detects "full review" trigger', () => {
    const result = teams.detectTeamTrigger('do a full review of the auth module');
    expect(result).not.toBeNull();
    expect(result.teamId).toBe('full-review');
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('detects "code review" trigger', () => {
    const result = teams.detectTeamTrigger('please code review this PR');
    expect(result).not.toBeNull();
    expect(result.teamId).toBe('full-review');
  });

  it('detects "build feature" trigger', () => {
    const result = teams.detectTeamTrigger('build feature: user dashboard with charts');
    expect(result).not.toBeNull();
    expect(result.teamId).toBe('feature-build');
  });

  it('detects "ux audit" trigger', () => {
    const result = teams.detectTeamTrigger('run a ux audit on the landing page');
    expect(result).not.toBeNull();
    expect(result.teamId).toBe('ux-audit');
  });

  it('detects "ship ready" trigger', () => {
    const result = teams.detectTeamTrigger('is this ship ready? check everything');
    expect(result).not.toBeNull();
    expect(result.teamId).toBe('ship-check');
  });

  it('detects "launch check" trigger', () => {
    const result = teams.detectTeamTrigger('run a pre-launch check on the app');
    expect(result).not.toBeNull();
    expect(result.teamId).toBe('ship-check');
  });

  it('returns null for simple prompts', () => {
    expect(teams.detectTeamTrigger('hello world')).toBeNull();
    expect(teams.detectTeamTrigger('write a function')).toBeNull();
    expect(teams.detectTeamTrigger('fix the bug')).toBeNull();
  });

  it('returns null for empty prompt', () => {
    expect(teams.detectTeamTrigger('')).toBeNull();
  });

  it('is case insensitive', () => {
    const result = teams.detectTeamTrigger('FULL REVIEW of everything');
    expect(result).not.toBeNull();
    expect(result.teamId).toBe('full-review');
  });
});

// --- createTeamPlan ---
describe('createTeamPlan', () => {
  it('returns valid plan for full-review', () => {
    const plan = teams.createTeamPlan(
      'full-review',
      'Review the auth module for vulnerabilities',
      { gemini: true, copilot: true }
    );
    expect(plan).not.toBeNull();
    expect(plan.teamId).toBe('full-review');
    expect(plan.name).toBeDefined();
    expect(plan.strategy).toBeDefined();
    expect(['parallel', 'sequential', 'pipeline']).toContain(plan.strategy);
    expect(Array.isArray(plan.tasks)).toBe(true);
    expect(plan.tasks.length).toBeGreaterThan(0);
    expect(plan.coordinator).toBeDefined();
  });

  it('returns valid plan for feature-build', () => {
    const plan = teams.createTeamPlan(
      'feature-build',
      'Build a user settings page with profile editing',
      { gemini: true }
    );
    expect(plan).not.toBeNull();
    expect(plan.teamId).toBe('feature-build');
    expect(plan.tasks.length).toBeGreaterThan(0);
  });

  it('returns valid plan for ux-audit', () => {
    const plan = teams.createTeamPlan(
      'ux-audit',
      'Audit the mobile experience',
      { gemini: true, copilot: true }
    );
    expect(plan).not.toBeNull();
    expect(plan.teamId).toBe('ux-audit');
  });

  it('returns valid plan for ship-check', () => {
    const plan = teams.createTeamPlan(
      'ship-check',
      'Check if we are ready to deploy v2',
      { gemini: true }
    );
    expect(plan).not.toBeNull();
    expect(plan.teamId).toBe('ship-check');
  });

  it('tasks have required fields', () => {
    const plan = teams.createTeamPlan(
      'full-review',
      'Review the code',
      { gemini: true }
    );
    if (plan) {
      for (const task of plan.tasks) {
        expect(task.subAgentId || task.agentId || task.role).toBeDefined();
        expect(task.prompt || task.description).toBeDefined();
      }
    }
  });

  it('returns null for unknown team', () => {
    const plan = teams.createTeamPlan(
      'nonexistent-team',
      'do something',
      { gemini: true }
    );
    expect(plan).toBeNull();
  });

  it('works with single available agent', () => {
    const plan = teams.createTeamPlan(
      'full-review',
      'Review code',
      { copilot: true }
    );
    // Should still create a plan, using copilot for all tasks
    expect(plan).not.toBeNull();
    if (plan) {
      for (const task of plan.tasks) {
        if (task.agentId) {
          expect(task.agentId).toBe('copilot');
        }
      }
    }
  });
});

// --- Model Selection via Routing ---
describe('Model selection (selectAgentLocally)', () => {
  const allAgents = { gemini: true, copilot: true, ollama: true, 'claude-code': true, kiro: true };

  it('picks appropriate agent for code prompts', () => {
    const result = routing.selectAgentLocally(
      'fix the bug in the authentication middleware and write tests',
      allAgents
    );
    expect(result).toBeDefined();
    expect(result.cliAgent).toBeDefined();
    // Should be a valid agent ID
    expect(agents.CLI_AGENTS.map(a => a.id)).toContain(result.cliAgent);
  });

  it('picks appropriate agent for research prompts', () => {
    const result = routing.selectAgentLocally(
      'research the latest trends in web development and compare frameworks',
      allAgents
    );
    expect(result).toBeDefined();
    expect(result.cliAgent).toBeDefined();
  });

  it('picks appropriate agent for GitHub prompts', () => {
    const result = routing.selectAgentLocally(
      'create a pull request for this branch and add reviewers',
      { gemini: true, copilot: true }
    );
    expect(result).toBeDefined();
    // Copilot should score high for GitHub-related prompts
    expect(result.cliAgent).toBe('copilot');
  });

  it('picks appropriate agent for AWS prompts', () => {
    const result = routing.selectAgentLocally(
      'deploy this to AWS Lambda and configure S3 bucket',
      { gemini: true, copilot: true, kiro: true }
    );
    expect(result).toBeDefined();
    // Kiro should score high for AWS prompts
    expect(result.cliAgent).toBe('kiro');
  });

  it('picks appropriate agent for local/offline prompts', () => {
    const result = routing.selectAgentLocally(
      'run this locally with no api calls, use local model',
      { gemini: true, ollama: true }
    );
    expect(result).toBeDefined();
    // Ollama should score high for local/offline
    expect(result.cliAgent).toBe('ollama');
  });

  it('returns fallback when no agents match', () => {
    const result = routing.selectAgentLocally('hello', { gemini: true });
    expect(result).toBeDefined();
    expect(result.cliAgent).toBe('gemini');
  });

  it('respects available agents filter', () => {
    const result = routing.selectAgentLocally(
      'deploy to AWS Lambda',
      { gemini: true, copilot: true }
      // kiro not available
    );
    expect(result).toBeDefined();
    // Should NOT pick kiro since it's not available
    expect(result.cliAgent).not.toBe('kiro');
  });
});

// --- Tier Cooldowns ---
describe('Tier cooldowns', () => {
  it('agent not cooling down by default', () => {
    expect(routing.isAgentCoolingDown('gemini-test-cooldown')).toBe(false);
  });

  it('reportRateLimit triggers cooldown', () => {
    routing.reportRateLimit('test-cd-agent');
    expect(routing.isAgentCoolingDown('test-cd-agent')).toBe(true);
  });

  it('selectAgentLocally still returns a valid agent when one is cooling down', () => {
    routing.reportRateLimit('gemini');
    const result = routing.selectAgentLocally(
      'search and analyze data trends',
      { gemini: true, copilot: true }
    );
    expect(result).toBeDefined();
    // Should still return a valid agent (may deprioritize but not block)
    expect(['gemini', 'copilot']).toContain(result.cliAgent);
  });
});

// --- detectIntent ---
describe('detectIntent', () => {
  it('detects code intent', () => {
    if (routing.detectIntent) {
      const intent = routing.detectIntent('build a REST API with authentication');
      expect(intent.category).toBe('code');
    }
  });

  it('detects design intent', () => {
    if (routing.detectIntent) {
      const intent = routing.detectIntent('design a beautiful UI with color palette and layout');
      expect(intent.category).toBe('design');
    }
  });

  it('detects research intent', () => {
    if (routing.detectIntent) {
      const intent = routing.detectIntent('analyze market trends and compare competitors');
      expect(intent.category).toBe('research');
    }
  });

  it('detects complexity levels', () => {
    if (routing.detectIntent) {
      const simple = routing.detectIntent('fix bug');
      expect(simple.complexity).toBe('simple');

      const complex = routing.detectIntent(
        'Build a comprehensive authentication system with OAuth2, JWT tokens, ' +
        'refresh token rotation, rate limiting, and session management. ' +
        'Also add role-based access control and audit logging. ' +
        'Design the database schema and write API documentation.'
      );
      expect(['medium', 'complex']).toContain(complex.complexity);
    }
  });
});

// --- Agent team definitions ---
describe('Agent team definitions', () => {
  it('all 4 teams exist', () => {
    const teamIds = teams.AGENT_TEAMS.map(t => t.id);
    expect(teamIds).toContain('full-review');
    expect(teamIds).toContain('feature-build');
    expect(teamIds).toContain('ux-audit');
    expect(teamIds).toContain('ship-check');
  });

  it('all 8 sub-agents exist', () => {
    expect(teams.SUB_AGENTS.length).toBeGreaterThanOrEqual(8);
    const ids = teams.SUB_AGENTS.map(s => s.id);
    expect(ids).toContain('code-reviewer');
    expect(ids).toContain('test-writer');
    expect(ids).toContain('researcher');
    expect(ids).toContain('security-scanner');
  });

  it('teams have valid strategies', () => {
    for (const team of teams.AGENT_TEAMS) {
      expect(team.strategy || team.members || team.roles).toBeDefined();
    }
  });

  it('sub-agents have timeouts', () => {
    for (const sub of teams.SUB_AGENTS) {
      if (sub.timeout) {
        expect(sub.timeout).toBeGreaterThan(0);
        expect(sub.timeout).toBeLessThanOrEqual(180000); // Max 3 min
      }
    }
  });
});

// --- scoreAgentForPrompt ---
describe('scoreAgentForPrompt', () => {
  it('scores higher for keyword matches', () => {
    if (routing.scoreAgentForPrompt) {
      const copilotScore = routing.scoreAgentForPrompt(
        'create a github pull request and merge the branch',
        'copilot'
      );
      const geminiScore = routing.scoreAgentForPrompt(
        'create a github pull request and merge the branch',
        'gemini'
      );
      expect(copilotScore).toBeGreaterThan(geminiScore);
    }
  });

  it('returns 0 for no keyword matches', () => {
    if (routing.scoreAgentForPrompt) {
      const score = routing.scoreAgentForPrompt('xyzzy foobar baz', 'copilot');
      expect(score).toBe(0);
    }
  });

  it('scores are between 0 and 100', () => {
    if (routing.scoreAgentForPrompt) {
      const score = routing.scoreAgentForPrompt(
        'deploy lambda s3 terraform cdk kubernetes docker container infra',
        'kiro'
      );
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });
});
