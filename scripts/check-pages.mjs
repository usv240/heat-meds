// Browser checks that screenshots cannot make reliably. Each page loads in headless Chrome with
// device emulation (not subject to Chrome's minimum window width) at every requested width.
//
//  On every page:
//   - no horizontal overflow (scrollWidth vs viewport)
//   - the shared header: Heat Meds, Check my medicines, Evidence, theme toggle
//   - no table cell or heat-box word is narrower than its longest word (catches letter-by-letter wrapping)
//  Page-specific:
//   - home: the live example preview (7 heat boxes, the furosemide card, labeled Example) sits beside
//     the headline at 900 px and wider and below it on phones; the example caption sits below its
//     button; the How it works strip has 3 steps
//   - the example plan renders cards and 7 boxes and shows no brand names
//   - a Honolulu ZIP shows "isn't available", no boxes, and never says today or where you live
//   - the Evidence summary shows numbers that match data/evidence.json, with two agreement bars
//   - typed names resolve live (375 px only, to limit calls to NLM)
//
// Usage: node scripts/check-pages.mjs [widths]            e.g. 375,1280 (default 375)
//        BASE_URL=https://usv240.github.io/heat-meds/ ...   check a deployed site
//        SCHEME=dark ...                                    emulate dark mode (default light)
//        SHOTS_DIR=some/folder ...                          also save full-page screenshots

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, extname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { findBrowser } from './check-print.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '');
const WIDTHS = String(process.argv[2] ?? '375').split(',').map(Number).filter(Boolean);
const SCHEME = process.env.SCHEME === 'dark' ? 'dark' : 'light';
const SHOTS_DIR = process.env.SHOTS_DIR ?? null;
const LOOKUPS = JSON.parse(readFileSync(join(ROOT, 'data', 'saved-lookups.json'), 'utf8')).lookups;

const READY = {
  home: `document.querySelectorAll('.hero-preview .med-card').length > 0`,
  plan: `document.querySelectorAll('#planArea .med-card').length > 0 && document.querySelectorAll('#heatArea .heat-day').length > 0`,
  summary: `(document.getElementById('summaryArea')?.innerText || '').length > 0`,
  evidence: `!!document.querySelector('.evidence-summary')`,
};

const PAGES = [
  { page: 'index.html', ready: READY.home, expectHome: true },
  { page: 'plan.html?example=1', ready: READY.plan, expectPlan: true, noBrands: true },
  { page: 'evidence.html', ready: READY.evidence, expectEvidence: true, openDetails: true },
  { page: 'plan.html', label: 'plan.html (Honolulu 96813)', ready: READY.summary, zip: '96813', list: [LOOKUPS.lasix, LOOKUPS.lisinopril], expectUnavailable: true },
  { page: 'index.html', label: 'index.html (type Lasix 40 mg)', ready: READY.home, type: 'Lasix 40 mg', expectChip: /Lasix 40 mg → furosemide/, onlyWidth: 375 },
  // The three names the demo video types, checked the way a person would enter them.
  { page: 'index.html', label: 'demo: furosamide', ready: READY.home, type: 'furosamide', expectChip: /furosamide: did you mean furosemide\?/, onlyWidth: 375 },
  { page: 'index.html', label: 'demo: metoprolol succinate', ready: READY.home, type: 'metoprolol succinate 25 mg tablet', expectChip: /metoprolol succinate 25 mg tablet → metoprolol succinate/, onlyWidth: 375 },
  { page: 'index.html', label: 'demo: combination pill', ready: READY.home, type: 'lisinopril-hydrochlorothiazide', expectChip: /lisinopril-hydrochlorothiazide → (lisinopril \+ hydrochlorothiazide|hydrochlorothiazide \+ lisinopril)/, onlyWidth: 375 },
];
const BRANDS = /\b(Lasix|Zoloft|Lantus|Lipitor|Zestril|Prinivil|Toprol)\b/;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png' };

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
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  };
  const open = new Promise((r) => { ws.onopen = r; });
  return {
    open,
    send: (method, params = {}, sessionId) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params, sessionId })); }),
    close: () => ws.close(),
  };
}

// Runs in the page: every table cell and heat-box word must be at least as wide as its longest word.
const WORD_CHECK = `(() => {
  const bad = [];
  const probe = document.createElement('span');
  probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;left:-9999px;top:0';
  document.body.appendChild(probe);
  for (const cell of document.querySelectorAll('th, td, .heat-day .word')) {
    if (cell.offsetParent === null) continue;
    // Break points are spaces and hyphens, the same places the browser may wrap normally.
    const words = (cell.innerText || '').split(/\\s+|(?<=-)/).filter(Boolean);
    if (!words.length) continue;
    const cs = getComputedStyle(cell);
    probe.style.font = cs.font;
    probe.style.letterSpacing = cs.letterSpacing;
    probe.style.textTransform = cs.textTransform;
    let longest = 0, word = '';
    for (const w of words) { probe.textContent = w; const wd = probe.getBoundingClientRect().width; if (wd > longest) { longest = wd; word = w; } }
    const content = cell.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    if (content + 1 < longest) bad.push(cell.tagName.toLowerCase() + ' "' + word + '" needs ' + Math.ceil(longest) + 'px, has ' + Math.floor(content) + 'px');
  }
  probe.remove();
  return bad;
})()`;

const PROBE = `(() => {
  const r = (el) => el ? el.getBoundingClientRect() : null;
  const header = document.querySelector('header.site-header');
  const out = {
    sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
    err: document.body.innerText.includes('Something went wrong'),
    bodyText: document.body.innerText,
    header: header ? {
      brand: header.querySelector('.brand')?.innerText.trim() ?? null,
      links: [...header.querySelectorAll('nav a')].map((a) => a.innerText.trim()),
      toggle: !!header.querySelector('#themeToggle'),
    } : null,
    boxes: document.querySelectorAll('#heatArea .heat-day').length,
    cards: document.querySelectorAll('#planArea .med-card').length,
    heat: document.getElementById('heatArea')?.innerText ?? '',
    summary: document.getElementById('summaryArea')?.innerText ?? '',
    label: document.getElementById('heatLabel')?.hidden === false ? document.getElementById('heatLabel').innerText : '',
    chips: [...document.querySelectorAll('.chip .chip-text')].map((x) => x.innerText).join(' | '),
  };
  const preview = document.querySelector('.hero-preview');
  if (preview) {
    const copy = r(document.querySelector('.hero-copy'));
    const h1 = r(document.querySelector('.hero h1'));
    const pv = r(preview);
    const btn = r(document.querySelector('.example-cta .button'));
    const cap = r(document.querySelector('.example-cta .caption'));
    out.home = {
      previewBoxes: preview.querySelectorAll('.heat-day').length,
      previewCards: preview.querySelectorAll('.med-card').length,
      previewCardText: preview.querySelector('.med-card')?.innerText ?? '',
      previewLabel: preview.querySelector('.preview-label')?.innerText ?? '',
      previewPast: preview.innerText.includes('Past heat wave'),
      beside: !!(copy && pv && pv.left >= copy.right - 1 && pv.top < h1.bottom),
      below: !!(h1 && pv && pv.top >= h1.bottom - 1),
      captionBelow: !!(btn && cap && cap.top >= btn.bottom - 1),
      howSteps: document.querySelectorAll('.how-it-works li').length,
    };
  }
  return JSON.stringify(out);
})()`;

// Runs in the page: the summary's numbers must match data/evidence.json.
const EVIDENCE_CHECK = `(async () => {
  const e = await (await fetch('data/evidence.json', { cache: 'no-store' })).json();
  const s = document.querySelector('.evidence-summary');
  if (!s) return ['no .evidence-summary'];
  const t = s.innerText.replace(/\\s+/g, ' ');
  const bad = [];
  const want = [
    e.test_set.count + ' medicines tested',
    e.must_be_zero.flags_without_cdc_quote + ' cards without a CDC quote',
    e.must_be_zero.stop_instructions + ' plans that say stop',
  ];
  for (const w of want) if (!t.includes(w)) bad.push('summary missing "' + w + '"');
  const bars = [...s.querySelectorAll('.bar-fill')];
  if (bars.length !== 2) bad.push(bars.length + ' agreement bars');
  const rates = [e.agreement.ukhsa.rate, e.agreement.health_canada.rate];
  bars.forEach((b, i) => {
    const pct = parseFloat(b.style.width);
    if (Math.abs(pct - rates[i] * 100) > 0.05) bad.push('bar ' + i + ' width ' + b.style.width + ' vs rate ' + rates[i]);
  });
  if (!/every disagreement is listed below/i.test(t)) bad.push('no pointer to the disagreements');
  return bad;
})()`;

const browser = findBrowser();
if (!browser) { console.error('No Chrome or Edge found. Set CHROME_PATH.'); process.exit(2); }
const BASE_URL = process.env.BASE_URL ? process.env.BASE_URL.replace(/\/?$/, '/') : null;
const { server, port } = BASE_URL ? { server: null, port: null } : await serve();
const base = BASE_URL ?? `http://127.0.0.1:${port}/`;
console.log(`Checking ${BASE_URL ?? 'local copy'} at ${WIDTHS.join(', ')} px, ${SCHEME} mode`);
if (SHOTS_DIR) mkdirSync(SHOTS_DIR, { recursive: true });

const profile = mkdtempSync(join(tmpdir(), 'heatmeds-pages-'));
const proc = spawn(browser, ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
let failures = 0;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function evaluate(c, sessionId, expression, awaitPromise = false) {
  const { result } = await c.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise }, sessionId);
  return result?.result?.value;
}

async function waitFor(c, sessionId, expression, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await evaluate(c, sessionId, `(() => { try { return !!(${expression}); } catch { return false; } })()`)) {
      await evaluate(c, sessionId, `document.fonts.ready.then(() => true)`, true);
      await wait(300);
      return true;
    }
    await wait(200);
  }
  return false;
}

try {
  const c = cdp(await devtoolsUrl(proc));
  await c.open;
  for (const width of WIDTHS) {
    for (const spec of PAGES) {
      if (spec.onlyWidth && spec.onlyWidth !== width) continue;
      const label = `${spec.label ?? spec.page} @${width}`;
      const { result: { targetId } } = await c.send('Target.createTarget', { url: 'about:blank' });
      const { result: { sessionId } } = await c.send('Target.attachToTarget', { targetId, flatten: true });
      const mobile = width < 600;
      await c.send('Emulation.setDeviceMetricsOverride', { width, height: mobile ? 800 : 900, deviceScaleFactor: mobile ? 2 : 1, mobile }, sessionId);
      await c.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: SCHEME }] }, sessionId);
      await c.send('Page.enable', {}, sessionId);
      if (spec.zip) {
        // Seed this origin's localStorage the way the landing page would, then open the plan.
        await c.send('Page.navigate', { url: `${base}index.html` }, sessionId);
        await waitFor(c, sessionId, READY.home);
        const seed = `localStorage.setItem('heatmeds.zip', ${JSON.stringify(spec.zip)}); localStorage.setItem('heatmeds.list', ${JSON.stringify(JSON.stringify(spec.list))}); 'ok'`;
        await evaluate(c, sessionId, seed);
      }
      await c.send('Page.navigate', { url: `${base}${spec.page}` }, sessionId);
      const ready = await waitFor(c, sessionId, spec.ready);
      const problems = [];
      if (!ready) problems.push('page never became ready');
      if (spec.type) {
        // Type a name and press Add, exactly as a person would; the chip resolves through live RxNorm.
        const before = await evaluate(c, sessionId, `document.querySelectorAll('.chip').length`);
        await evaluate(c, sessionId, `(() => { localStorage.removeItem('heatmeds.list'); const i = document.getElementById('medicine'); i.value = ${JSON.stringify(spec.type)}; document.getElementById('addMedicine').click(); return 'typed'; })()`);
        const settled = await waitFor(c, sessionId, `(() => { const cs = [...document.querySelectorAll('.chip')]; return cs.length > ${before} && !cs.some((x) => x.classList.contains('chip-checking')); })()`, 30000);
        if (!settled) problems.push('typed chip never settled');
      }
      if (spec.openDetails) await evaluate(c, sessionId, `document.querySelectorAll('details').forEach((d) => { d.open = true; }); 'ok'`);
      await wait(150);

      const m = JSON.parse(await evaluate(c, sessionId, PROBE));
      if (m.sw > m.cw) problems.push(`scrollWidth ${m.sw} > viewport ${m.cw}`);
      if (m.err) problems.push('page error');
      if (!m.header || m.header.brand !== 'Heat Meds' || m.header.links.join('|') !== 'Check my medicines|Evidence' || !m.header.toggle) problems.push(`header: ${JSON.stringify(m.header)}`);
      const narrow = await evaluate(c, sessionId, WORD_CHECK);
      if (narrow?.length) problems.push(`${narrow.length} cells narrower than a word, e.g. ${narrow.slice(0, 3).join('; ')}`);

      if (spec.expectHome) {
        const h = m.home;
        if (!h) problems.push('no hero preview');
        else {
          if (h.previewBoxes !== 7) problems.push(`preview has ${h.previewBoxes} heat boxes`);
          if (h.previewCards !== 1 || !/furosemide/.test(h.previewCardText)) problems.push(`preview card: ${h.previewCards} "${h.previewCardText.slice(0, 40)}"`);
          if (!/^example\b/i.test(h.previewLabel)) problems.push(`preview label "${h.previewLabel}"`);
          if (!h.previewPast) problems.push('preview does not say it is a past heat wave');
          if (width >= 900 && !h.beside) problems.push('preview not beside the headline');
          if (width < 900 && !h.below) problems.push('preview not below the headline');
          if (!h.captionBelow) problems.push('example caption not below its button');
          if (h.howSteps !== 3) problems.push(`How it works has ${h.howSteps} steps`);
        }
      }
      if (spec.expectPlan) {
        if (m.cards < 3) problems.push(`${m.cards} medicine cards`);
        if (m.boxes !== 7) problems.push(`${m.boxes} heat boxes`);
      }
      if (spec.noBrands && BRANDS.test(m.bodyText)) problems.push(`brand name on page: ${m.bodyText.match(BRANDS)[0]}`);
      if (spec.expectUnavailable) {
        if (m.boxes) problems.push(`${m.boxes} heat boxes shown`);
        if (!/isn't available for this ZIP/.test(m.heat)) problems.push(`heat area: "${m.heat.slice(0, 80)}"`);
        if (/\b(today|tomorrow|where you live)\b/i.test(m.summary)) problems.push(`summary: "${m.summary}"`);
        if (m.label) problems.push(`saved-data label shown: "${m.label.slice(0, 60)}"`);
      }
      if (spec.expectEvidence) {
        const bad = await evaluate(c, sessionId, EVIDENCE_CHECK, true);
        if (bad?.length) problems.push(...bad);
      }
      if (spec.expectChip && !spec.expectChip.test(m.chips)) problems.push(`chips: "${m.chips}"`);

      if (SHOTS_DIR) {
        const { result } = await c.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }, sessionId);
        const name = `${(spec.label ?? spec.page).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')}-${width}-${SCHEME}.png`;
        writeFileSync(join(SHOTS_DIR, name), Buffer.from(result.data, 'base64'));
      }

      if (problems.length) failures++;
      const detail = spec.expectUnavailable ? `; boxes ${m.boxes}; summary "${m.summary}"`
        : spec.expectPlan ? `; cards ${m.cards}; boxes ${m.boxes}`
        : spec.expectChip ? `; chip "${m.chips.split(' | ').pop()}"`
        : spec.expectHome && m.home ? `; preview ${m.home.beside ? 'beside' : m.home.below ? 'below' : 'misplaced'}`
        : '';
      console.log(`${problems.length ? 'FAIL' : 'OK  '} ${label.padEnd(34)} width ${m.sw}/${m.cw}${detail}${problems.length ? ` -> ${problems.join('; ')}` : ''}`);
      await c.send('Target.closeTarget', { targetId });
    }
  }
  c.close();
} finally {
  proc.kill();
  server?.close();
}
process.exit(failures ? 1 : 0);
