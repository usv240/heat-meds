// The Phoenix example must print on one Letter page. Runs only when a headless-capable browser is present.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { findBrowser } from '../scripts/check-print.mjs';

const browser = findBrowser();

test('the Phoenix example prints on exactly one Letter page (headless Chrome)', { skip: browser ? false : 'no Chrome or Edge found; set CHROME_PATH' }, () => {
  const out = execFileSync(process.execPath, [fileURLToPath(new URL('../scripts/check-print.mjs', import.meta.url))], { encoding: 'utf8', timeout: 90000 });
  assert.match(out, /: 1 page\(s\)/);
  assert.match(out, /OK: one page/);
});
