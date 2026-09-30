import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const t = JSON.parse(readFileSync(new URL('../data/top300.json', import.meta.url), 'utf8'));

test('top300.json holds 300 distinct ingredients with RxCUIs and weights, derived from MEPS with method notes', () => {
  assert.equal(t.medicines.length, 300);
  const names = t.medicines.map((m) => m.ingredient.toLowerCase());
  assert.equal(new Set(names).size, 300, 'no duplicate ingredients');
  for (const m of t.medicines) {
    assert.ok(m.rxcuis.length >= 1, `${m.ingredient} has an rxcui`);
    assert.ok(m.weighted_fills > 0);
  }
  for (let i = 1; i < t.medicines.length; i++) assert.ok(t.medicines[i - 1].weighted_fills >= t.medicines[i].weighted_fills, 'sorted by weight');
  assert.match(t.source.url, /meps\.ahrq\.gov/);
  assert.ok(t.method.length >= 3);
  assert.ok(t.masked_rows_dropped > 0, 'masked category placeholders were dropped');
});

test('the top 20 looks like US prescribing: the most common statin, metformin, and levothyroxine lead', () => {
  const top20 = t.sanity_check.top20.map((s) => s.toLowerCase());
  for (const expected of ['atorvastatin', 'metformin', 'levothyroxine', 'lisinopril', 'amlodipine']) assert.ok(top20.includes(expected), expected);
});

test('no MEPS category placeholder leaked into the list, and approximate matches were only accepted with real name overlap', () => {
  const placeholder = /\b(AGENTS|INHIBITORS|PRODUCTS|BLOCKERS|ANTAGONISTS|COMBINATIONS|MISCELLANEOUS)\b/;
  for (const m of t.medicines) for (const n of m.meps_names) assert.ok(!placeholder.test(n), `placeholder leaked: ${n}`);
  for (const a of t.approximate_matches_accepted) assert.ok(a.meps_name.split(' ').some((tok) => tok.length >= 5 && a.rxnorm.toLowerCase().includes(tok.slice(0, 6))), `weak approximate match: ${a.meps_name} -> ${a.rxnorm}`);
});
