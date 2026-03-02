import React from 'react';
import { Box } from 'ink';
import AgentCard from './AgentCard.js';

const e = React.createElement;

export default function AgentPanel({ agents, focusedAgent }) {
    return e(Box, { flexDirection: 'row', width: '100%' },
        ...agents.map((agent) =>
            e(AgentCard, { key: agent.id, agent, focused: focusedAgent === agent.id })
        )
    );
}
