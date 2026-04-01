import { describe, it, expect } from 'vitest';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname || '.', '..');
const DASH = resolve(ROOT, 'packages/dashboard/src');

let agents;
let routing;

describe('Module loading', () => {
  it('loads agents.js', async () => {
    agents = await import(resolve(DASH, 'lib/agents.js'));
    expect(agents).toBeDefined();
  });

  it('loads routing.js', async () => {
    routing = await import(resolve(DASH, 'lib/routing.js'));
    expect(routing).toBeDefined();
  });
});

// --- Copilot Agent Definition ---
describe('Copilot agent definition', () => {
  it('copilot exists in CLI_AGENTS', () => {
    const copilot = agents.CLI_AGENTS.find(a => a.id === 'copilot');
    expect(copilot).toBeDefined();
  });

  it('copilot has correct tier', () => {
    const copilot = agents.CLI_AGENTS.find(a => a.id === 'copilot');
    expect(copilot.tier).toBe('freemium');
  });

  it('copilot has freeModel defined', () => {
    const copilot = agents.CLI_AGENTS.find(a => a.id === 'copilot');
    expect(copilot.freeModel).toBeDefined();
    expect(typeof copilot.freeModel).toBe('string');
  });

  it('copilot has models array', () => {
    const copilot = agents.CLI_AGENTS.find(a => a.id === 'copilot');
    expect(Array.isArray(copilot.models)).toBe(true);
  });
});

// --- Codex Agent Definition ---
describe('Codex agent definition', () => {
  it('codex exists in CLI_AGENTS', () => {
    const codex = agents.CLI_AGENTS.find(a => a.id === 'codex');
    expect(codex).toBeDefined();
  });

  it('codex has freemium tier and freeModel', () => {
    const codex = agents.CLI_AGENTS.find(a => a.id === 'codex');
    expect(codex.tier).toBe('freemium');
    expect(typeof codex.freeModel).toBe('string');
    expect(codex.freeModel.length).toBeGreaterThan(0);
  });
});

// --- All CLI Agent Definitions ---
describe('CLI agent definitions', () => {
  it('all agents have id, name, tier', () => {
    for (const agent of agents.CLI_AGENTS) {
      expect(agent.id).toBeDefined();
      expect(typeof agent.id).toBe('string');
      expect(agent.name).toBeDefined();
      expect(typeof agent.name).toBe('string');
      expect(agent.tier).toBeDefined();
      expect(['free', 'freemium', 'premium']).toContain(agent.tier);
    }
  });

  it('free/freemium agents have freeModel', () => {
    for (const agent of agents.CLI_AGENTS) {
      if (agent.tier === 'free' || agent.tier === 'freemium') {
        expect(agent.freeModel).toBeDefined();
      }
    }
  });

  it('gemini is free tier', () => {
    const gemini = agents.CLI_AGENTS.find(a => a.id === 'gemini');
    expect(gemini.tier).toBe('free');
  });

  it('claude-code is premium tier', () => {
    const claude = agents.CLI_AGENTS.find(a => a.id === 'claude-code');
    expect(claude.tier).toBe('premium');
  });

  it('ollama is free tier', () => {
    const ollama = agents.CLI_AGENTS.find(a => a.id === 'ollama');
    expect(ollama.tier).toBe('free');
  });

  it('gemini has multiple models', () => {
    const gemini = agents.CLI_AGENTS.find(a => a.id === 'gemini');
    expect(gemini.models.length).toBeGreaterThanOrEqual(2);
    for (const model of gemini.models) {
      expect(model.id).toBeDefined();
      expect(model.name).toBeDefined();
    }
  });
});

// --- Model Selection Logic ---
describe('Model selection for task types', () => {
  it('selects copilot for github/PR tasks', () => {
    const result = routing.selectAgentLocally(
      'open a pull request and review the diff',
      { copilot: true, gemini: true }
    );
    expect(result.cliAgent).toBe('copilot');
  });

  it('selects gemini for research/analysis tasks', () => {
    const result = routing.selectAgentLocally(
      'search the web and analyze market data trends',
      { copilot: true, gemini: true }
    );
    expect(result.cliAgent).toBe('gemini');
  });

  it('falls back gracefully when preferred agent unavailable', () => {
    // Kiro is best for AWS, but if unavailable should fall back
    const result = routing.selectAgentLocally(
      'deploy to AWS Lambda with terraform',
      { gemini: true, copilot: true }
    );
    expect(result.cliAgent).not.toBe('kiro');
    expect(['gemini', 'copilot']).toContain(result.cliAgent);
  });

  it('returns valid agent even for empty prompt', () => {
    const result = routing.selectAgentLocally('', { gemini: true });
    expect(result).toBeDefined();
    expect(result.cliAgent).toBe('gemini');
  });

  it('can route coding/refactor prompts to codex when available', () => {
    const result = routing.selectAgentLocally(
      'refactor this TypeScript module and fix the bug',
      { codex: true, gemini: true, copilot: true }
    );
    expect(['codex', 'claude-code']).toContain(result.cliAgent);
  });
});

// --- Agent Fallback Chain ---
describe('Agent fallback chain', () => {
  it('falls back when only one agent available', () => {
    const result = routing.selectAgentLocally(
      'deploy to kubernetes',
      { ollama: true }
    );
    expect(result.cliAgent).toBe('ollama');
  });

  it('skips unavailable agents', () => {
    const result = routing.selectAgentLocally(
      'review code for security',
      { gemini: true }
    );
    expect(result.cliAgent).toBe('gemini');
    expect(result.cliAgent).not.toBe('claude-code');
  });

  it('handles all agents available', () => {
    const all = { gemini: true, codex: true, copilot: true, ollama: true, 'claude-code': true, kiro: true };
    const result = routing.selectAgentLocally('fix the login bug', all);
    expect(result).toBeDefined();
    expect(agents.CLI_AGENTS.map(a => a.id)).toContain(result.cliAgent);
  });
});

// --- Specialist Selection ---
describe('Specialist selection', () => {
  it('SPECIALISTS array has categories', () => {
    const categories = new Set(agents.SPECIALISTS.map(s => s.category));
    expect(categories.size).toBeGreaterThan(1);
  });

  it('specialists have valid temperature', () => {
    for (const spec of agents.SPECIALISTS) {
      if (spec.temperature !== undefined) {
        expect(spec.temperature).toBeGreaterThanOrEqual(0);
        expect(spec.temperature).toBeLessThanOrEqual(1);
      }
    }
  });

  it('specialists have valid maxTokens when set', () => {
    for (const spec of agents.SPECIALISTS) {
      if (spec.maxTokens !== undefined) {
        expect(spec.maxTokens).toBeGreaterThan(0);
      }
    }
  });

  it('getAgentById resolves specialist', () => {
    if (agents.getAgentById) {
      const dev = agents.getAgentById('dev');
      expect(dev).toBeDefined();
      expect(dev.id).toBe('dev');
    }
  });
});

// --- Install Guides ---
describe('Agent install guides', () => {
  it('AGENT_INSTALL_GUIDES exists', () => {
    if (agents.AGENT_INSTALL_GUIDES) {
      expect(typeof agents.AGENT_INSTALL_GUIDES).toBe('object');
      // Should have entries for known agents
      const keys = Object.keys(agents.AGENT_INSTALL_GUIDES);
      expect(keys.length).toBeGreaterThan(0);
    }
  });

  it('includes codex install guide', () => {
    if (agents.AGENT_INSTALL_GUIDES) {
      expect(agents.AGENT_INSTALL_GUIDES.codex).toBeDefined();
      expect(typeof agents.AGENT_INSTALL_GUIDES.codex.cmd).toBe('string');
    }
  });
});
