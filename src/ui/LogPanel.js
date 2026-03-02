import React from 'react';
import { Box, Text } from 'ink';

const e = React.createElement;

const COLORS = {
    gemini: '#4285F4', claude: '#D97757', copilot: '#6E40C9',
    antigravity: '#00D4AA', system: '#6C63FF', user: '#FFD93D',
};

export default function LogPanel({ logs, focusedAgent, showThinking, maxLines = 16 }) {
    const filtered = focusedAgent
        ? logs.filter((l) => l.agent === focusedAgent || l.agent === 'system' || l.agent === 'user')
        : logs;

    // Filter out thinking if collapsed
    const displayLogs = showThinking
        ? filtered
        : filtered.filter((l) => l.type !== 'thinking');

    const visible = displayLogs.slice(-maxLines);

    const entries = visible.length === 0
        ? [e(Box, { key: 'empty', marginTop: 1 },
            e(Text, { dimColor: true }, '  No output yet. Type a prompt to begin your session…'))]
        : visible.map((entry, i) =>
            e(Box, { key: i, flexDirection: 'row', gap: 1 },
                e(Text, { color: COLORS[entry.agent] || '#888', dimColor: true, bold: entry.agent === 'user' },
                    entry.agent === 'user' ? '❯' : `[${entry.agent}]`),
                e(Text, {
                    color: entry.type === 'error' ? '#FF6B6B'
                        : entry.type === 'status' ? '#FFD93D'
                            : entry.type === 'thinking' ? '#666'
                                : entry.agent === 'user' ? '#FFF'
                                    : '#CCC',
                    wrap: 'truncate',
                    italic: entry.type === 'thinking',
                }, entry.type === 'thinking' ? `💭 ${entry.text}` : entry.text),
            )
        );

    return e(Box, {
        flexDirection: 'column', borderStyle: 'single', borderColor: '#333',
        paddingX: 1, height: maxLines + 2, flexGrow: 1,
    },
        e(Box, { flexDirection: 'row', justifyContent: 'space-between' },
            e(Text, { bold: true, color: '#6C63FF' },
                `📜 ${focusedAgent ? focusedAgent : 'all agents'}`),
            e(Box, { gap: 1 },
                e(Text, { dimColor: true }, `${displayLogs.length} msgs`),
                e(Text, { color: showThinking ? '#4ECDC4' : '#666' },
                    showThinking ? '💭on' : '💭off'),
            ),
        ),
        ...entries,
    );
}
