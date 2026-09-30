// Every commit ID the project records about itself must exist in this repository's history,
// so a reader can check out the exact code behind the Evidence page and the app map.
// Skips outside a git checkout or in a shallow clone, where old commits may be absent.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

let skip = false;
try {
  if (git('rev-parse', '--is-inside-work-tree') !== 'true') skip = 'not a git checkout';
  else if (git('rev-parse', '--is-shallow-repository') === 'true') skip = 'shallow clone';
} catch {
  skip = 'git not available';
}

// "Exists" must mean "is in this branch's history". Asking whether the object exists is not
// enough: after a history rewrite, old commits linger in the local object store through the
// reflog, so a stale ID would still pass. An ancestor check fails for them, as a fresh clone would.
const exists = (id) => {
  try { git('merge-base', '--is-ancestor', id, 'HEAD'); return true; } catch { return false; }
};

test('the Evidence run records a commit that exists, and its inputs matched that commit', { skip }, () => {
  const e = JSON.parse(read('../data/evidence.json'));
  assert.match(e.commit, /^[0-9a-f]{7,40}$/);
  assert.ok(exists(e.commit), `data/evidence.json records ${e.commit}, which is not in history`);
  assert.equal(e.commit_clean, true, 'the run had uncommitted input changes, so its commit does not reproduce it');
});

test('every commit ID cited in the app map and the build checklist exists', { skip }, () => {
  for (const file of ['../devpost/app-map.html', '../devpost/checklist.md']) {
    const ids = [...read(file).matchAll(/commit\s+(?:<code>|`)?([0-9a-f]{7,40})\b/g)].map((m) => m[1]);
    assert.ok(ids.length > 0, `${file} cites no commits; the pattern may be stale`);
    for (const id of ids) assert.ok(exists(id), `${file} cites ${id}, which is not in history`);
  }
});
