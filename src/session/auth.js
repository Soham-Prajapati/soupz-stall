import chalk from 'chalk';

export const AuthMixin = {
    loginAgent(agentId) {
        const a = this.registry.get(agentId);
        if (!a) { console.log(chalk.red(`  Unknown: ${agentId}. /agents`)); return; }
        console.log(chalk.hex('#4ECDC4')(`  🔑 Logging into ${a.icon} ${a.name}…`));
        try {
            this.auth.login(agentId);
            console.log(chalk.green(`  ✔ Logged in to ${a.name}`));
        } catch (err) { console.log(chalk.yellow(`  ℹ  Run: ${a.binary || agentId} auth login`)); }
    },

    logoutAgent(agentId) {
        const a = this.registry.get(agentId);
        if (!a) { console.log(chalk.red(`  Unknown: ${agentId}`)); return; }
        try {
            this.auth.logout(agentId);
            console.log(chalk.hex('#FF6B6B')(`  🚪 Logged out of ${a.name}`));
        } catch { console.log(chalk.yellow(`  ℹ  Run: ${a.binary || agentId} auth logout`)); }
    },

    async handleUserAuth(input) {
        const parts = input.trim().split(/\s+/);
        const sub = parts[1];
        const rest = parts.slice(2);
        if (sub === 'signup' || sub === 'login') {
            const [email, password] = rest;
            if (!email || !password) { console.log(chalk.dim(`  Usage: /user ${sub} <email> <password>`)); return; }
            const result = sub === 'signup' ? await this.userAuth.signup(email, password) : await this.userAuth.login(email, password);
            console.log(result.success ? chalk.green(`  ✅ ${sub} successful (${result.mode})`) : chalk.red(`  ❌ ${result.error}`));
            if (result.success && this.userAuth.user) {
                this.relay.setUser(this.userAuth.user.id || this.userAuth.user.email);
                await this.relay.registerMachine();
            }
        } else if (sub === 'logout') {
            await this.userAuth.logout();
            console.log(chalk.green('  ✅ Logged out'));
        } else {
            const user = this.userAuth?.getUser();
            console.log(user ? chalk.hex('#4ECDC4')(`  👤 ${user.email} (${user.mode}) — since ${user.createdAt}`) : chalk.red('  ❌ Not logged in'));
        }
    }
};
