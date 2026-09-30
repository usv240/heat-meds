// The Evidence page must show only numbers from the run. These tests check the run's invariants
// and that the page code carries no hard-coded results.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const e = JSON.parse(read('../data/evidence.json'));

test('the two must-be-zero numbers are zero', () => {
  assert.equal(e.must_be_zero.flags_without_cdc_quote, 0);
  assert.equal(e.must_be_zero.stop_instructions, 0);
  assert.deepEqual(e.must_be_zero.stop_examples, []);
});

test('the run covers the whole top-300 list and its counts add up', () => {
  assert.equal(e.rows.length, 300);
  assert.equal(e.counts.resolved + e.counts.unresolved, 300);
  for (const key of ['ukhsa', 'health_canada']) {
    const a = e.agreement[key];
    assert.equal(a.total, e.counts.resolved);
    assert.equal(a.agree + a.app_only + a.key_only, a.total, `${key}: agree + disagreements = total`);
    assert.ok(a.rate > 0 && a.rate <= 1);
  }
  const dis = e.disagreements.length;
  assert.equal(dis, e.agreement.ukhsa.app_only + e.agreement.ukhsa.key_only + e.agreement.health_canada.app_only + e.agreement.health_canada.key_only);
  assert.equal(e.flags_outside_uk_and_canada.count, e.flags_outside_uk_and_canada.medicines.length);
  for (const m of e.flags_outside_uk_and_canada.medicines) assert.ok(m.cdc.every((c) => c.quote && c.quote.length > 5), `${m.ingredient} carries its CDC quote`);
  for (const d of e.disagreements) assert.ok(d.reason.length > 20, 'every disagreement has a reason');
});

test('the mapping tables in the run match the committed answer keys', () => {
  const uk = JSON.parse(read('../data/answer-keys/ukhsa.json'));
  const ca = JSON.parse(read('../data/answer-keys/health-canada.json'));
  assert.deepEqual(e.answer_keys.ukhsa.phrases, uk.phrases);
  assert.deepEqual(e.answer_keys.health_canada.phrases, ca.phrases);
  assert.equal(e.answer_keys.ansm.scored, false);
});

test('the Evidence page code contains no hard-coded results: no digits outside CSS classes, ids, and code comments', () => {
  for (const f of ['../evidence.html', '../src/evidence.js', '../src/evidence-render.js']) {
    const src = read(f).replace(/\/\/.*$/gm, '').replace(/<!--[\s\S]*?-->/g, '');
    // Allow digits only inside identifiers such as h2, N06, or "3 of", never a standalone number literal.
    const literals = src.match(/(?<![\w.'"`-])\d+(?:\.\d+)?%?(?![\w-])/g) ?? [];
    const allowed = new Set(['0', '1', '2', '3', '5', '6', '100', '300', '60']);
    const suspicious = literals.filter((x) => !allowed.has(x.replace('%', '')));
    assert.deepEqual(suspicious, [], `${f}: number literals ${suspicious.join(', ')}`);
  }
});

test('the limitation sentence is present exactly', () => {
  assert.equal(e.limitation, 'This measures agreement with national guidance, not clinical outcomes.');
  assert.ok(read('../evidence.html').includes('This measures agreement with national guidance, not clinical outcomes.'));
});
