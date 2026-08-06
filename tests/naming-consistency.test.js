import { describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const configUrl = pathToFileURL(join(root, 'src/config.js')).href;

describe('public naming and persisted-data migration', () => {
    it('locks package and executable naming to soupz-cli', () => {
        const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

        expect(packageJson.name).toBe('soupz-cli');
        expect(packageJson.bin).toEqual({ 'soupz-cli': 'bin/soupz.js' });
        expect(packageJson.files).toContain('bin/soupz.js');
        expect(packageJson.files).not.toContain('bin/');
        expect(packageJson.repository).toBeUndefined();
        expect(packageJson.bugs).toBeUndefined();
        expect(packageJson.homepage).toBeUndefined();
    });

    it('does not recursively install a workspace from the prepare hook', () => {
        const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

        expect(packageJson.scripts?.prepare).toBe('node --max-old-space-size=4096 src/auto-import.js');
        expect(packageJson.scripts?.prepare).not.toMatch(/npm\s+install|pnpm\s+install|yarn\s+install/);
    });

    it('copies legacy data into ~/.soupz-cli without deleting or overwriting it', () => {
        const temporaryHome = mkdtempSync(join(tmpdir(), 'soupz-cli-migration-'));
        const legacyDir = join(temporaryHome, '.soupz-agents');
        const canonicalDir = join(temporaryHome, '.soupz-cli');

        try {
            mkdirSync(join(legacyDir, 'sessions'), { recursive: true });
            mkdirSync(canonicalDir, { recursive: true });
            writeFileSync(join(legacyDir, 'history'), 'legacy history\n', 'utf8');
            writeFileSync(join(legacyDir, 'sessions', 'legacy.json'), '{"name":"legacy"}\n', 'utf8');
            writeFileSync(join(canonicalDir, 'history'), 'canonical history\n', 'utf8');

            const runner = spawnSync(process.execPath, [
                '--input-type=module',
                '--eval',
                `import { DATA_DIR, ensureDirectories, resolveDataReadPath } from ${JSON.stringify(configUrl)}; ensureDirectories(); console.log(JSON.stringify({ dataDir: DATA_DIR, historyPath: resolveDataReadPath('history') }));`,
            ], {
                cwd: root,
                env: { ...process.env, HOME: temporaryHome },
                encoding: 'utf8',
            });

            expect(runner.status, runner.stderr).toBe(0);
            const result = JSON.parse(runner.stdout.trim());
            expect(result.dataDir).toBe(canonicalDir);
            expect(result.historyPath).toBe(join(canonicalDir, 'history'));
            expect(readFileSync(join(canonicalDir, 'history'), 'utf8')).toBe('canonical history\n');
            expect(readFileSync(join(canonicalDir, 'sessions', 'legacy.json'), 'utf8')).toContain('legacy');
            expect(readFileSync(join(legacyDir, 'history'), 'utf8')).toBe('legacy history\n');
            expect(existsSync(join(legacyDir, 'sessions', 'legacy.json'))).toBe(true);
        } finally {
            rmSync(temporaryHome, { recursive: true, force: true });
        }
    });
});
