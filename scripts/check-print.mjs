// Prints the Phoenix example to PDF with headless Chrome (or Edge) and checks it is ONE Letter page.
// Usage: node scripts/check-print.mjs [url]
// Starts a local static server on a free port, prints plan.html?example=1, counts pages, exits 1 if not 1.

import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/[\/]$/, '');
const OUT_DIR = join(ROOT, 'data', 'cache');
const OUT = join(OUT_DIR, 'print-check.pdf');

const CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  process.env.LOCALAPPDATA ? `${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe` : null,
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

export function findBrowser() {
  return CANDIDATES.find((p) => existsSync(p)) ?? null;
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

function serve() {
  return new Promise((res) => {
    const server = createServer((req, resp) => {
      const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      let file = join(ROOT, path === '/' ? 'index.html' : path);
      if (!file.startsWith(ROOT) || !existsSync(file) || statSync(file).isDirectory()) { resp.writeHead(404); resp.end(); return; }
      resp.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
      resp.end(readFileSync(file));
    });
    server.listen(0, '127.0.0.1', () => res({ server, port: server.address().port }));
  });
}

// Counts pages in a PDF by reading the page tree's /Count (Chrome writes the root Pages object uncompressed).
export function countPdfPages(buffer) {
  const text = buffer.toString('latin1');
  const counts = [...text.matchAll(/\/Type\s*\/Pages[^>]*?\/Count\s+(\d+)/g)].map((m) => Number(m[1]));
  if (counts.length) return Math.max(...counts);
  const pages = text.match(/\/Type\s*\/Page(?![s])/g);
  return pages ? pages.length : NaN;
}

export async function printToPdf(url, browser) {
  mkdirSync(OUT_DIR, { recursive: true });
  const args = [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--no-pdf-header-footer', '--virtual-time-budget=15000', '--run-all-compositor-stages-before-draw',
    `--print-to-pdf=${OUT}`, url,
  ];
  await new Promise((res, rej) => {
    const p = spawn(browser, args, { stdio: 'ignore' });
    const t = setTimeout(() => { p.kill(); rej(new Error('browser timed out')); }, 60000);
    p.on('exit', (code) => { clearTimeout(t); code === 0 || existsSync(OUT) ? res() : rej(new Error(`browser exit ${code}`)); });
    p.on('error', (e) => { clearTimeout(t); rej(e); });
  });
  return readFileSync(OUT);
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` || process.argv[1]?.endsWith('check-print.mjs')) {
  const browser = findBrowser();
  if (!browser) { console.error('No Chrome or Edge found. Set CHROME_PATH.'); process.exit(2); }
  const { server, port } = await serve();
  const url = process.argv[2] ?? `http://127.0.0.1:${port}/plan.html?example=1`;
  try {
    const pdf = await printToPdf(url, browser);
    const pages = countPdfPages(pdf);
    console.log(`${url} -> ${OUT} (${pdf.length} bytes): ${pages} page(s)`);
    if (pages !== 1) { console.error('FAIL: the example must print on one page'); process.exit(1); }
    console.log('OK: one page');
  } finally {
    server.close();
  }
}
