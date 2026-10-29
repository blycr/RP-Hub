import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const root = process.cwd();
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const server = createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
  const target = pathname === '/' ? 'index.html' : pathname.endsWith('/') ? pathname.slice(1) + 'index.html' : pathname.slice(1);
  const file = normalize(join(root, target));
  if (!file.startsWith(root)) { response.writeHead(403).end(); return; }
  try {
    const body = await readFile(file);
    response.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    response.end(body);
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const executablePath = process.env.RPHUB_CHROMIUM_PATH;
if (!executablePath) throw new Error('RPHUB_CHROMIUM_PATH is required');
const browser = await chromium.launch({ headless: true, executablePath, args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
let failed = false;
try {
  for (const route of ['/', '/character/', '/novel/']) {
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 300, downloadThroughput: 137500, uploadThroughput: 68750 });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('requestfailed', request => { if (!request.url().startsWith('https://fonts.googleapis.com/')) errors.push('request failed: ' + request.url()); });
    await page.goto('http://127.0.0.1:' + port + route, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForFunction(() => !document.querySelector('[v-cloak]') || getComputedStyle(document.querySelector('[v-cloak]')).display !== 'none', null, { timeout: 45000 });
    const result = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      const paintEntries = performance.getEntriesByType('paint');
      const paint = Object.fromEntries(paintEntries.map(entry => [entry.name, Math.round(entry.startTime)]));
      return { mounted: !!document.querySelector('#app') && !document.querySelector('#app')?.hasAttribute('v-cloak'), bootShell: document.querySelector('#rphub-boot-shell')?.dataset.state || 'absent', domContentLoadedMs: Math.round(nav?.domContentLoadedEventEnd || 0), loadMs: Math.round(nav?.loadEventEnd || 0), firstContentfulPaintMs: paint.firstContentfulPaint || null, appFirstPaintMs: Number(document.documentElement.dataset.appFirstPaint || 0) || null, resources: performance.getEntriesByType('resource').length, bootAtMs: window.__rphubBootAt ? Math.round(window.__rphubBootAt) : null, transferBytes: performance.getEntriesByType('resource').reduce((sum, entry) => sum + (entry.transferSize || 0), 0), decodedBytes: performance.getEntriesByType('resource').reduce((sum, entry) => sum + (entry.decodedBodySize || 0), 0), slowLongTasks: performance.getEntriesByType('longtask')?.length || null, externalCritical: [...document.scripts].map(s => s.src).filter(src => /cdn\\.tailwindcss|unpkg\\.com|cdn\\.jsdelivr/.test(src)) };
    });
    console.log(route, JSON.stringify(result), errors.length ? errors.join(' | ') : 'no page errors');
    if (!result.mounted || errors.length || result.externalCritical.length || (route === '/' && result.bootShell !== 'ready')) failed = true;
    await page.close();
  }
} finally {
  await context.close();
  await browser.close();
  server.close();
}
if (failed) process.exitCode = 1;
