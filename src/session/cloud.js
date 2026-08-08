import chalk from 'chalk';
import { execSync } from 'child_process';

export const CloudMixin = {
    async startCloudKitchen(showBanner = true) {
        if (this._cloudKitchen) {
            if (showBanner) {
                console.log(chalk.green('\n  ☁️  Cloud Kitchen is already running!'));
                this._cloudKitchen.showStatus();
            }
            return;
        }

        try {
            const { startRemoteServer } = await import('../../packages/remote-server/src/index.js');
            this._cloudKitchen = await startRemoteServer(process.env.SOUPZ_REMOTE_PORT || 7533, {
                silent: !showBanner
            });
            if (this._cloudKitchen && showBanner) {
                console.log(chalk.green('\n  ☁️  Cloud Kitchen started!'));
                // Note: showStatus might need to be implemented or mapped to a handle method
            }
        } catch (err) {
            if (showBanner) console.log(chalk.red(`\n  ✖ Failed to start Cloud Kitchen: ${err.message}`));
        }
    },

    async startTunnel(silent = false) {
        if (this._tunnel) {
            if (!silent) console.log(chalk.green('\n  🌍 Tunnel is already active.'));
            return;
        }

        if (!this._cloudKitchen) {
            await this.startCloudKitchen(false);
        }

        const log = silent ? () => {} : (...a) => console.log(...a);
        const providerRaw = String(process.env.SOUPZ_TUNNEL_PROVIDER || 'auto').trim().toLowerCase();
        const tailscaleUrl = String(process.env.SOUPZ_TAILSCALE_DAEMON_URL || process.env.SOUPZ_TUNNEL_URL || '').trim().replace(/\/$/, '');
        const provider = providerRaw === 'auto'
            ? (tailscaleUrl ? 'tailscale' : 'cloudflare')
            : providerRaw;

        if (provider === 'tailscale') {
            if (!tailscaleUrl) {
                log(chalk.red('\n  ✖ Tailscale tunnel selected, but no URL configured. Set SOUPZ_TAILSCALE_DAEMON_URL.'));
                return;
            }
            this._tunnel = { proc: null, url: tailscaleUrl };
            log(chalk.green(`\n  🌍 Tailscale Tunnel Active: ${chalk.bold(tailscaleUrl)}`));
            log(chalk.dim('     Use this URL on your phone/tablet to connect from anywhere.\n'));
            return;
        }

        try {
            log(chalk.dim('  🌍 Starting Pinggy Tunnel...'));
            
            const { spawn } = await import('child_process');
            const port = process.env.SOUPZ_REMOTE_PORT || 7533;
            const proc = spawn('ssh', [
                '-p', '443',
                `-R0:localhost:${port}`,
                '-o', 'StrictHostKeyChecking=no',
                '-o', 'ServerAliveInterval=30',
                'a.pinggy.io'
            ], { stdio: ['ignore', 'pipe', 'pipe'] });
            
            this._tunnel = { proc, url: null };
            
            const onData = (data) => {
                const line = data.toString();
                const match = line.match(/https:\/\/[a-z0-9-.]+\.pinggy-free\.link/i);
                if (match && !this._tunnel.url) {
                    this._tunnel.url = match[0];
                    log(chalk.green(`\n  🌍 Public Tunnel Active: ${chalk.bold(this._tunnel.url)}`));
                    log(chalk.dim('     Use this URL on your phone/tablet to connect from anywhere.\n'));
                }
            };
            proc.stdout.on('data', onData);
            proc.stderr.on('data', onData);

            proc.on('close', () => {
                this._tunnel = null;
                log(chalk.red('\n  🌍 Tunnel closed.'));
            });
        } catch (err) {
            log(chalk.red(`\n  ✖ Failed to start Pinggy tunnel: ${err.message}`));
        }
    }
};
