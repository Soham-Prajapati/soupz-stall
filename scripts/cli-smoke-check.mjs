import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const cli = join(root, 'bin', 'soupz.js');
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const temporaryHome = mkdtempSync(join(tmpdir(), 'soupz-cli-smoke-'));

function runCli(args) {
    return spawnSync(process.execPath, [cli, ...args], {
        cwd: root,
        env: { ...process.env, HOME: temporaryHome, SOUPZ_BOOSTED: 'true' },
        encoding: 'utf8',
        timeout: 30_000,
    });
}

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

try {
    assert(packageJson.name === 'soupz-cli', 'package name must be soupz-cli');
    assert(packageJson.bin?.['soupz-cli'] === 'bin/soupz.js', 'bin must expose soupz-cli');

    // Simulate the deprecated persisted-data location used by pre-soupz-cli installs.
    const legacyDataDir = join(temporaryHome, '.soupz-agents');
    const canonicalDataDir = join(temporaryHome, '.soupz-cli');
    mkdirSync(legacyDataDir, { recursive: true });
    writeFileSync(join(legacyDataDir, 'history'), 'legacy command\n', 'utf8');
    writeFileSync(join(legacyDataDir, 'skills.json'), JSON.stringify({
        custom: [{ name: 'legacy-skill', description: 'must survive migration' }],
    }), 'utf8');

    const help = runCli(['--help']);
    assert(help.status === 0, `help exited with ${help.status}: ${help.stderr}`);
    assert(help.stdout.includes('$ soupz-cli'), 'help must advertise soupz-cli');
    assert(help.stdout.includes('--no-motion'), 'help must advertise reduced-motion control');
    const version = runCli(['--version']);
    assert(version.status === 0, `version exited with ${version.status}: ${version.stderr}`);
    assert(version.stdout.trim() === `soupz-cli v${packageJson.version}`, 'version must advertise soupz-cli');
    assert(readFileSync(join(canonicalDataDir, 'history'), 'utf8') === 'legacy command\n', 'legacy history must migrate to ~/.soupz-cli');
    assert(readFileSync(join(legacyDataDir, 'history'), 'utf8') === 'legacy command\n', 'legacy history must remain in place after migration');
    const migratedSkills = JSON.parse(readFileSync(join(canonicalDataDir, 'skills.json'), 'utf8'));
    assert(migratedSkills.custom?.[0]?.name === 'legacy-skill', 'legacy custom skills must survive registration');
    assert(existsSync(join(canonicalDataDir, 'agents')), 'canonical agent directory must be initialized');

    const agents = runCli(['agents']);
    assert(agents.status === 0, `agents exited with ${agents.status}: ${agents.stderr}`);
    assert(/Total:\s+\d+ CLI \+ \d+ specialists/.test(agents.stdout), 'agents must report its shipped definitions');
    assert(!agents.stdout.includes('SKILL_TEMPLATE') && !agents.stdout.includes('SKILL_ANALYSIS'), 'authoring docs must not load as agents');

    console.log('CLI smoke check passed: help, executable naming, legacy-data migration, and fresh-home agent loading.');
} finally {
    rmSync(temporaryHome, { recursive: true, force: true });
}
