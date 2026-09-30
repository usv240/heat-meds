// Browser-level checks at a 375 px phone and a 1280 px desktop: no page overflows, the shared header
// is on every page, no table cell or heat box is narrower than its longest word, the home page
// preview sits beside the headline on desktop and below it on phones, the Evidence summary matches
// the run, and a Honolulu ZIP never shows saved data as local weather. Runs only when a
// headless-capable browser is present. See scripts/check-pages.mjs for every check.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { findBrowser } from '../scripts/check-print.mjs';

const browser = findBrowser();

test('every page passes the browser checks at 375 px and 1280 px (headless Chrome)', { skip: browser ? false : 'no Chrome or Edge found; set CHROME_PATH', timeout: 300000 }, () => {
  let out;
  try {
    out = execFileSync(process.execPath, [fileURLToPath(new URL('../scripts/check-pages.mjs', import.meta.url)), '375,1280'], { encoding: 'utf8', timeout: 290000 });
  } catch (e) {
    assert.fail(`check-pages failed:\n${e.stdout ?? ''}${e.stderr ?? ''}`);
  }
  assert.ok(!/FAIL/.test(out), out);
  for (const page of ['index.html @375', 'index.html @1280', 'evidence.html @1280', 'plan.html?example=1 @375']) assert.ok(out.includes(page), `${page} was checked`);
  assert.match(out, /Honolulu 96813\) @375/);
  assert.match(out, /boxes 0/);
  assert.match(out, /preview beside/);
  assert.match(out, /preview below/);
});
