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
  assert.ok(/\.site-header[^{]*\{[^}]*display:\s*none/s.test(css) || /\.no-print,\s*\.site-header/.test(css), 'the site header is hidden in print');
});

test('all three pages share the same header: Heat Meds, Check my medicines, Evidence, theme toggle', () => {
  const headerOf = (f) => {
    const m = read(f).match(/<header class="site-header">[\s\S]*?<\/header>/);
    assert.ok(m, `${f} has the site header`);
    return m[0].replace(/ aria-current="page"/g, '');
  };
  const home = headerOf('index.html');
  assert.equal(headerOf('plan.html'), home, 'plan.html header matches the home page');
  assert.equal(headerOf('evidence.html'), home, 'evidence.html header matches the home page');
  assert.match(home, />Heat Meds</);
  assert.match(home, /href="index.html#check">Check my medicines</);
  assert.match(home, /href="evidence.html">Evidence</);
  assert.match(home, /id="themeToggle"/);
  assert.ok(read('evidence.html').includes('href="evidence.html" aria-current="page"'), 'Evidence is marked current on its page');
});

test('every page has Open Graph and Twitter preview tags pointing at the 1200 x 630 preview image', () => {
  const IMAGE = 'https://usv240.github.io/heat-meds/assets/social-preview.png';
  for (const f of ['index.html', 'plan.html', 'evidence.html']) {
    const html = read(f);
    const meta = (attr, name) => (html.match(new RegExp(`<meta ${attr}="${name}" content="([^"]*)"`)) ?? [])[1];
    for (const p of ['og:title', 'og:description', 'og:url', 'og:image:alt']) assert.ok(meta('property', p), `${f}: ${p}`);
    assert.equal(meta('property', 'og:image'), IMAGE, `${f}: og:image`);
    assert.equal(meta('property', 'og:image:width'), '1200');
    assert.equal(meta('property', 'og:image:height'), '630');
    assert.match(meta('property', 'og:url'), /^https:\/\/usv240\.github\.io\/heat-meds\//);
    assert.equal(meta('name', 'twitter:card'), 'summary_large_image', `${f}: twitter:card`);
    assert.equal(meta('name', 'twitter:image'), IMAGE, `${f}: twitter:image`);
    for (const p of ['twitter:title', 'twitter:description', 'twitter:image:alt']) assert.ok(meta('name', p), `${f}: ${p}`);
  }
  const png = readFileSync(new URL('assets/social-preview.png', root));
  assert.equal(png.subarray(1, 4).toString('latin1'), 'PNG', 'the preview is a PNG');
  assert.equal(png.readUInt32BE(16), 1200, 'preview width');
  assert.equal(png.readUInt32BE(20), 630, 'preview height');
  assert.ok(png.length < 1024 * 1024, 'under 1 MB, the GitHub social preview limit');
});
