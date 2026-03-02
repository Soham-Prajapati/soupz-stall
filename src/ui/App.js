import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import Banner from './Banner.js';
import StatusBar from './StatusBar.js';
import AgentPanel from './AgentPanel.js';
import LogPanel from './LogPanel.js';
import PromptInput from './PromptInput.js';

const e = React.createElement;

const HELP_TEXT = [
    '┌─────────────────────── SOUPZ AGENTS HELP ───────────────────────┐',
    '│  Tab ........... Switch focus between agents                    │',
    '│  Ctrl+O ........ Toggle thinking/reasoning output               │',
    '│  m ............. Cycle mode: ORCHESTRATE → FOCUS → MONITOR      │',
    '│  1-4 ........... Focus agent by number                          │',
    '│  0 ............. Show all agents                                │',
    '│  q ............. Quit soupz-agents                              │',
    '│  @agent <prompt> Target specific agent (e.g. @gemini explain)  │',
    '│  /compress ..... Compress context now                           │',
    '│  /grades ....... Show agent report cards                        │',
    '│  /memory ....... Show memory stats                              │',
    '│  /personas ..... List persona agents                            │',
    '│  ? ............. Show this help                                  │',
    '└────────────────────────────────────────────────────────────────-─┘',
];

export default function App({ registry, spawner, orchestrator, contextManager, memory, grading, version }) {
    const { exit } = useApp();
    const [agents, setAgents] = useState(registry.list());
    const [logs, setLogs] = useState([]);
    const [focusedAgent, setFocusedAgent] = useState(null);
    const [promptValue, setPromptValue] = useState('');
    const [mode, setMode] = useState('ORCHESTRATE');
    const [showThinking, setShowThinking] = useState(false);
    const [showBanner, setShowBanner] = useState(true);
    const [sessionStart] = useState(Date.now());

    // NO setInterval — only update agents on events
    const refreshAgents = () => setAgents([...registry.list()]);

    // Wire spawner events
    useEffect(() => {
        const onOutput = (agentId, parsed) => {
            if (parsed?.text) {
                setLogs((prev) => [...prev.slice(-300),
                { agent: agentId, type: parsed.type, text: parsed.text, time: Date.now() }]);
                refreshAgents();
            }
        };
        const onStatusChange = (agentId, newState) => {
            setLogs((prev) => [...prev.slice(-300),
            { agent: 'system', type: 'status', text: `${agentId} → ${newState}`, time: Date.now() }]);
            refreshAgents();
            if (newState === 'done' || newState === 'error') {
                const agent = registry.get(agentId);
                const elapsed = agent?.startTime ? Date.now() - agent.startTime : 0;
                grading?.recordResult(agentId, newState === 'done', elapsed);
            }
        };
        const onRoute = (info) => {
            setLogs((prev) => [...prev.slice(-300),
            {
                agent: 'system', type: 'status',
                text: `🎯 ${info.reason} → @${info.agent}`, time: Date.now()
            }]);
        };

        spawner.on('output', onOutput);
        spawner.on('status-change', onStatusChange);
        orchestrator.on('route', onRoute);
        return () => {
            spawner.off('output', onOutput);
            spawner.off('status-change', onStatusChange);
            orchestrator.off('route', onRoute);
        };
    }, []);

    // Keyboard shortcuts
    useInput((input, key) => {
        if (input === 'q' && !key.ctrl) { spawner.killAll(); exit(); }
        if (input === '1') setFocusedAgent(agents[0]?.id || null);
        if (input === '2') setFocusedAgent(agents[1]?.id || null);
        if (input === '3') setFocusedAgent(agents[2]?.id || null);
        if (input === '4') setFocusedAgent(agents[3]?.id || null);
        if (input === '0') setFocusedAgent(null);
        if (key.tab) {
            const ids = agents.map((a) => a.id);
            const idx = ids.indexOf(focusedAgent);
            setFocusedAgent(ids[(idx + 1) % ids.length]);
        }
        if (input === 'm') {
            setMode((p) => p === 'ORCHESTRATE' ? 'FOCUS' : p === 'FOCUS' ? 'MONITOR' : 'ORCHESTRATE');
        }
        if (key.ctrl && input === 'o') {
            setShowThinking((p) => !p);
            setLogs((prev) => [...prev,
            {
                agent: 'system', type: 'status',
                text: `💭 Thinking ${!showThinking ? 'on' : 'off'}`, time: Date.now()
            }]);
        }
    });

    const handleSubmit = useCallback(async (text) => {
        const prompt = text || promptValue;
        if (!prompt.trim()) return;
        setPromptValue('');
        setShowBanner(false);

        // Slash commands
        if (prompt === '?') {
            setLogs((prev) => [...prev,
            ...HELP_TEXT.map((l) => ({ agent: 'system', type: 'status', text: l, time: Date.now() }))]);
            return;
        }
        if (prompt === '/compress') {
            contextManager.compress();
            setLogs((prev) => [...prev,
            { agent: 'system', type: 'status', text: '📦 Context compressed!', time: Date.now() }]);
            return;
        }
        if (prompt === '/grades') {
            const cards = grading.getReportCard();
            setLogs((prev) => [...prev,
            ...cards.map((c) => ({
                agent: 'system', type: 'status',
                text: `${c.icon} ${c.name}: ${c.letterGrade} (${c.grade}) ${c.trendIcon} | ${c.totalTasks} tasks | ${c.successRate}%`,
                time: Date.now()
            }))]);
            return;
        }
        if (prompt === '/memory') {
            const stats = memory.getStats();
            setLogs((prev) => [...prev,
            {
                agent: 'system', type: 'status',
                text: `🧠 ${stats.totalTasks} tasks, ${stats.routingPatterns} patterns`, time: Date.now()
            }]);
            return;
        }
        if (prompt === '/personas') {
            const personas = registry.list().filter((a) => a.type === 'persona');
            if (personas.length === 0) {
                setLogs((prev) => [...prev,
                { agent: 'system', type: 'status', text: 'No persona agents found.', time: Date.now() }]);
            } else {
                setLogs((prev) => [...prev,
                ...personas.map((p) => ({
                    agent: 'system', type: 'status',
                    text: `${p.icon} @${p.id} — ${p.name}: ${p.description || ''}`,
                    time: Date.now()
                }))]);
            }
            return;
        }

        // User message
        setLogs((prev) => [...prev, { agent: 'user', type: 'content', text: prompt, time: Date.now() }]);

        if (contextManager.needsCompression()) {
            setLogs((prev) => [...prev,
            {
                agent: 'system', type: 'status',
                text: '⚠ Context large — /compress to reduce or keep going', time: Date.now()
            }]);
        }

        // Route
        const mentionMatch = prompt.match(/^@(\w+)\s+([\s\S]+)/);

        try {
            if (mentionMatch) {
                const agentId = mentionMatch[1];
                const actualPrompt = mentionMatch[2];

                // Check if it's a persona agent
                const personaAgent = registry.get(agentId);
                if (personaAgent?.type === 'persona') {
                    const fullPrompt = `${personaAgent.system_prompt}\n\nUser request: ${actualPrompt}`;
                    const targetTool = personaAgent.uses_tool || 'gemini';
                    setFocusedAgent(targetTool);
                    setLogs((prev) => [...prev,
                    {
                        agent: 'system', type: 'status',
                        text: `${personaAgent.icon} Persona: ${personaAgent.name} → via @${targetTool}`, time: Date.now()
                    }]);
                    await orchestrator.runOn(targetTool, fullPrompt);
                } else {
                    setFocusedAgent(agentId);
                    await orchestrator.runOn(agentId, actualPrompt);
                }
            } else if (mode === 'ORCHESTRATE') {
                await orchestrator.routeAndRun(prompt);
            } else if (mode === 'FOCUS' && focusedAgent) {
                await orchestrator.runOn(focusedAgent, prompt);
            } else {
                await orchestrator.routeAndRun(prompt);
            }
        } catch (err) {
            setLogs((prev) => [...prev,
            { agent: 'system', type: 'error', text: `Error: ${err.message}`, time: Date.now() }]);
        }
    }, [promptValue, mode, focusedAgent, showThinking]);

    const headless = agents.filter((a) => a.headless || a.type === 'persona');
    const contextStats = contextManager.getStats();

    return e(Box, { flexDirection: 'column', width: '100%' },
        showBanner ? e(Banner, { version, agentCount: agents.length, availableCount: headless.length }) : null,
        e(StatusBar, { agents, mode, contextStats, sessionStart }),
        e(AgentPanel, { agents: agents.filter((a) => a.type !== 'persona'), focusedAgent }),
        e(LogPanel, { logs, focusedAgent, showThinking }),
        e(PromptInput, { value: promptValue, onChange: setPromptValue, onSubmit: handleSubmit, agents: headless, mode }),
        e(Box, { paddingX: 1, gap: 2 },
            e(Text, { dimColor: true }, 'q:quit  Tab:focus  Ctrl+O:thinking  m:mode  ?:help  /personas'),
        ),
    );
}
