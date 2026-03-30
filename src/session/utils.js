import chalk from 'chalk';
import { existsSync, writeFileSync, mkdirSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { homedir } from 'os';
import { spawn } from 'child_process';

const NAME_ADJECTIVES = ['spicy', 'smoky', 'crispy', 'tangy', 'zesty', 'golden', 'sizzling', 'savory', 'fiery', 'mellow', 'rustic', 'bold', 'fresh', 'hearty', 'silky'];
const NAME_DISHES = ['ramen', 'curry', 'broth', 'stew', 'risotto', 'gumbo', 'chowder', 'bisque', 'pho', 'laksa', 'minestrone', 'gazpacho', 'dashi', 'congee', 'tom-yum'];

export function generateSessionName() {
    const adj = NAME_ADJECTIVES[Math.floor(Math.random() * NAME_ADJECTIVES.length)];
    const dish = NAME_DISHES[Math.floor(Math.random() * NAME_DISHES.length)];
    const num = Math.floor(Math.random() * 100);
    return `${adj}-${dish}-${num}`;
}

export const UtilsMixin = {
    async handleMcp(input) {
        if (!this.mcpClient) { console.log(chalk.red('  ❌ MCP client not available')); return; }
        const parts = input.replace('/mcp', '').trim().split(/\s+/);
        const sub = parts[0] || 'list';

        if (sub === 'list') {
            const servers = this.mcpClient.list();
            if (!servers.length) { console.log(chalk.dim('  No MCP servers registered. Use /mcp register <name> <command> [args...]')); return; }
            console.log(chalk.hex('#FFD93D')('  🔌 MCP Servers:'));
            for (const s of servers) {
                const status = s.connected ? chalk.green('● connected') : chalk.dim('○ disconnected');
                console.log(`    ${status} ${chalk.bold(s.name)} — ${s.command} ${(s.args || []).join(' ')}`);
            }
        } else if (sub === 'register') {
            const name = parts[1];
            const command = parts[2];
            const args = parts.slice(3);
            if (!name || !command) { console.log(chalk.dim('  Usage: /mcp register <name> <command> [args...]')); return; }
            this.mcpClient.register(name, { command, args });
            console.log(chalk.green(`  ✅ Registered MCP server "${name}": ${command} ${args.join(' ')}`));
        } else if (sub === 'connect') {
            const name = parts[1];
            if (!name) { console.log(chalk.dim('  Usage: /mcp connect <name>')); return; }
            try {
                console.log(chalk.dim(`  Connecting to ${name}...`));
                const conn = await this.mcpClient.connect(name);
                console.log(chalk.green(`  ✅ Connected to "${name}" — ${conn.tools.length} tools available`));
                for (const t of conn.tools) {
                    console.log(chalk.dim(`    🔧 ${t.name}: ${t.description || ''}`));
                }
            } catch (err) { console.log(chalk.red(`  ❌ ${err.message}`)); }
        } else if (sub === 'tools') {
            const tools = this.mcpClient.allTools();
            if (!tools.length) { console.log(chalk.dim('  No tools available. Connect to a server first: /mcp connect <name>')); return; }
            console.log(chalk.hex('#FFD93D')('  🔧 Available MCP Tools:'));
            for (const t of tools) {
                console.log(`    ${chalk.bold(t.name)} ${chalk.dim(`[${t.server}]`)} — ${t.description || ''}`);
            }
        } else if (sub === 'call') {
            const serverName = parts[1];
            const toolName = parts[2];
            const argsJson = parts.slice(3).join(' ');
            if (!serverName || !toolName) { console.log(chalk.dim('  Usage: /mcp call <server> <tool> [json_args]')); return; }
            try {
                const args = argsJson ? JSON.parse(argsJson) : {};
                const result = await this.mcpClient.callTool(serverName, toolName, args);
                console.log(chalk.green('  ✅ Result:'));
                console.log(typeof result === 'string' ? result : JSON.stringify(result, null, 2));
            } catch (err) { console.log(chalk.red(`  ❌ ${err.message}`)); }
        } else if (sub === 'disconnect') {
            const name = parts[1];
            if (!name) { console.log(chalk.dim('  Usage: /mcp disconnect <name>')); return; }
            this.mcpClient.disconnect(name);
            console.log(chalk.green(`  ✅ Disconnected from "${name}"`));
        } else if (sub === 'remove') {
            const name = parts[1];
            if (!name) { console.log(chalk.dim('  Usage: /mcp remove <name>')); return; }
            this.mcpClient.unregister(name);
            console.log(chalk.green(`  ✅ Removed MCP server "${name}"`));
        } else {
            console.log(chalk.dim('  Usage: /mcp [list|register|connect|disconnect|tools|call|remove]'));
        }
    },

    async browseLocalhost(input) {
        const url = input.replace('/browse', '').trim() || 'http://localhost:3000';
        console.log(chalk.hex('#4ECDC4')('  🌐 ') + chalk.dim(`browsing ${url}…`));
        try {
            const puppeteer = await import('puppeteer-core');
            const paths = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'];
            const execPath = paths.find((p) => existsSync(p));
            if (!execPath) { console.log(chalk.red('  No Chrome found.')); return; }
            const browser = await puppeteer.default.launch({ executablePath: execPath, headless: 'new' });
            const page = await browser.newPage();
            await page.setViewport({ width: 1280, height: 800 });
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 10000 });
            const title = await page.title();
            const ssPath = join(homedir(), '.soupz-agents', `screenshot-${Date.now()}.png`);
            await page.screenshot({ path: ssPath, fullPage: false });
            const text = await page.evaluate(() => document.body?.innerText?.slice(0, 300) || '');
            await browser.close();
            console.log(chalk.green(`  ✔ ${title || url}`));
            console.log(chalk.dim(`  📸 ${ssPath}`));
            if (text) console.log(chalk.dim(`  ${text.slice(0, 150).replace(/\n/g, ' ')}…`));
        } catch (err) {
            console.log(chalk.red(`  ✖ ${err.message}`));
        }
    },

    async handleSvgArt(input) {
        const HR_SVG = chalk.hex('#FF6B35')('━'.repeat(55));
        const args = input.replace('/svgart', '').trim();
        const typeMatch = args.match(/^(logo|icon|hero|illustration|pattern|badge|banner)\s+/i);
        const svgType = typeMatch ? typeMatch[1].toLowerCase() : 'asset';
        const desc = args.replace(typeMatch?.[0] || '', '').replace(/^["']|["']$/g, '').trim();

        if (!desc) {
            console.log('\n' + HR_SVG);
            console.log(chalk.hex('#FF6B35').bold('  🎨 /svgart — SVG Asset Generator'));
            console.log(HR_SVG);
            console.log(chalk.dim('\n  Usage: /svgart <type> "description"\n'));
            console.log(chalk.dim('  Types: logo | icon | hero | illustration | pattern | badge | banner\n'));
            console.log(HR_SVG + '\n');
            return;
        }

        const toolId = this.activeTool || this.pickBestTool(desc);
        if (!toolId) { console.log(chalk.red('  No kitchen open.')); return; }

        const geoPatterns = /\b(map|country|nation|state|province|border|coastline|geography|geo|india|usa|china|europe|africa|continent|region|territory)\b/i;
        if (geoPatterns.test(desc)) {
            console.log(chalk.hex('#FF6B6B').bold('\n  ⛔ Geographic shapes not supported\n'));
            return;
        }

        const viewports = { logo: '0 0 360 100', icon: '0 0 24 24', hero: '0 0 1440 600', illustration: '0 0 800 600', pattern: '0 0 40 40', badge: '0 0 120 40', banner: '0 0 1200 300', asset: '0 0 400 400' };
        const viewBox = viewports[svgType] || '0 0 400 400';
        const [,, w, h] = viewBox.split(' ');

        console.log('\n' + HR_SVG);
        console.log(chalk.hex('#FF6B35').bold(`  🎨 Generating SVG ${svgType}: "${desc}"`));
        console.log(HR_SVG + '\n');

        const systemPrompt = `You are an expert SVG designer. Output ONLY valid SVG markup — no markdown, no explanation, no code fences.
Must include: xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${w}" height="${h}"
Design brief: ${desc}`;

        this.startSpinner(toolId);
        try {
            const rawOutput = await this.spawner.run(toolId, systemPrompt, this.cwd);
            this.stopSpinner();
            const svgBlocks = [];
            const svgRegex = /<svg[\s\S]*?<\/svg>/gi;
            let match;
            while ((match = svgRegex.exec(rawOutput)) !== null) svgBlocks.push(match[0]);

            if (!svgBlocks.length) { console.log(chalk.yellow('  ⚠ No complete <svg> block found.')); return; }

            const assetsDir = join(this.cwd, 'assets');
            if (!existsSync(assetsDir)) mkdirSync(assetsDir, { recursive: true });

            for (let i = 0; i < svgBlocks.length; i++) {
                const slug = desc.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30);
                const filename = `${svgType}-${slug}${svgBlocks.length > 1 ? `-${i+1}` : ''}.svg`;
                writeFileSync(join(assetsDir, filename), svgBlocks[i], 'utf8');
                console.log(chalk.hex('#6BCB77').bold(`  ✅ SVG saved: ${filename}`));
            }
        } catch (err) {
            this.stopSpinner();
            console.log(chalk.red(`  ✖ Generation failed: ${err.message}`));
        }
    }
};
