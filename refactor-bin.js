import fs from 'fs';

let content = fs.readFileSync('bin/soupz.js', 'utf8');

const replacement = `import meow from 'meow';

const cli = meow(\`
    Usage
      $ soupz-stall [command] [options]

    Commands
      agents      List all installed kitchens (agents)
      auth        Authenticate with Supabase
      sync        Synchronize database schemas
      ask         Send a single prompt to the default agent

    Options
      --cloud, -c                   Start a Pinggy tunnel for internet access
      --port, -p <port>             Override the default local daemon port (7533)
      --yolo                        Skip interactive confirmations (dangerously skip permissions)
      --dangerously-skip-permissions Alias for --yolo
      --no-open                     Prevent the browser from opening automatically
      --version, -v                 Print the version
      --help, -h                    Show this help menu
\`, {
    importMeta: import.meta,
    flags: {
        cloud: { type: 'boolean', shortFlag: 'c' },
        port: { type: 'string', shortFlag: 'p' },
        yolo: { type: 'boolean' },
        dangerouslySkipPermissions: { type: 'boolean' },
        open: { type: 'boolean', default: true }
    }
});

const command = cli.input[0];
const args = cli.input.slice(1);
const options = cli.flags;

if (options.yolo || options.dangerouslySkipPermissions) {
    process.env.SOUPZ_YOLO = '1';
}

const DAEMON_PORT = parseInt(options.port || process.env.SOUPZ_REMOTE_PORT || '7533', 10);`;

content = content.replace(/const \[,, command, \.\.\.args\] = process\.argv;\s*if \(command === '--version' \|\| command === '-v' \|\| command === 'version'\) \{\s*console\.log\(\`soupz v\$\{VERSION\}\`\);\s*process\.exit\(0\);\s*\}/, replacement);

content = content.replace("const DAEMON_PORT = parseInt(process.env.SOUPZ_REMOTE_PORT || '7533', 10);", "");

content = content.replace("await startDaemon();", "await startDaemon(options);");

content = content.replace("async function startDaemon() {", `async function startDaemon(options) {`);

content = content.replace("const header = chalk.hex('#6C63FF').bold('Soupz Cockpit') + chalk.dim(\` v\${VERSION}\`);", "const header = chalk.hex('#6C63FF').bold('Soupz Daemon') + chalk.dim(\` v\${VERSION}\`);");

content = content.replace(/if \(process\.platform === 'darwin'\) exec\(\`open "\$\{connectUrl\}"\`\);\s*else if \(process\.platform === 'linux'\) exec\(\`xdg-open "\$\{connectUrl\}"\`\);\s*else if \(process\.platform === 'win32'\) exec\(\`start "\$\{connectUrl\}"\`\);/, `if (options.open) {
        if (process.platform === 'darwin') exec(\`open "\${connectUrl}"\`);
        else if (process.platform === 'linux') exec(\`xdg-open "\${connectUrl}"\`);
        else if (process.platform === 'win32') exec(\`start "\${connectUrl}"\`);
    }`);

const pinggyLogic = `
    let pinggyTunnelProc;
    if (options.cloud) {
        console.log(chalk.dim('  🌍 Starting Pinggy tunnel...'));
        const { spawn } = await import('child_process');
        pinggyTunnelProc = spawn('ssh', [
            '-p', '443',
            \`-R0:localhost:\${DAEMON_PORT}\`,
            '-o', 'StrictHostKeyChecking=no',
            '-o', 'ServerAliveInterval=30',
            'a.pinggy.io'
        ], {
            stdio: ['ignore', 'pipe', 'pipe']
        });
        
        await new Promise((resolve) => {
            const onData = (buf) => {
                const text = buf.toString();
                const match = text.match(/https:\\/\\/[a-z0-9-.]+\\.pinggy-free\\.link/i);
                if (match) {
                    process.env.SOUPZ_TUNNEL_URL = match[0];
                    pinggyTunnelProc.stdout.off('data', onData);
                    pinggyTunnelProc.stderr.off('data', onData);
                    resolve();
                }
            };
            pinggyTunnelProc.stdout.on('data', onData);
            pinggyTunnelProc.stderr.on('data', onData);
        });
    }

    let startRemoteServer;`;

content = content.replace("let startRemoteServer;", pinggyLogic);

fs.writeFileSync('bin/soupz.js', content);
console.log('Done refactoring bin/soupz.js');
