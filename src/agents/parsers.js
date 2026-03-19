// ─── Output Parsers ─────────────────────────────────────────────────────────
// Parses streaming output from each AI CLI into normalized { type, text } objects

/**
 * Gemini CLI stream-json format:
 * {"type":"init", "model":"..."}
 * {"type":"tool_use", "tool_name":"...", "parameters":{}}
 * {"type":"tool_result", "status":"...", "output":"..."}
 * {"type":"content", "content":"actual response text"}
 * {"type":"done"} or final line with the response
 */
export function parseGeminiOutput(line) {
    if (!line.trim()) return null;
    try {
        const obj = JSON.parse(line);

        // Final text response
        if (obj.type === 'content' && obj.content) {
            const text = typeof obj.content === 'string' ? obj.content : JSON.stringify(obj.content);
            return { type: 'content', text };
        }

        // Message chunks (streaming)
        if (obj.type === 'message' && obj.message) {
            return { type: 'content', text: obj.message };
        }

        // Text field directly
        if (obj.text) {
            return { type: 'content', text: obj.text };
        }

        // Tool usage — show brief status (don't spam)
        if (obj.type === 'tool_use') {
            const toolName = obj.tool_name || obj.name || 'tool';
            return { type: 'status', text: `  ↳ ${toolName}...` };
        }

        // Tool result — skip (internal)
        if (obj.type === 'tool_result') return null;

        // Init — skip
        if (obj.type === 'init') return null;

        // Error
        if (obj.type === 'error') {
            return { type: 'error', text: obj.message || obj.error || 'Gemini error' };
        }

        // Done signal
        if (obj.type === 'done') return null;

        // Fallback: if has any text-like field
        if (obj.response) return { type: 'content', text: obj.response };
        if (obj.output && typeof obj.output === 'string' && !obj.tool_id) return { type: 'content', text: obj.output };

        // Skip anything that's pure metadata
        return null;
    } catch {
        // Non-JSON line — treat as raw text output
        const trimmed = line.trim();
        if (!trimmed) return null;
        // Skip obvious non-content lines
        if (trimmed.startsWith('Loaded cached credentials')) return null;
        if (trimmed.startsWith('Error executing tool')) return null;
        return { type: 'content', text: trimmed };
    }
}

/**
 * Claude Code CLI output:
 * {"type":"assistant", "message":{"content":[{"type":"text","text":"..."}]}}
 * {"type":"content_block_delta", "delta":{"type":"text_delta","text":"..."}}
 * {"type":"result", "subtype":"success", "result":"..."}
 */
export function parseClaudeOutput(line) {
    if (!line.trim()) return null;
    try {
        const obj = JSON.parse(line);

        if (obj.type === 'assistant' && obj.message?.content) {
            const t = obj.message.content.filter((c) => c.type === 'text').map((c) => c.text).join('');
            if (t) return { type: 'content', text: t };
        }
        if (obj.type === 'content_block_delta') {
            const text = obj.delta?.text || '';
            return text ? { type: 'content', text } : null;
        }
        if (obj.type === 'result') {
            if (obj.result) return { type: 'content', text: obj.result };
            return { type: 'done', text: '' };
        }
        if (obj.type === 'tool_use') {
            return { type: 'status', text: `  ↳ ${obj.name || 'tool'}...` };
        }
        if (obj.type === 'system') return null;
        if (obj.content) {
            const text = typeof obj.content === 'string' ? obj.content : JSON.stringify(obj.content);
            return { type: 'content', text };
        }
        return null;
    } catch {
        const trimmed = line.trim();
        return trimmed ? { type: 'content', text: trimmed } : null;
    }
}

/** GitHub Copilot CLI — plain text output */
export function parseCopilotOutput(line) {
    return line.trim() ? { type: 'content', text: line } : null;
}

/** Kiro CLI — assume plain text output */
export function parseKiroOutput(line) {
    if (!line.trim()) return null;
    try {
        const obj = JSON.parse(line);
        if (obj.text) return { type: 'content', text: obj.text };
        if (obj.content) return { type: 'content', text: typeof obj.content === 'string' ? obj.content : JSON.stringify(obj.content) };
        return null;
    } catch {
        return line.trim() ? { type: 'content', text: line } : null;
    }
}

export function getParser(agentId) {
    const map = {
        gemini: parseGeminiOutput,
        'claude-code': parseClaudeOutput,
        claude: parseClaudeOutput,
        copilot: parseCopilotOutput,
        gh: parseCopilotOutput,
        kiro: parseKiroOutput,
    };
    return map[agentId] || ((line) => line.trim() ? { type: 'content', text: line } : null);
}
