// Browser checks that screenshots cannot make reliably:
//  1. No page is wider than a phone. Each page loads in headless Chrome with a 375 px viewport
//     (device emulation, which is not subject to Chrome's minimum window width) and compares
//     document.documentElement.scrollWidth with the viewport.
//  2. A Honolulu ZIP shows "isn't available" with no heat boxes and never says today or where you live.
//  3. The example plan renders its cards and seven heat boxes, and typing "Lasix 40 mg" resolves live.
// Usage: node scripts/check-pages.mjs [width]                     (serves this folder locally)
//        BASE_URL=https://usv240.github.io/heat-meds/ node scripts/check-pages.mjs   (checks a deployed site)

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdtempSync } from 'node:fs';
import { join, extname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { findBrowser } from './check-print.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '');
const WIDTH = Number(process.argv[2] ?? 375);
const LOOKUPS = JSON.parse(readFileSync(join(ROOT, 'data', 'saved-lookups.json'), 'utf8')).lookups;
const PAGES = [
  { page: 'index.html' },
  { page: 'plan.html?example=1', expectPlan: true, noBrands: true },
  { page: 'evidence.html' },
  { page: 'plan.html', label: 'plan.html (Honolulu 96813)', zip: '96813', list: [LOOKUPS.lasix, LOOKUPS.lisinopril], expectUnavailable: true },
  { page: 'index.html', label: 'index.html (type Lasix 40 mg)', type: 'Lasix 40 mg', expectChip: /Lasix 40 mg → furosemide/ },
  // The three names the demo video types, checked the way a person would enter them.
  { page: 'index.html', label: 'demo: furosamide', type: 'furosamide', expectChip: /furosamide: did you mean furosemide\?/ },
  { page: 'index.html', label: 'demo: metoprolol succinate', type: 'metoprolol succinate 25 mg tablet', expectChip: /metoprolol succinate 25 mg tablet → metoprolol succinate/ },
  { page: 'index.html', label: 'demo: combination pill', type: 'lisinopril-hydrochlorothiazide', expectChip: /lisinopril-hydrochlorothiazide → (lisinopril \+ hydrochlorothiazide|hydrochlorothiazide \+ lisinopril)/ },
];
const BRANDS = /\b(Lasix|Zoloft|Lantus|Lipitor|Zestril|Prinivil|Toprol)\b/;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

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

async function devtoolsUrl(proc) {
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

function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  const listeners = [];
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    else for (const l of listeners) l(msg);
  };
  const open = new Promise((r) => { ws.onopen = r; });
  return {
    open,
    send: (method, params = {}, sessionId) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params, sessionId })); }),
    on: (fn) => listeners.push(fn),
    close: () => ws.close(),
  };
}

const browser = findBrowser();
if (!browser) { console.error('No Chrome or Edge found. Set CHROME_PATH.'); process.exit(2); }
const BASE_URL = process.env.BASE_URL ? process.env.BASE_URL.replace(/\/?$/, '/') : null;
const { server, port } = BASE_URL ? { server: null, port: null } : await serve();
const base = BASE_URL ?? `http://127.0.0.1:${port}/`;
if (BASE_URL) console.log(`Checking deployed site ${BASE_URL}`);
const profile = mkdtempSync(join(tmpdir(), 'heatmeds-width-'));
const proc = spawn(browser, ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
let failures = 0;
try {
  const c = cdp(await devtoolsUrl(proc));
  await c.open;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  for (const spec of PAGES) {
    const label = spec.label ?? spec.page;
    const { result: { targetId } } = await c.send('Target.createTarget', { url: 'about:blank' });
    const { result: { sessionId } } = await c.send('Target.attachToTarget', { targetId, flatten: true });
    await c.send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: 800, deviceScaleFactor: 2, mobile: true }, sessionId);
    await c.send('Page.enable', {}, sessionId);
    if (spec.zip) {
      // Seed this origin's localStorage the way the landing page would, then open the plan.
      await c.send('Page.navigate', { url: `${base}index.html` }, sessionId);
      await wait(1500);
      const seed = `localStorage.setItem('heatmeds.zip', ${JSON.stringify(spec.zip)}); localStorage.setItem('heatmeds.list', ${JSON.stringify(JSON.stringify(spec.list))}); 'ok'`;
      await c.send('Runtime.evaluate', { expression: seed }, sessionId);
    }
    await c.send('Page.navigate', { url: `${base}${spec.page}` }, sessionId);
    await wait(6000);
    if (spec.type) {
      // Type a name and press Add, exactly as a person would; the chip resolves through live RxNorm.
      const typeIt = `(() => { localStorage.removeItem('heatmeds.list'); const i = document.getElementById('medicine'); i.value = ${JSON.stringify(spec.type)}; document.getElementById('addMedicine').click(); return 'typed'; })()`;
      await c.send('Runtime.evaluate', { expression: typeIt }, sessionId);
      await wait(8000);
    }
    const probe = `JSON.stringify({
      sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
      err: document.body.innerText.includes('Something went wrong'),
      boxes: document.querySelectorAll('.heat-day').length,
      heat: document.getElementById('heatArea')?.innerText ?? '',
      summary: document.getElementById('summaryArea')?.innerText ?? '',
      label: document.getElementById('heatLabel')?.hidden === false ? document.getElementById('heatLabel').innerText : '',
      cards: document.querySelectorAll('.med-card').length,
      bodyText: document.body.innerText,
      chips: [...document.querySelectorAll('.chip .chip-text')].map((x) => x.innerText).join(' | '),
    })`;
    const { result } = await c.send('Runtime.evaluate', { expression: probe, returnByValue: true }, sessionId);
    const m = JSON.parse(result.result.value);
    const problems = [];
    if (m.sw > m.cw) problems.push(`scrollWidth ${m.sw} > viewport ${m.cw}`);
    if (m.err) problems.push('page error');
    if (spec.expectUnavailable) {
      if (m.boxes) problems.push(`${m.boxes} heat boxes shown`);
      if (!/isn't available for this ZIP/.test(m.heat)) problems.push(`heat area: "${m.heat.slice(0, 80)}"`);
      if (/\b(today|tomorrow|where you live)\b/i.test(m.summary)) problems.push(`summary: "${m.summary}"`);
      if (m.label) problems.push(`saved-data label shown: "${m.label.slice(0, 60)}"`);
    }
    if (spec.expectPlan) {
      if (m.cards < 3) problems.push(`${m.cards} medicine cards`);
      if (m.boxes !== 7) problems.push(`${m.boxes} heat boxes`);
    }
    if (spec.expectChip && !spec.expectChip.test(m.chips)) problems.push(`chips: "${m.chips}"`);
    if (spec.noBrands && BRANDS.test(m.bodyText)) problems.push(`brand name on page: ${m.bodyText.match(BRANDS)[0]}`);
    if (problems.length) failures++;
    const detail = spec.expectUnavailable ? `; boxes ${m.boxes}; summary "${m.summary}"`
      : spec.expectPlan ? `; cards ${m.cards}; boxes ${m.boxes}`
      : spec.expectChip ? `; chip "${m.chips}"` : '';
    console.log(`${problems.length ? 'FAIL' : 'OK  '} ${label.padEnd(30)} width ${m.sw}/${m.cw}${detail}${problems.length ? ` -> ${problems.join('; ')}` : ''}`);
    await c.send('Target.closeTarget', { targetId });
  }
  c.close();
} finally {
  proc.kill();
  server?.close();
}
process.exit(failures ? 1 : 0);
