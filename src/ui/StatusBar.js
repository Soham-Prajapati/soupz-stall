import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';

const e = React.createElement;

export default function StatusBar({ agents, mode, contextStats, sessionStart }) {
    const elapsed = Math.floor((Date.now() - sessionStart) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    const activeCount = agents.filter((a) => a.state === 'running' || a.state === 'streaming').length;
    const availCount = agents.filter((a) => a.available).length;

    const modeStyles = {
        ORCHESTRATE: { icon: '🎯', color: '#FF6B6B' },
        FOCUS: { icon: '🔍', color: '#4ECDC4' },
        MONITOR: { icon: '👁', color: '#95E1D3' },
    };
    const ms = modeStyles[mode] || modeStyles.ORCHESTRATE;

    return e(Box, {
        flexDirection: 'row', justifyContent: 'space-between', paddingX: 1,
        borderStyle: 'bold', borderColor: '#6C63FF',
    },
        e(Box, { gap: 1 },
            e(Text, { bold: true, color: '#6C63FF' }, '⚡ SOUPZ'),
            e(Text, { dimColor: true }, '│'),
            activeCount > 0
                ? e(Text, { color: '#FFD93D' },
                    e(Spinner, { type: 'dots' }),
                    ` ${activeCount} active`)
                : e(Text, { color: '#666' }, '○ idle'),
            e(Text, { dimColor: true }, '│'),
            e(Text, { dimColor: true }, `${availCount} agents`),
        ),
        e(Box, { gap: 1 },
            contextStats?.needsCompression
                ? e(Text, { color: '#FF6B6B' }, `⚠ ${contextStats.messages} msgs`)
                : e(Text, { dimColor: true }, `${contextStats?.messages || 0} msgs`),
            e(Text, { dimColor: true }, '│'),
            e(Text, { color: ms.color, bold: true }, `${ms.icon} ${mode}`),
            e(Text, { dimColor: true }, '│'),
            e(Text, { dimColor: true }, `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`),
        ),
    );
}
