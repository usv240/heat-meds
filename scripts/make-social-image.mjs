// Builds assets/social-preview.png (1200 x 630), the Open Graph, Twitter, and GitHub social preview.
// It captures the real home page hero, headline beside the live example plan, rendered by the
// same code as the site, in light mode. The only changes made for the capture are layout ones:
// the header, lower sections, and info buttons are hidden and the type is scaled to fit the card.
// Usage: node scripts/make-social-image.mjs

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join, extname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { findBrowser } from './check-print.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '');
const OUT = join(ROOT, 'assets', 'social-preview.png');
const W = 1200;
const H = 630;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

const CAPTURE_CSS = `
  html { font-size: 14px !important; overflow: hidden !important; }
  .hero-preview { padding: 14px 16px 14px !important; }
  .hero-preview .med-card p { margin: .35rem 0 .5rem !important; }
  .site-nav, .theme-toggle, .how-it-works, .narrow, .trust, .example-cta, .info-btn { display: none !important; }
  .site-header { max-width: none !important; padding: 30px 56px 6px !important; border-bottom: none !important; }
  .brand { font-size: 1.6rem !important; color: #a84d17 !important; }
  .page-home main { max-width: none !important; padding: 18px 56px 0 !important; }
  .hero { grid-template-columns: minmax(0, 1fr) minmax(0, 1.02fr) !important; gap: 52px !important; }
  .hero h1 { font-size: 3.4rem !important; line-height: 1.1 !important; margin-top: 10px !important; }
  .lede { font-size: 1.35rem !important; line-height: 1.5 !important; }
  .hero-preview { box-shadow: 0 16px 40px rgba(0, 0, 0, .10) !important; }
`;
const BOTTOM_MARGIN = 18;

function serve() {
  return new Promise((res) => {
    const server = createServer((req, resp) => {
      const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      const file = join(ROOT, path === '/' ? 'index.html' : path);
      if (!file.startsWith(ROOT) || !existsSync(file) || statSync(file).isDirectory()) { resp.writeHead(404); resp.end(); return; }
      resp.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
      resp.end(readFileSync(file));
    });
    server.listen(0, '127.0.0.1', () => res({ server, port: server.address().port }));
  });
}

function devtoolsUrl(proc) {
  return new Promise((res, rej) => {
    let buf = '';
    const t = setTimeout(() => rej(new Error('no DevTools URL')), 20000);
    proc.stderr.on('data', (d) => {
      buf += d.toString();
      const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) { clearTimeout(t); res(m[1]); }
    });
  });
}

const browser = findBrowser();
if (!browser) { console.error('No Chrome or Edge found. Set CHROME_PATH.'); process.exit(2); }
const { server, port } = await serve();
const profile = mkdtempSync(join(tmpdir(), 'heatmeds-social-'));
const proc = spawn(browser, ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
try {
  const ws = new WebSocket(await devtoolsUrl(proc));
  await new Promise((r) => { ws.onopen = r; });
  let id = 0;
  const pending = new Map();
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
  const send = (method, params = {}, sessionId) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank' });
  const { result: { sessionId } } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false }, sessionId);
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] }, sessionId);
  await send('Page.enable', {}, sessionId);
  await send('Page.navigate', { url: `http://127.0.0.1:${port}/index.html` }, sessionId);
  for (let i = 0; i < 100; i++) {
    const { result } = await send('Runtime.evaluate', { expression: `document.querySelectorAll('.hero-preview .med-card').length`, returnByValue: true }, sessionId);
    if (result.result.value > 0) break;
    await wait(200);
  }
  await send('Runtime.evaluate', { expression: `(() => { const s = document.createElement('style'); s.textContent = ${JSON.stringify(CAPTURE_CSS)}; document.head.append(s); return 'ok'; })()` }, sessionId);
  await send('Runtime.evaluate', { expression: `document.fonts.ready.then(() => true)`, awaitPromise: true }, sessionId);
  await wait(500);
  const { result: fit } = await send('Runtime.evaluate', { expression: `JSON.stringify({ bottom: Math.max(document.querySelector('.hero-copy').getBoundingClientRect().bottom, document.querySelector('.hero-preview').getBoundingClientRect().bottom), sw: document.documentElement.scrollWidth })`, returnByValue: true }, sessionId);
  const m = JSON.parse(fit.result.value);
  const { result } = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: W, height: H, scale: 1 } }, sessionId);
  writeFileSync(OUT, Buffer.from(result.data, 'base64'));
  const png = readFileSync(OUT);
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  console.log(`Wrote ${OUT}: ${width} x ${height}, hero content ends at ${Math.round(m.bottom)} px of ${H}, page width ${m.sw}`);
  if (width !== W || height !== H) { console.error('FAIL: wrong size'); process.exitCode = 1; }
  if (m.bottom > H - BOTTOM_MARGIN) { console.error(`FAIL: hero content is cut off or crowds the edge (${Math.round(m.bottom)} > ${H - BOTTOM_MARGIN})`); process.exitCode = 1; }
  if (m.sw !== W) { console.error(`FAIL: page width ${m.sw}, expected ${W} (a scrollbar or overflow)`); process.exitCode = 1; }
  ws.close();
} finally {
  proc.kill();
  server.close();
}
