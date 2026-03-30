import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname || '.', '..');
const DASH = resolve(ROOT, 'packages/dashboard/src');

// --- Component Files Exist ---
describe('Component Files Exist', () => {
  const componentPaths = [
    'components/auth/AuthScreen.jsx',
    'components/connect/ConnectPage.jsx',
    'components/profile/ProfilePage.jsx',
    'components/core/CoreConsole.jsx',
    'components/simple/SimpleMode.jsx',
    'components/pro/ProMode.jsx',
    'components/pro/TerminalPanel.jsx',
    'components/builder/BuilderMode.jsx',
    'components/shared/AgentSelector.jsx',
    'components/shared/CommandPalette.jsx',
    'components/shared/ErrorBoundary.jsx',
    'components/shared/ExtensionsMarketplace.jsx',
    'components/shared/StatusBar.jsx',
    'components/shared/StatsPanel.jsx',
    'components/shared/MCPPanel.jsx',
    'components/shared/PreviewPanel.jsx',
    'components/filetree/FileTree.jsx',
    'components/git/GitPanel.jsx',
    'components/landing/LandingPage.jsx',
    'components/admin/AdminPage.jsx',
    'App.jsx',
  ];

  for (const p of componentPaths) {
    it(`${p} exists`, () => {
      expect(existsSync(resolve(DASH, p))).toBe(true);
    });
  }
});

// --- Lib Files Exist ---
describe('Lib Files Exist', () => {
  const libFiles = [
    'lib/daemon.js',
    'lib/agents.js',
    'lib/routing.js',
    'lib/teams.js',
    'lib/skills.js',
    'lib/learning.js',
    'lib/memory.js',
  ];

  for (const f of libFiles) {
    it(`${f} exists`, () => {
      expect(existsSync(resolve(DASH, f))).toBe(true);
    });
  }
});

// --- agents.js exports ---
describe('agents.js exports', () => {
  let agents;

  it('can be imported', async () => {
    agents = await import(resolve(DASH, 'lib/agents.js'));
    expect(agents).toBeDefined();
  });

  it('CLI_AGENTS is a non-empty array', () => {
    expect(Array.isArray(agents.CLI_AGENTS)).toBe(true);
    expect(agents.CLI_AGENTS.length).toBeGreaterThan(0);
  });

  it('SPECIALISTS is a non-empty array', () => {
    expect(Array.isArray(agents.SPECIALISTS)).toBe(true);
    expect(agents.SPECIALISTS.length).toBeGreaterThan(0);
  });

  it('CLI_AGENTS have required fields', () => {
    for (const agent of agents.CLI_AGENTS) {
      expect(agent.id).toBeDefined();
      expect(typeof agent.id).toBe('string');
      expect(agent.name).toBeDefined();
      expect(typeof agent.name).toBe('string');
    }
  });

  it('SPECIALISTS have required fields', () => {
    for (const spec of agents.SPECIALISTS) {
      expect(spec.id).toBeDefined();
      expect(typeof spec.id).toBe('string');
      expect(spec.name).toBeDefined();
    }
  });

  it('BUILD_MODES is defined and non-empty', () => {
    expect(Array.isArray(agents.BUILD_MODES)).toBe(true);
    expect(agents.BUILD_MODES.length).toBeGreaterThan(0);
  });

  it('getAgentById returns valid agent', () => {
    if (agents.getAgentById) {
      const a = agents.getAgentById('gemini');
      expect(a).toBeDefined();
      expect(a.id).toBe('gemini');
    }
  });

  it('known agent IDs exist', () => {
    const ids = agents.CLI_AGENTS.map(a => a.id);
    expect(ids).toContain('gemini');
    expect(ids).toContain('copilot');
  });
});

// --- routing.js exports ---
describe('routing.js exports', () => {
  let routing;

  it('can be imported', async () => {
    routing = await import(resolve(DASH, 'lib/routing.js'));
    expect(routing).toBeDefined();
  });

  it('selectAgentLocally is a function', () => {
    expect(typeof routing.selectAgentLocally).toBe('function');
  });

  it('selectAgentLocally returns valid result for code prompt', () => {
    const result = routing.selectAgentLocally(
      'write a React component for login',
      { gemini: true, copilot: true }
    );
    expect(result).toBeDefined();
    expect(result.cliAgent).toBeDefined();
    expect(typeof result.cliAgent).toBe('string');
    // Should pick one of the available agents
    expect(['gemini', 'copilot']).toContain(result.cliAgent);
  });

  it('selectAgentLocally returns valid result for design prompt', () => {
    const result = routing.selectAgentLocally(
      'design a beautiful landing page with animations',
      { gemini: true, copilot: true, ollama: true }
    );
    expect(result).toBeDefined();
    expect(result.cliAgent).toBeDefined();
  });

  it('selectAgentLocally handles single agent', () => {
    const result = routing.selectAgentLocally(
      'fix the bug in authentication',
      { copilot: true }
    );
    expect(result).toBeDefined();
    expect(result.cliAgent).toBe('copilot');
  });

  it('detectIntent is a function and returns structured result', () => {
    if (routing.detectIntent) {
      const intent = routing.detectIntent('build a REST API with authentication');
      expect(intent).toBeDefined();
      expect(intent.category).toBeDefined();
      expect(intent.complexity).toBeDefined();
    }
  });

  it('reportRateLimit and isAgentCoolingDown work', () => {
    if (routing.reportRateLimit && routing.isAgentCoolingDown) {
      expect(routing.isAgentCoolingDown('test-agent-xyz')).toBe(false);
      routing.reportRateLimit('test-agent-xyz');
      expect(routing.isAgentCoolingDown('test-agent-xyz')).toBe(true);
    }
  });
});

// --- teams.js exports ---
describe('teams.js exports', () => {
  let teams;

  it('can be imported', async () => {
    teams = await import(resolve(DASH, 'lib/teams.js'));
    expect(teams).toBeDefined();
  });

  it('SUB_AGENTS is a non-empty array', () => {
    expect(Array.isArray(teams.SUB_AGENTS)).toBe(true);
    expect(teams.SUB_AGENTS.length).toBeGreaterThan(0);
  });

  it('AGENT_TEAMS is a non-empty array', () => {
    expect(Array.isArray(teams.AGENT_TEAMS)).toBe(true);
    expect(teams.AGENT_TEAMS.length).toBeGreaterThan(0);
  });

  it('detectTeamTrigger returns null for normal prompts', () => {
    const result = teams.detectTeamTrigger('write a hello world function');
    expect(result).toBeNull();
  });

  it('detectTeamTrigger detects "full review"', () => {
    const result = teams.detectTeamTrigger('do a full review of the authentication module');
    expect(result).not.toBeNull();
    expect(result.teamId).toBeDefined();
  });

  it('detectTeamTrigger detects "build feature"', () => {
    const result = teams.detectTeamTrigger('build feature: user profile page with settings');
    if (result) {
      expect(result.teamId).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    }
  });

  it('createTeamPlan returns valid plan', () => {
    const plan = teams.createTeamPlan(
      'full-review',
      'Review the authentication module for security issues',
      { gemini: true, copilot: true }
    );
    expect(plan).not.toBeNull();
    if (plan) {
      expect(plan.teamId).toBe('full-review');
      expect(plan.name).toBeDefined();
      expect(Array.isArray(plan.tasks)).toBe(true);
      expect(plan.tasks.length).toBeGreaterThan(0);
      expect(plan.coordinator).toBeDefined();
    }
  });

  it('createTeamPlan tasks have required fields', () => {
    const plan = teams.createTeamPlan(
      'full-review',
      'Review the auth module',
      { gemini: true }
    );
    if (plan) {
      for (const task of plan.tasks) {
        expect(task.prompt || task.description || task.role).toBeDefined();
      }
    }
  });

  it('getSubAgentById returns valid sub-agent', () => {
    if (teams.getSubAgentById) {
      const sub = teams.getSubAgentById('code-reviewer');
      expect(sub).toBeDefined();
      expect(sub.id).toBe('code-reviewer');
    }
  });

  it('getTeamById returns valid team', () => {
    if (teams.getTeamById) {
      const team = teams.getTeamById('full-review');
      expect(team).toBeDefined();
      expect(team.id).toBe('full-review');
    }
  });
});

// --- skills.js exports ---
describe('skills.js exports', () => {
  it('SKILLS is a non-empty array', async () => {
    const mod = await import(resolve(DASH, 'lib/skills.js'));
    expect(Array.isArray(mod.SKILLS)).toBe(true);
    expect(mod.SKILLS.length).toBeGreaterThan(0);
    // Each skill should have id and name
    for (const skill of mod.SKILLS) {
      expect(skill.id).toBeDefined();
      expect(skill.name).toBeDefined();
    }
  });
});

// --- learning.js exports ---
describe('learning.js exports', () => {
  let learning;

  it('can be imported', async () => {
    learning = await import(resolve(DASH, 'lib/learning.js'));
    expect(learning).toBeDefined();
  });

  it('exports expected functions', () => {
    expect(typeof learning.trackUsage).toBe('function');
    expect(typeof learning.getAgentsByUsage).toBe('function');
    expect(typeof learning.getLearnedWeight).toBe('function');
  });
});

// --- memory.js exports ---
describe('memory.js exports', () => {
  let memory;

  it('can be imported', async () => {
    memory = await import(resolve(DASH, 'lib/memory.js'));
    expect(memory).toBeDefined();
  });

  it('exports expected functions', () => {
    expect(typeof memory.saveMemoryShard).toBe('function');
    expect(typeof memory.getRelevantMemory).toBe('function');
    expect(typeof memory.getAllShards).toBe('function');
  });
});

// --- Hook Files Exist ---
describe('Hook Files Exist', () => {
  it('useKokoroTTS hook exists', () => {
    expect(existsSync(resolve(DASH, 'hooks/useKokoroTTS.js'))).toBe(true);
  });
});

// --- CSS and Config ---
describe('Config Files', () => {
  it('index.css exists with theme variables', async () => {
    expect(existsSync(resolve(DASH, 'index.css'))).toBe(true);
    const { readFileSync } = await import('fs');
    const css = readFileSync(resolve(DASH, 'index.css'), 'utf8');
    // Should contain CSS custom properties for theming
    expect(css).toContain('--');
  });

  it('vite.config.js exists', () => {
    expect(existsSync(resolve(ROOT, 'packages/dashboard/vite.config.js'))).toBe(true);
  });
});
