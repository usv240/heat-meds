// Copy rules from the PRD: no em dashes, no emojis, exact trust line and closing line.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const root = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');

const SITE_FILES = ['index.html', 'plan.html', 'evidence.html', 'README.md', ...readdirSync(new URL('src/', root)).map((f) => `src/${f}`)];
const DATA_FILES = readdirSync(new URL('data/', root)).filter((f) => f.endsWith('.json')).map((f) => `data/${f}`);

const EM_DASH = /—/;
// Emoji presentation characters and common pictographs.
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{1F000}-\u{1F2FF}\u{2600}-\u{27BF}\u{FE0F}]/u;

test('no em dash in any site file or data string', () => {
  for (const f of [...SITE_FILES, ...DATA_FILES]) assert.ok(!EM_DASH.test(read(f)), `em dash in ${f}`);
});

test('no emoji in any site file or data string', () => {
  for (const f of [...SITE_FILES, ...DATA_FILES]) assert.ok(!EMOJI.test(read(f)), `emoji in ${f}`);
});

test('the trust line matches the PRD exactly', () => {
  const expected = "Free. No account. We don't store anything. To check your list, medicine names are looked up in the National Library of Medicine's RxNorm and your ZIP goes to the National Weather Service.";
  assert.ok(read('index.html').includes(expected), 'trust line missing or altered');
});

test('the closing line matches the PRD exactly', () => {
  const rules = JSON.parse(read('data/cdc-rules.json'));
  assert.equal(rules.never_stop.text, 'Never stop or change a medicine on your own. Talk to your pharmacist or doctor.');
});

test('the landing page has the References section, the Evidence link, and the NLM attribution', () => {
  const html = read('index.html');
  assert.ok(/id="references"/.test(html));
  assert.ok(html.includes('href="evidence.html"'));
  assert.ok(html.includes('This product uses publicly available data from the U.S. National Library of Medicine (NLM)'));
});

test('fonts are self-hosted with the OFL alongside, and no external font or script is referenced', () => {
  const fonts = readdirSync(new URL('assets/fonts/', root));
  assert.ok(fonts.includes('AtkinsonHyperlegibleNext-Variable.woff2'));
  assert.ok(fonts.includes('OFL.txt'));
  for (const f of ['index.html', 'plan.html', 'evidence.html', 'assets/site.css']) {
    const s = read(f);
    assert.ok(!/fonts\.googleapis|fonts\.gstatic|cdn\.|unpkg|jsdelivr/.test(s), `external asset in ${f}`);
  }
});

test('print stylesheet is linked on the plan page and hides controls', () => {
  assert.ok(read('plan.html').includes('assets/print.css'));
  const css = read('assets/print.css');
  assert.ok(/size:\s*Letter/.test(css));
  assert.ok(/\.info-btn[^{]*display:\s*none/s.test(css) || /\.no-print,[^{]*\.info-btn[^{]*\{[^}]*display:\s*none/s.test(css));
});
