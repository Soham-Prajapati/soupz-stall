import puppeteer from 'puppeteer-core';
import { execSync } from 'child_process';

export class BrowserAutomation {
    constructor() {
        this.browser = null;
        this.page = null;
    }

    async launch() {
        if (this.browser) return;
        
        // Find Chrome/Chromium
        const chromePath = this._findChrome();
        
        this.browser = await puppeteer.launch({
            executablePath: chromePath,
            headless: false, // Show browser like Claude Code
            defaultViewport: { width: 1280, height: 720 },
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled'
            ]
        });
        
        this.page = await this.browser.newPage();
        
        // Inject helper functions
        await this.page.evaluateOnNewDocument(() => {
            window.__soupz = {
                highlight: (selector) => {
                    const el = document.querySelector(selector);
                    if (el) {
                        el.style.outline = '3px solid #4ECDC4';
                        el.style.outlineOffset = '2px';
                    }
                },
                unhighlight: (selector) => {
                    const el = document.querySelector(selector);
                    if (el) el.style.outline = '';
                }
            };
        });
    }

    async navigate(url) {
        if (!this.page) await this.launch();
        await this.page.goto(url, { waitUntil: 'networkidle2' });
        return { success: true, url: this.page.url() };
    }

    async click(selector) {
        if (!this.page) throw new Error('Browser not launched');
        
        // Highlight element
        await this.page.evaluate((sel) => window.__soupz.highlight(sel), selector);
        await this.page.waitForTimeout(500);
        
        // Click
        await this.page.click(selector);
        await this.page.waitForTimeout(500);
        
        // Unhighlight
        await this.page.evaluate((sel) => window.__soupz.unhighlight(sel), selector);
        
        return { success: true, selector };
    }

    async type(selector, text) {
        if (!this.page) throw new Error('Browser not launched');
        
        await this.page.evaluate((sel) => window.__soupz.highlight(sel), selector);
        await this.page.waitForTimeout(300);
        
        await this.page.type(selector, text, { delay: 50 });
        
        await this.page.evaluate((sel) => window.__soupz.unhighlight(sel), selector);
        
        return { success: true, selector, text };
    }

    async screenshot(fullPage = false) {
        if (!this.page) throw new Error('Browser not launched');
        
        const buffer = await this.page.screenshot({ 
            fullPage,
            type: 'png'
        });
        
        return buffer;
    }

    async evaluate(code) {
        if (!this.page) throw new Error('Browser not launched');
        return await this.page.evaluate(code);
    }

    async getElements(selector) {
        if (!this.page) throw new Error('Browser not launched');
        
        return await this.page.evaluate((sel) => {
            const elements = Array.from(document.querySelectorAll(sel));
            return elements.map(el => ({
                tag: el.tagName.toLowerCase(),
                text: el.textContent.trim().slice(0, 100),
                id: el.id,
                classes: Array.from(el.classList),
                visible: el.offsetParent !== null
            }));
        }, selector);
    }

    async waitFor(selector, timeout = 5000) {
        if (!this.page) throw new Error('Browser not launched');
        await this.page.waitForSelector(selector, { timeout });
        return { success: true, selector };
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
        }
    }

    _findChrome() {
        const paths = [
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/Applications/Chromium.app/Contents/MacOS/Chromium',
            '/usr/bin/google-chrome',
            '/usr/bin/chromium-browser',
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
        ];
        
        for (const path of paths) {
            try {
                if (require('fs').existsSync(path)) return path;
            } catch {}
        }
        
        // Try to find via which
        try {
            return execSync('which google-chrome || which chromium-browser', { encoding: 'utf8' }).trim();
        } catch {}
        
        throw new Error('Chrome/Chromium not found. Please install Google Chrome.');
    }
}

// Usage example:
// const browser = new BrowserAutomation();
// await browser.navigate('http://localhost:3000');
// await browser.click('button.login');
// await browser.type('input[name="email"]', 'test@example.com');
// const screenshot = await browser.screenshot();
