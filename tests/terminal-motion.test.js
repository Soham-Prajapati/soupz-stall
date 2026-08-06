import { describe, expect, it, vi } from 'vitest';
import { createActivity, shouldUseMotion } from '../src/terminal/motion.js';

function outputStream(isTTY = true) {
    let output = '';
    return {
        isTTY,
        write(value) { output += value; },
        read() { return output; },
    };
}

describe('terminal motion policy', () => {
    it('animates only in a capable interactive terminal', () => {
        const stream = outputStream(true);
        expect(shouldUseMotion({ stream, env: { TERM: 'xterm-256color' } })).toBe(true);
        expect(shouldUseMotion({ stream: outputStream(false), env: {} })).toBe(false);
        expect(shouldUseMotion({ stream, env: { CI: '1' } })).toBe(false);
        expect(shouldUseMotion({ stream, env: { NO_COLOR: '' } })).toBe(false);
        expect(shouldUseMotion({ stream, env: { TERM: 'dumb' } })).toBe(false);
        expect(shouldUseMotion({ stream, env: { SOUPZ_REDUCE_MOTION: '1' } })).toBe(false);
        expect(shouldUseMotion({ stream, env: {}, disabled: true })).toBe(false);
    });

    it('updates one terminal line and clears it when animation stops', () => {
        vi.useFakeTimers();
        const stream = outputStream(true);
        const activity = createActivity('Running codex…', {
            stream,
            env: { TERM: 'xterm-256color' },
            intervalMs: 80,
            accent: (value) => value,
        }).start();

        expect(activity.animated).toBe(true);
        vi.advanceTimersByTime(160);
        activity.stop();

        expect(stream.read().match(/Running codex…/g)).toHaveLength(3);
        expect(stream.read().match(/\r\x1b\[K/g)).toHaveLength(4);
        vi.useRealTimers();
    });

    it('writes one deterministic status line when motion is disabled', () => {
        const stream = outputStream(false);
        const activity = createActivity('Running\n codex…', { stream, env: {} }).start();
        activity.stop();

        expect(activity.animated).toBe(false);
        expect(stream.read()).toBe('  Running codex…\n');
        expect(stream.read()).not.toContain('\x1b');
    });
});
