import React from 'react';
import { Box, Text } from 'ink';

const e = React.createElement;

const BANNER_ART = [
    ' ███████╗  ██████╗  ██╗   ██╗ ██████╗  ███████╗',
    ' ██╔════╝ ██╔═══██╗ ██║   ██║ ██╔══██╗ ╚══███╔╝',
    ' ███████╗ ██║   ██║ ██║   ██║ ██████╔╝   ███╔╝',
    ' ╚════██║ ██║   ██║ ██║   ██║ ██╔═══╝   ███╔╝',
    ' ███████║ ╚██████╔╝ ╚██████╔╝ ██║      ███████╗',
    ' ╚══════╝  ╚═════╝   ╚═════╝  ╚═╝      ╚══════╝',
    '                A G E N T S',
];

const GRADIENT = ['#6C63FF', '#7B5BF2', '#A855F7', '#06B6D4', '#4ECDC4', '#6BCB77', '#4ECDC4'];

export default function Banner({ version, agentCount, availableCount }) {
    return e(Box, { flexDirection: 'column', paddingX: 1, marginBottom: 0 },
        ...BANNER_ART.map((line, i) =>
            e(Text, { key: i, color: GRADIENT[i] || '#6C63FF', bold: true }, line)
        ),
        e(Box, { marginTop: 0, gap: 2 },
            e(Text, { dimColor: true }, `v${version}`),
            e(Text, { dimColor: true }, '│'),
            e(Text, { color: '#4ECDC4' }, `${availableCount}/${agentCount} agents ready`),
            e(Text, { dimColor: true }, '│'),
            e(Text, { dimColor: true }, 'Type a prompt or ? for help'),
        ),
    );
}
