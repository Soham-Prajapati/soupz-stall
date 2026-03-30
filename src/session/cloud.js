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

        try {
            execSync('which cloudflared', { stdio: 'ignore' });
            log(chalk.dim('  🌍 Starting Cloudflare Tunnel…'));
            
            const { spawn } = await import('child_process');
            const port = process.env.SOUPZ_REMOTE_PORT || 7533;
            const proc = spawn('cloudflared', ['tunnel', '--url', `http://localhost:${port}`]);
            
            this._tunnel = { proc, url: null };
            
            proc.stderr.on('data', (data) => {
                const line = data.toString();
                const match = line.match(/https:\/\/[\w-]+\.trycloudflare\.com/);
                if (match && !this._tunnel.url) {
                    this._tunnel.url = match[0];
                    log(chalk.green(`\n  🌍 Public Tunnel Active: ${chalk.bold(this._tunnel.url)}`));
                    log(chalk.dim('     Use this URL on your phone/tablet to connect from anywhere.\n'));
                }
            });

            proc.on('close', () => {
                this._tunnel = null;
                log(chalk.red('\n  🌍 Tunnel closed.'));
            });

        } catch {
            log(chalk.red('\n  ✖ cloudflared not found. Install it to use /tunnel.'));
        }
    }
};
