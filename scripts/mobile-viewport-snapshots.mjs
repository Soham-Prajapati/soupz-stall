#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const DEFAULT_URL = process.env.SOUPZ_SNAPSHOT_URL || 'http://127.0.0.1:7534';
const DEFAULT_WIDTHS = [360, 390, 430];
const DEFAULT_ROUTES = ['/', '/code', '/dashboard'];

function parseArgs(argv) {
  const args = { url: DEFAULT_URL, widths: DEFAULT_WIDTHS, routes: DEFAULT_ROUTES };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--url' && argv[i + 1]) {
      args.url = argv[++i];
      continue;
    }
    if (token === '--widths' && argv[i + 1]) {
      args.widths = argv[++i]
        .split(',')
        .map((value) => Number.parseInt(value.trim(), 10))
        .filter((value) => Number.isFinite(value) && value > 0);
      continue;
    }
    if (token === '--routes' && argv[i + 1]) {
      args.routes = argv[++i]
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => (value.startsWith('/') ? value : `/${value}`));
    }
  }
  return args;
}

function detectBrowserPath() {
  const override = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (override && existsSync(override)) return override;

  const candidatesByPlatform = {
    darwin: [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    ],
    win32: [
      'C:/Program Files/Google/Chrome/Application/chrome.exe',
      'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
      'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
      'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    ],
    linux: [
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/snap/bin/chromium',
    ],
  };

  const candidates = candidatesByPlatform[process.platform] || [];
  return candidates.find((candidate) => existsSync(candidate)) || null;
}

function normalizeBaseUrl(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

function routeToFileSegment(route) {
  const clean = String(route || '/').replace(/^\/+/, '').replace(/\//g, '-');
  return clean || 'home';
}

async function assertReachable(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) {
    throw new Error(`Snapshot target returned HTTP ${response.status} for ${url}`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const baseUrl = normalizeBaseUrl(options.url);
  if (!baseUrl) {
    throw new Error('Missing snapshot URL. Pass --url <http://host:port>.');
  }

  await assertReachable(baseUrl);

  const browserPath = detectBrowserPath();
  if (!browserPath) {
    throw new Error('No Chrome/Chromium executable found. Set PUPPETEER_EXECUTABLE_PATH to run snapshots.');
  }

  const timestamp = new Date().toISOString().replace(/[.:]/g, '-');
  const outDir = path.resolve(process.cwd(), 'tests', 'artifacts', 'mobile-snapshots', timestamp);
  await mkdir(outDir, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: browserPath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  const captures = [];
  try {
    for (const route of options.routes) {
      for (const width of options.widths) {
        const page = await browser.newPage();
        await page.setViewport({ width, height: 900, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
        const fullUrl = `${baseUrl}${route}`;
        await page.goto(fullUrl, { waitUntil: 'networkidle2', timeout: 30000 });

        const fileName = `${routeToFileSegment(route)}-${width}.png`;
        const filePath = path.join(outDir, fileName);
        await page.screenshot({ path: filePath, fullPage: true });
        captures.push({ route, width, file: fileName, url: fullUrl });
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    widths: options.widths,
    routes: options.routes,
    captures,
  };
  await writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(summary, null, 2));

  process.stdout.write(`Mobile viewport snapshots complete: ${captures.length} images in ${outDir}\n`);
}

main().catch((error) => {
  process.stderr.write(`mobile-viewport-snapshots failed: ${error.message}\n`);
  process.exit(1);
});
