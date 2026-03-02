// ─── Output Parsers ─────────────────────────────────────────────────────────

export function parseGeminiOutput(line) {
    try {
        const obj = JSON.parse(line);
        if (obj.content) return { type: 'content', text: typeof obj.content === 'string' ? obj.content : JSON.stringify(obj.content) };
        if (obj.type === 'error') return { type: 'error', text: obj.message || 'Error' };
        if (obj.type === 'status') return { type: 'status', text: obj.message || '' };
        if (obj.text) return { type: 'content', text: obj.text };
        return { type: 'raw', text: line };
    } catch {
        return line.trim() ? { type: 'content', text: line } : null;
    }
}

export function parseClaudeOutput(line) {
    try {
        const obj = JSON.parse(line);
        if (obj.type === 'assistant' && obj.message?.content) {
            const t = obj.message.content.filter((c) => c.type === 'text').map((c) => c.text).join('');
            if (t) return { type: 'content', text: t };
        }
        if (obj.type === 'content_block_delta') return { type: 'content', text: obj.delta?.text || '' };
        if (obj.type === 'result') return { type: 'done', text: 'Task complete.' };
        if (obj.type === 'tool_use') return { type: 'status', text: `🔧 Tool: ${obj.name || '…'}` };
        if (obj.content) return { type: 'content', text: typeof obj.content === 'string' ? obj.content : JSON.stringify(obj.content) };
        return { type: 'raw', text: line };
    } catch {
        return line.trim() ? { type: 'content', text: line } : null;
    }
}

export function parseCopilotOutput(line) {
    return line.trim() ? { type: 'content', text: line } : null;
}

export function getParser(agentId) {
    const map = { gemini: parseGeminiOutput, claude: parseClaudeOutput, copilot: parseCopilotOutput };
    return map[agentId] || ((line) => line.trim() ? { type: 'content', text: line } : null);
}
