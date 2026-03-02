import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';

const e = React.createElement;

const STATE_DISPLAY = {
    idle: { label: 'Idle', color: '#666', dot: '○' },
    running: { label: 'Running', color: '#FFD93D', dot: '●' },
    streaming: { label: 'Streaming', color: '#4ECDC4', dot: '●' },
    done: { label: 'Done', color: '#6BCB77', dot: '✔' },
    error: { label: 'Error', color: '#FF6B6B', dot: '✖' },
    unavailable: { label: 'N/A', color: '#444', dot: '○' },
};

function elapsed(startTime) {
    if (!startTime) return '';
    const s = Math.floor((Date.now() - startTime) / 1000);
    return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m${s % 60}s`;
}

export default function AgentCard({ agent, focused }) {
    const d = STATE_DISPLAY[agent.state] || STATE_DISPLAY.idle;
    const active = agent.state === 'running' || agent.state === 'streaming';
    const children = [];

    children.push(e(Box, { key: 'h', flexDirection: 'row', justifyContent: 'space-between' },
        e(Text, { bold: true, color: agent.color || '#FFF' }, `${agent.icon} ${agent.name}`),
        !agent.headless ? e(Text, { dimColor: true }, 'MON') : null,
        agent.grade != null ? e(Text, { dimColor: true }, `G:${agent.grade}`) : null,
    ));

    children.push(e(Box, { key: 's', flexDirection: 'row', gap: 1 },
        active ? e(Text, { color: d.color }, e(Spinner, { type: 'dots' })) : e(Text, { color: d.color }, d.dot),
        e(Text, { color: d.color }, d.label),
        active && agent.startTime ? e(Text, { dimColor: true }, elapsed(agent.startTime)) : null,
    ));

    if (agent.currentTask) {
        const t = agent.currentTask.length > 28 ? agent.currentTask.slice(0, 25) + '…' : agent.currentTask;
        children.push(e(Text, { key: 't', dimColor: true, wrap: 'truncate' }, `📋 ${t}`));
    }

    if (agent.lastOutput) {
        const o = agent.lastOutput.length > 32 ? agent.lastOutput.slice(0, 29) + '…' : agent.lastOutput;
        children.push(e(Text, { key: 'o', color: '#888', wrap: 'truncate' }, `→ ${o}`));
    }

    if (agent.error) {
        children.push(e(Text, { key: 'e', color: '#FF6B6B', wrap: 'truncate' }, `⚠ ${agent.error.slice(0, 30)}`));
    }

    if (!agent.available) {
        children.push(e(Text, { key: 'na', color: '#555' }, '✖ not installed'));
    }

    return e(Box, {
        flexDirection: 'column', width: '25%',
        borderStyle: focused ? 'bold' : 'single',
        borderColor: focused ? (agent.color || '#6C63FF') : '#333',
        paddingX: 1,
    }, ...children);
}
