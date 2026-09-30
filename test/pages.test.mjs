// Browser-level checks: no page wider than a 375 px phone, and a Honolulu ZIP shows
// "isn't available" with no boxes and no "today" or "where you live". Runs only when a
// headless-capable browser is present.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { findBrowser } from '../scripts/check-print.mjs';

const browser = findBrowser();

test('every page fits 375 px and the Honolulu plan never shows saved data as local weather (headless Chrome)', { skip: browser ? false : 'no Chrome or Edge found; set CHROME_PATH', timeout: 180000 }, () => {
  let out;
  try {
    out = execFileSync(process.execPath, [fileURLToPath(new URL('../scripts/check-pages.mjs', import.meta.url)), '375'], { encoding: 'utf8', timeout: 170000 });
  } catch (e) {
    assert.fail(`check-pages failed:\n${e.stdout ?? ''}${e.stderr ?? ''}`);
  }
  assert.ok(!/FAIL/.test(out), out);
  assert.match(out, /Honolulu 96813/);
  assert.match(out, /boxes 0/);
});
