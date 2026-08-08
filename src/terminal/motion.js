const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

function envFlagEnabled(value) {
    if (value === undefined || value === null) return false;
    return !['', '0', 'false', 'no', 'off'].includes(String(value).trim().toLowerCase());
}

export function shouldUseMotion({ stream = process.stdout, env = process.env, disabled = false } = {}) {
    if (disabled || !stream?.isTTY) return false;
    if (env.TERM === 'dumb') return false;
    if (Object.prototype.hasOwnProperty.call(env, 'NO_COLOR')) return false;
    if (envFlagEnabled(env.CI)) return false;
    if (envFlagEnabled(env.SOUPZ_REDUCE_MOTION)) return false;
    return true;
}

function singleLineLabel(label) {
    return String(label || 'Working…').replace(/\s+/g, ' ').trim() || 'Working…';
}

/**
 * A single-line terminal activity indicator. Animated frames overwrite one line;
 * deterministic environments receive one plain status line instead.
 */
export function createActivity(label, {
    stream = process.stdout,
    env = process.env,
    disabled = false,
    intervalMs = 80,
    frames = SPINNER_FRAMES,
    accent = (value) => value,
    setIntervalFn = setInterval,
    clearIntervalFn = clearInterval,
} = {}) {
    const text = singleLineLabel(label);
    const animated = shouldUseMotion({ stream, env, disabled });
    let frame = 0;
    let timer = null;
    let active = false;

    const render = () => {
        const glyph = frames[frame % frames.length];
        stream.write(`\r\x1b[K  ${accent(glyph)} ${accent(text)}`);
        frame += 1;
    };

    return {
        get animated() { return animated; },
        get active() { return active; },

        start() {
            if (active) return this;
            active = true;
            if (!animated) {
                stream.write(`  ${text}\n`);
                return this;
            }
            render();
            timer = setIntervalFn(render, intervalMs);
            timer?.unref?.();
            return this;
        },

        stop() {
            if (!active) return;
            if (timer) clearIntervalFn(timer);
            timer = null;
            active = false;
            if (animated) stream.write('\r\x1b[K');
        },
    };
}
