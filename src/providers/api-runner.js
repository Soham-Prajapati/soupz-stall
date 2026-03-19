/**
 * API-based AI Provider Runner
 * Handles providers that use API keys rather than CLI binaries.
 * Supports: Anthropic (Claude), OpenAI, Groq, OpenRouter, Google Gemini API
 */

export const SUPPORTED_API_PROVIDERS = {
    anthropic: {
        name: 'Anthropic (Claude)',
        envKey: 'ANTHROPIC_API_KEY',
        models: {
            fast: 'claude-haiku-4-5-20251001',
            balanced: 'claude-sonnet-4-6',
            powerful: 'claude-opus-4-6',
        },
        endpoint: 'https://api.anthropic.com/v1/messages',
        icon: '🧠',
    },
    openai: {
        name: 'OpenAI (GPT)',
        envKey: 'OPENAI_API_KEY',
        models: {
            fast: 'gpt-4o-mini',
            balanced: 'gpt-4o',
            powerful: 'gpt-4o',
        },
        endpoint: 'https://api.openai.com/v1/chat/completions',
        icon: '🤖',
    },
    groq: {
        name: 'Groq (Ultra-fast)',
        envKey: 'GROQ_API_KEY',
        models: {
            fast: 'llama-3.1-8b-instant',
            balanced: 'llama-3.3-70b-versatile',
            powerful: 'llama-3.3-70b-versatile',
        },
        endpoint: 'https://api.groq.com/openai/v1/chat/completions',
        icon: '⚡',
    },
    openrouter: {
        name: 'OpenRouter',
        envKey: 'OPENROUTER_API_KEY',
        models: {
            fast: 'meta-llama/llama-3.1-8b-instruct:free',
            balanced: 'google/gemini-2.0-flash-exp:free',
            powerful: 'anthropic/claude-opus-4-6',
        },
        endpoint: 'https://openrouter.ai/api/v1/chat/completions',
        icon: '🌐',
    },
    gemini: {
        name: 'Google Gemini API',
        envKey: 'GEMINI_API_KEY',
        models: {
            fast: 'gemini-2.0-flash',
            balanced: 'gemini-2.0-flash',
            powerful: 'gemini-2.5-pro',
        },
        endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
        icon: '🔮',
    },
};

/**
 * Get available API providers (those with env keys set)
 */
export function getAvailableApiProviders() {
    return Object.entries(SUPPORTED_API_PROVIDERS)
        .filter(([, config]) => !!process.env[config.envKey])
        .map(([id, config]) => ({ id, ...config }));
}

/**
 * Get best available provider in priority order:
 * 1. User's preferred provider (env SOUPZ_API_PROVIDER)
 * 2. Anthropic (Claude) if key set
 * 3. OpenAI if key set
 * 4. Groq if key set (fastest)
 * 5. OpenRouter if key set
 * 6. Gemini API if key set
 */
export function getBestApiProvider(tier = 'balanced') {
    const preferred = process.env.SOUPZ_API_PROVIDER;
    if (preferred && SUPPORTED_API_PROVIDERS[preferred] && process.env[SUPPORTED_API_PROVIDERS[preferred].envKey]) {
        return { id: preferred, ...SUPPORTED_API_PROVIDERS[preferred], model: SUPPORTED_API_PROVIDERS[preferred].models[tier] };
    }

    const priority = ['anthropic', 'openai', 'groq', 'openrouter', 'gemini'];
    for (const id of priority) {
        const config = SUPPORTED_API_PROVIDERS[id];
        if (process.env[config.envKey]) {
            return { id, ...config, model: config.models[tier] };
        }
    }
    return null;
}

/**
 * Run a prompt through an API-based provider
 * Returns a readable stream of text chunks
 */
export async function runWithApiProvider(prompt, systemPrompt = '', options = {}) {
    const tier = options.tier || 'balanced';
    const provider = options.provider ?
        { id: options.provider, ...SUPPORTED_API_PROVIDERS[options.provider], model: SUPPORTED_API_PROVIDERS[options.provider]?.models[tier] } :
        getBestApiProvider(tier);

    if (!provider) {
        throw new Error('No API provider configured. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, GROQ_API_KEY, or OPENROUTER_API_KEY in your .env');
    }

    const apiKey = process.env[provider.envKey];

    if (provider.id === 'anthropic') {
        return runAnthropic(prompt, systemPrompt, provider.model, apiKey, options);
    } else if (provider.id === 'gemini') {
        return runGeminiApi(prompt, systemPrompt, provider.model, apiKey, options);
    } else {
        // OpenAI-compatible: OpenAI, Groq, OpenRouter
        return runOpenAICompatible(prompt, systemPrompt, provider.model, apiKey, provider.endpoint, options);
    }
}

async function runAnthropic(prompt, systemPrompt, model, apiKey, options = {}) {
    const body = {
        model,
        max_tokens: options.maxTokens || 4096,
        messages: [{ role: 'user', content: prompt }],
        stream: true,
    };
    if (systemPrompt) body.system = systemPrompt;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Anthropic API error ${res.status}: ${err}`);
    }

    return streamSSE(res, (event) => {
        if (event.type === 'content_block_delta') {
            return event.delta?.text || '';
        }
        return null;
    });
}

async function runOpenAICompatible(prompt, systemPrompt, model, apiKey, endpoint, options = {}) {
    const messages = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: prompt });

    const body = { model, messages, stream: true, max_tokens: options.maxTokens || 4096 };

    const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`API error ${res.status}: ${err}`);
    }

    return streamSSE(res, (event) => {
        return event.choices?.[0]?.delta?.content || null;
    });
}

async function runGeminiApi(prompt, systemPrompt, model, apiKey, options = {}) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}&alt=sse`;
    const body = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: options.maxTokens || 4096 },
    };
    if (systemPrompt) body.systemInstruction = { parts: [{ text: systemPrompt }] };

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Gemini API error ${res.status}: ${err}`);
    }

    return streamSSE(res, (event) => {
        return event.candidates?.[0]?.content?.parts?.[0]?.text || null;
    });
}

/**
 * Generic SSE stream reader — yields text chunks
 */
async function* streamSSE(res, extractText) {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (data === '[DONE]') return;
            try {
                const event = JSON.parse(data);
                const text = extractText(event);
                if (text) yield text;
            } catch { /* skip malformed lines */ }
        }
    }
}

/**
 * Simple non-streaming call — returns full response string
 * Used for routing decisions, quick classifications
 */
export async function callApiProvider(prompt, systemPrompt = '', options = {}) {
    const gen = await runWithApiProvider(prompt, systemPrompt, { ...options, tier: options.tier || 'fast' });
    let result = '';
    for await (const chunk of gen) {
        result += chunk;
    }
    return result.trim();
}
