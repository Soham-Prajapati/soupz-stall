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
    '│  @agent <prompt> Target specific agent (e.g. @gemini explain)   │',
    '│  /compress ..... Compress context now                           │',
    '│  /grades ....... Show agent report cards                        │',
    '│  /memory ....... Show memory stats                              │',
    '│  /personas ..... List persona agents                            │',
    '│  /chain a→b→c "prompt"  Sequential agent pipeline               │',
    '│  /parallel a b c "prompt"  Parallel agent dispatch              │',
    '│  /delegate agent "prompt"  Delegate to specific agent           │',
    '│  /hackathon .... Toggle hackathon mode (visual-first, fast)     │',
    '│  /bmad party "prompt"  Fan-out to ALL agents simultaneously     │',
    '│  /bmad quick "prompt"  architect→dev→qa pipeline                │',
    '│  Auto-delegation: @DELEGATE[agent]: task in output → auto-runs  │',
    '│  ? ............. Show this help                                 │',
    '└─────────────────────────────────────────────────────────────────┘',
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
    const [hackathonMode, setHackathonMode] = useState(false);

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

        /** Auto-delegation: parse @DELEGATE[agentId]: task from agent output and run in parallel */
        const autoDelegate = async (result) => {
            if (!result) return;
            const delegatePattern = /@DELEGATE\[(\w[\w-]*)\]:\s*(.+)/g;
            const matches = [...result.matchAll(delegatePattern)];
            if (matches.length === 0) return;

            setLogs((prev) => [...prev, {
                agent: 'system', type: 'status',
                text: `🤖 Auto-delegating ${matches.length} task(s) in parallel…`, time: Date.now()
            }]);

            await Promise.all(matches.map(([, agentId, task]) => {
                const agent = registry.get(agentId);
                if (!agent) {
                    setLogs((prev) => [...prev, { agent: 'system', type: 'error', text: `Unknown agent in delegation: ${agentId}`, time: Date.now() }]);
                    return Promise.resolve();
                }
                const toolId = agent.type === 'persona'
                    ? (agent.uses_tool === 'auto' ? registry.headless()[0]?.id : agent.uses_tool)
                    : agentId;
                const fullTask = agent.system_prompt ? `${agent.system_prompt}\n\nUser: ${task}` : task;
                setLogs((prev) => [...prev, { agent: 'system', type: 'status', text: `⬆ @${agentId}: ${task.slice(0, 60)}`, time: Date.now() }]);
                return orchestrator.runOn(toolId || agentId, fullTask).catch((e) => {
                    setLogs((prev) => [...prev, { agent: 'system', type: 'error', text: `${agentId} failed: ${e.message}`, time: Date.now() }]);
                });
            }));
        };

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

        // /hackathon — toggle hackathon mode
        if (prompt === '/hackathon') {
            setHackathonMode((prev) => {
                const next = !prev;
                setLogs((p) => [...p, {
                    agent: 'system', type: 'status',
                    text: next
                        ? '🏆 HACKATHON MODE ON — visual impact first, demo-able > comprehensive, 30-second judge test'
                        : '🔴 Hackathon mode off',
                    time: Date.now(),
                }]);
                return next;
            });
            return;
        }

        // /bmad party "prompt" — fan-out to all headless agents
        const bmadPartyMatch = prompt.match(/^\/bmad\s+party\s+([\s\S]+)/);
        if (bmadPartyMatch) {
            const partyPrompt = bmadPartyMatch[1];
            setLogs((prev) => [...prev, { agent: 'system', type: 'status', text: '🎉 BMAD PARTY MODE — dispatching to all agents in parallel…', time: Date.now() }]);
            try {
                const results = await orchestrator.fanOut(partyPrompt);
                for (const r of results) {
                    setLogs((prev) => [...prev, { agent: 'system', type: 'status', text: `${r.status === 'fulfilled' ? '✔' : '✖'} @${r.agent}: ${r.status}`, time: Date.now() }]);
                }
            } catch (err) {
                setLogs((prev) => [...prev, { agent: 'system', type: 'error', text: `Party failed: ${err.message}`, time: Date.now() }]);
            }
            return;
        }

        // /bmad quick "prompt" — architect → dev → qa chain
        const bmadQuickMatch = prompt.match(/^\/bmad\s+quick\s+([\s\S]+)/);
        if (bmadQuickMatch) {
            const quickPrompt = bmadQuickMatch[1];
            setLogs((prev) => [...prev, { agent: 'system', type: 'status', text: '⚡ BMAD QUICK DEV — architect → dev → qa pipeline starting…', time: Date.now() }]);
            try {
                const quickChain = ['architect', 'dev', 'qa'].filter((id) => registry.get(id) || registry.headless().length > 0);
                const toolIds = registry.headless().map((a) => a.id);
                if (toolIds.length === 0) throw new Error('No headless agents available');
                let ctx = quickPrompt;
                for (const roleId of ['architect', 'dev', 'qa']) {
                    const persona = registry.get(roleId);
                    const toolId = toolIds[0];
                    const stepPrompt = persona?.system_prompt
                        ? `${persona.system_prompt}\n\nContext:\n${ctx}`
                        : ctx;
                    setLogs((prev) => [...prev, { agent: 'system', type: 'status', text: `🔗 @${roleId || toolId}…`, time: Date.now() }]);
                    ctx = await orchestrator.runOn(toolId, stepPrompt).catch((e) => { throw e; });
                }
            } catch (err) {
                setLogs((prev) => [...prev, { agent: 'system', type: 'error', text: `Quick dev failed: ${err.message}`, time: Date.now() }]);
            }
            return;
        }

        // /chain a→b→c "prompt"
        const chainMatch = prompt.match(/^\/chain\s+([\w→\->]+)\s+"([\s\S]+)"/);
        if (chainMatch) {
            const agentIds = chainMatch[1].split(/→|->/).map((s) => s.trim());
            const chainPrompt = chainMatch[2];
            setLogs((prev) => [...prev, { agent: 'system', type: 'status', text: `🔗 Chain: ${agentIds.join(' → ')}`, time: Date.now() }]);
            try {
                let ctx = chainPrompt;
                for (let i = 0; i < agentIds.length; i++) {
                    const agentId = agentIds[i];
                    const agent = registry.get(agentId);
                    const toolId = agent?.type === 'persona'
                        ? (agent.uses_tool === 'auto' ? registry.headless()[0]?.id : agent.uses_tool)
                        : agentId;
                    if (!toolId) { setLogs((prev) => [...prev, { agent: 'system', type: 'error', text: `Unknown: ${agentId}`, time: Date.now() }]); break; }
                    const stepPrompt = agent?.system_prompt
                        ? `${agent.system_prompt}\n\nContext from previous step:\n${ctx}\n\nOriginal task: ${chainPrompt}`
                        : (i === 0 ? ctx : `Context:\n${ctx}\n\nOriginal task: ${chainPrompt}`);
                    setLogs((prev) => [...prev, { agent: 'system', type: 'status', text: `  Step ${i + 1}/${agentIds.length}: @${agentId}`, time: Date.now() }]);
                    ctx = await orchestrator.runOn(toolId, stepPrompt);
                    await autoDelegate(ctx);
                }
            } catch (err) {
                setLogs((prev) => [...prev, { agent: 'system', type: 'error', text: `Chain error: ${err.message}`, time: Date.now() }]);
            }
            return;
        }

        // /parallel a b c "prompt"
        const parallelMatch = prompt.match(/^\/parallel\s+([\w\s]+?)\s+"([\s\S]+)"/);
        if (parallelMatch) {
            const agentIds = parallelMatch[1].trim().split(/\s+/);
            const parPrompt = parallelMatch[2];
            setLogs((prev) => [...prev, { agent: 'system', type: 'status', text: `⚡ Parallel: ${agentIds.join(', ')}`, time: Date.now() }]);
            try {
                await Promise.all(agentIds.map((agentId) => {
                    const agent = registry.get(agentId);
                    const toolId = agent?.type === 'persona'
                        ? (agent.uses_tool === 'auto' ? registry.headless()[0]?.id : agent.uses_tool)
                        : agentId;
                    if (!toolId) return Promise.resolve();
                    const fp = agent?.system_prompt ? `${agent.system_prompt}\n\nUser: ${parPrompt}` : parPrompt;
                    return orchestrator.runOn(toolId, fp).then(autoDelegate).catch((e) => {
                        setLogs((prev) => [...prev, { agent: 'system', type: 'error', text: `${agentId} failed: ${e.message}`, time: Date.now() }]);
                    });
                }));
            } catch (err) {
                setLogs((prev) => [...prev, { agent: 'system', type: 'error', text: `Parallel error: ${err.message}`, time: Date.now() }]);
            }
            return;
        }

        // /delegate agent "prompt"
        const delegateMatch = prompt.match(/^\/delegate\s+(\w+)\s+"([\s\S]+)"/);
        if (delegateMatch) {
            const [, agentId, delPrompt] = delegateMatch;
            setLogs((prev) => [...prev, { agent: 'system', type: 'status', text: `📤 Delegating to @${agentId}…`, time: Date.now() }]);
            try {
                const agent = registry.get(agentId);
                const toolId = agent?.type === 'persona'
                    ? (agent.uses_tool === 'auto' ? registry.headless()[0]?.id : agent.uses_tool)
                    : agentId;
                const fp = agent?.system_prompt ? `${agent.system_prompt}\n\nUser: ${delPrompt}` : delPrompt;
                const result = await orchestrator.runOn(toolId || agentId, fp);
                await autoDelegate(result);
            } catch (err) {
                setLogs((prev) => [...prev, { agent: 'system', type: 'error', text: `Delegate error: ${err.message}`, time: Date.now() }]);
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

        // Apply hackathon mode prefix if active
        const activePrompt = hackathonMode
            ? `[HACKATHON MODE — visual impact first, judges decide in 30 seconds, working > comprehensive, make it memorable]\n\n${prompt}`
            : prompt;

        // Route
        const mentionMatch = activePrompt.match(/^(?:\[HACKATHON[^\]]*\]\s*\n\n)?@(\w+)\s+([\s\S]+)/) || prompt.match(/^@(\w+)\s+([\s\S]+)/);

        try {
            let result;
            if (mentionMatch && prompt.startsWith('@')) {
                const agentId = mentionMatch[1];
                const actualPrompt = mentionMatch[2];

                // Check if it's a persona agent
                const personaAgent = registry.get(agentId);
                if (personaAgent?.type === 'persona') {
                    const fullPrompt = `${personaAgent.system_prompt}\n\nUser request: ${hackathonMode ? '[HACKATHON] ' : ''}${actualPrompt}`;
                    const targetTool = personaAgent.uses_tool === 'auto' ? registry.headless()[0]?.id : (personaAgent.uses_tool || 'gemini');
                    setFocusedAgent(targetTool);
                    setLogs((prev) => [...prev,
                    {
                        agent: 'system', type: 'status',
                        text: `${personaAgent.icon} Persona: ${personaAgent.name} → via @${targetTool}`, time: Date.now()
                    }]);
                    result = await orchestrator.runOn(targetTool, fullPrompt);
                } else {
                    setFocusedAgent(agentId);
                    result = await orchestrator.runOn(agentId, actualPrompt);
                }
            } else if (mode === 'ORCHESTRATE') {
                result = await orchestrator.routeAndRun(activePrompt);
            } else if (mode === 'FOCUS' && focusedAgent) {
                result = await orchestrator.runOn(focusedAgent, activePrompt);
            } else {
                result = await orchestrator.routeAndRun(activePrompt);
            }
            // Automatically handle any @DELEGATE[...] patterns in the response
            await autoDelegate(result);
        } catch (err) {
            setLogs((prev) => [...prev,
            { agent: 'system', type: 'error', text: `Error: ${err.message}`, time: Date.now() }]);
        }
    }, [promptValue, mode, focusedAgent, showThinking, hackathonMode]);

    const headless = agents.filter((a) => a.headless || a.type === 'persona');
    const contextStats = contextManager.getStats();

    return e(Box, { flexDirection: 'column', width: '100%' },
        showBanner ? e(Banner, { version, agentCount: agents.length, availableCount: headless.length }) : null,
        e(StatusBar, { agents, mode, contextStats, sessionStart }),
        e(AgentPanel, { agents: agents.filter((a) => a.type !== 'persona'), focusedAgent }),
        e(LogPanel, { logs, focusedAgent, showThinking }),
        e(PromptInput, { value: promptValue, onChange: setPromptValue, onSubmit: handleSubmit, agents: headless, mode }),
        e(Box, { paddingX: 1, gap: 2 },
            e(Text, { dimColor: true }, 'q:quit  Tab:focus  Ctrl+O:thinking  m:mode  ?:help  /personas  /hackathon  /bmad'),
            hackathonMode ? e(Text, { color: 'yellow', bold: true }, '  🏆 HACKATHON') : null,
        ),
    );
}
