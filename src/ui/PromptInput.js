import React from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';

const e = React.createElement;

export default function PromptInput({ value, onChange, onSubmit, agents, mode }) {
    return e(Box, {
        borderStyle: 'single', borderColor: '#6C63FF', paddingX: 1,
        flexDirection: 'row', gap: 1,
    },
        e(Text, { bold: true, color: '#6C63FF' }, '❯'),
        e(TextInput, {
            value, onChange, onSubmit,
            placeholder: 'Ask anything… @agent to target, ? for help',
        }),
        e(Text, { dimColor: true },
            ` │ ${agents.map((a) => `@${a.id}`).join(' ')}`),
    );
}
