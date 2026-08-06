import { describe, expect, it, vi } from 'vitest';
import { parseMonitoringCommand } from '../src/session/command-parser.js';
import { Session } from '../src/session/index.js';
import {
  createMeter,
  indicatesNeedsInput,
  recordAgentRunState,
  recordSessionInput,
  renderFleetView,
  renderMeterView,
} from '../src/session/monitoring.js';
import { COMMANDS } from '../src/session/ui.js';

describe('session monitoring command parser', () => {
  it('recognizes exact meter and fleet view commands', () => {
    expect(parseMonitoringCommand('/meter')).toBe('meter');
    expect(parseMonitoringCommand('  /fleet   view  ')).toBe('fleet-view');
  });

  it('does not turn fleet prompts into a view command', () => {
    expect(parseMonitoringCommand('/fleet view the logs')).toBeNull();
    expect(parseMonitoringCommand('/fleet')).toBeNull();
    expect(parseMonitoringCommand('/tokens')).toBeNull();
  });

  it('dispatches fleet view before the generic fleet prompt handler', async () => {
    const session = Object.create(Session.prototype);
    session.meter = createMeter(1_000);
    session.totalPromptsSent = 0;
    session.showFleetView = vi.fn();
    session.spawnFleet = vi.fn();

    await session.handleInput('/fleet view');

    expect(session.showFleetView).toHaveBeenCalledOnce();
    expect(session.spawnFleet).not.toHaveBeenCalled();
    expect(session.meter.commands).toBe(1);
  });
});

describe('session meter', () => {
  it('reports observed session data and marks unavailable provider data explicitly', () => {
    const meter = createMeter(1_000);
    recordSessionInput(meter, 'review the pull request');
    recordSessionInput(meter, '/meter');
    recordAgentRunState(meter, 'codex', 'running', 2_000);
    recordAgentRunState(meter, 'codex', 'done', 6_200);

    const view = renderMeterView(meter, 11_000);
    expect(view).toContain('Soupz CLI meter');
    expect(view).toContain('Session: 10s');
    expect(view).toContain('Prompts: 1  ·  REPL commands: 1');
    expect(view).toContain('1 started  ·  1 completed  ·  0 failed  ·  0 active');
    expect(view).toContain('Observed agent time: 4s');
    expect(view).toContain('Provider tokens: unavailable');
    expect(view).toContain('Provider cost: unavailable');
  });

  it('counts a run terminal transition once and ignores orphan terminal events', () => {
    const meter = createMeter(1_000);

    expect(recordAgentRunState(meter, 'codex', 'done', 1_500)).toBe(false);
    expect(recordAgentRunState(meter, 'codex', 'running', 2_000)).toBe(true);
    expect(recordAgentRunState(meter, 'codex', 'running', 2_100)).toBe(false);
    expect(recordAgentRunState(meter, 'codex', 'error', 2_500)).toBe(true);
    expect(recordAgentRunState(meter, 'codex', 'done', 2_600)).toBe(false);

    expect(meter.agentRunsStarted).toBe(1);
    expect(meter.agentRunsCompleted).toBe(0);
    expect(meter.agentRunsFailed).toBe(1);
    expect(meter.agentRunMilliseconds).toBe(500);
  });

  it('only displays provider token and cost values marked as provider telemetry', () => {
    const meter = createMeter(1_000);
    meter.providerUsage = {
      source: 'provider',
      inputTokens: 1_250,
      outputTokens: 300,
      costUsd: 0.0042,
    };

    const view = renderMeterView(meter, 2_000);
    expect(view).toContain('Provider tokens: 1,250 input  ·  300 output');
    expect(view).toContain('Provider cost: $0.0042');
  });
});

describe('fleet view', () => {
  it('recognizes explicit interactive prompts without treating ordinary questions as blocked', () => {
    expect(indicatesNeedsInput('Waiting for user input before continuing')).toBe(true);
    expect(indicatesNeedsInput('Confirm deployment? [y/n]')).toBe(true);
    expect(indicatesNeedsInput('What architecture should the report recommend?')).toBe(false);
  });

  it('has stable empty sections', () => {
    expect(renderFleetView([], [], 10_000)).toBe([
      'Fleet view',
      '  Agents: 0 total  ·  0 needs input  ·  0 running  ·  0 completed  ·  0 failed  ·  0 unknown',
      '  Agents: none',
      '  Runs: none',
    ].join('\n'));
  });

  it('shows state counts, sorts needs-input first, truncates failures inline, and aligns age', () => {
    const view = renderFleetView([
      { id: 'active-1', agent: 'codex', status: 'running', startTime: 8_000, task: 'Implement parser' },
      { id: 'failed-1', agent: 'gemini', status: 'failed', startTime: 1_000, duration: 2_500, task: 'Check docs', error: 'process exited because the provider returned a deliberately very long diagnostic message that must stay inline' },
      { id: 'waiting-1', agent: 'claude-code', status: 'needs-input', startTime: 9_000, task: 'Approve migration' },
    ], [
      { id: 'run-1', status: 'failed', startedAt: 1_000, finishedAt: 3_500, workerIds: ['failed-1'], error: 'synthesis failed' },
    ], 10_000, 100);

    expect(view).toContain('Agents: 3 total  ·  1 needs input  ·  1 running  ·  0 completed  ·  1 failed');
    expect(view.indexOf('waiting-1')).toBeLessThan(view.indexOf('active-1'));
    expect(view.indexOf('active-1')).toBeLessThan(view.indexOf('failed-1'));
    const failedLine = view.split('\n').find((line) => line.includes('failed-1'));
    expect(failedLine).toContain('error: process exited');
    expect(failedLine).not.toContain('must stay inline');
    expect(failedLine).toHaveLength(100);
    expect(failedLine).toMatch(/2s$/);
    expect(view).toContain('Runs (1):');
    expect(view).toContain('run-1');
  });

  it('labels incomplete worker data as unknown instead of inventing state or timing', () => {
    const view = renderFleetView([{ id: 'partial' }], [{ id: 'run-partial' }], 10_000);
    expect(view).toContain('unknown      partial');
    expect(view).toContain('unknown-agent');
    expect(view).toContain('run-partial');
    expect(view).toContain('workers unknown');
  });
});

describe('REPL help', () => {
  it('advertises meter and fleet view', () => {
    expect(COMMANDS.find((command) => command.cmd === '/meter')?.desc).toContain('measured session');
    expect(COMMANDS.find((command) => command.cmd === '/fleet view')?.desc).toContain('active and recent');
  });

  it('dispatches the non-executing commands documented in the replacement guide', async () => {
    const session = Object.create(Session.prototype);
    session.meter = createMeter(1_000);
    session.totalPromptsSent = 0;
    session.showToolAgents = vi.fn();
    session.showPersonas = vi.fn();
    session.switchTool = vi.fn();
    session.handleModel = vi.fn();
    session.showRecipes = vi.fn();
    session.showFleetView = vi.fn();
    session.listFleetRuns = vi.fn();
    session.showMeter = vi.fn();
    session.showPantry = vi.fn();
    session.pantryStore = vi.fn();
    session.pantryRecall = vi.fn();
    session.listSessions = vi.fn();
    session.showVersion = vi.fn();

    await session.handleInput('/kitchen');
    await session.handleInput('/agents');
    await session.handleInput('/station codex');
    await session.handleInput('/model definitely-not-a-model');
    await session.handleInput('/auto');
    await session.handleInput('/recipe list');
    await session.handleInput('/fleet view');
    await session.handleInput('/fleet runs');
    await session.handleInput('/meter');
    await session.handleInput('/pantry');
    await session.handleInput('/stock store guide-verification-marker');
    await session.handleInput('/stock recall guide-verification-marker');
    await session.handleInput('/sessions');
    await session.handleInput('/version');

    expect(session.showToolAgents).toHaveBeenCalledOnce();
    expect(session.showPersonas).toHaveBeenCalledOnce();
    expect(session.switchTool).toHaveBeenNthCalledWith(1, 'codex');
    expect(session.switchTool).toHaveBeenNthCalledWith(2, 'auto');
    expect(session.handleModel).toHaveBeenCalledWith('/model definitely-not-a-model');
    expect(session.showRecipes).toHaveBeenCalledOnce();
    expect(session.showFleetView).toHaveBeenCalledOnce();
    expect(session.listFleetRuns).toHaveBeenCalledOnce();
    expect(session.showMeter).toHaveBeenCalledOnce();
    expect(session.showPantry).toHaveBeenCalledOnce();
    expect(session.pantryStore).toHaveBeenCalledWith('guide-verification-marker');
    expect(session.pantryRecall).toHaveBeenCalledWith('guide-verification-marker');
    expect(session.listSessions).toHaveBeenCalledOnce();
    expect(session.showVersion).toHaveBeenCalledOnce();
  });

  it('implements the advertised REPL version command', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    Session.prototype.showVersion();

    expect(log.mock.calls.flat().join('\n')).toContain('soupz-cli v0.2.0');
    log.mockRestore();
  });

  it('does not advertise the stale personas or pantry-bank commands', () => {
    expect(COMMANDS.some(({ cmd }) => cmd === '/personas')).toBe(false);
    expect(COMMANDS.some(({ cmd }) => cmd.startsWith('/pantry bank'))).toBe(false);
  });
});
