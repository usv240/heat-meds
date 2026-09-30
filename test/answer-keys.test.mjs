import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateKey, makeMatcher } from '../src/answer-keys.js';

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const ukhsa = read('../data/answer-keys/ukhsa.json');
const canada = read('../data/answer-keys/health-canada.json');
const ansm = read('../data/answer-keys/ansm.json');

test('every scored answer-key phrase has text, a mapping, and a one-line reason', () => {
  assert.ok(validateKey(ukhsa));
  assert.ok(validateKey(canada));
  assert.ok(ukhsa.phrases.length >= 8);
  assert.ok(canada.phrases.length >= 10);
  for (const k of [ukhsa, canada]) {
    assert.equal(k.scored, true);
    for (const p of k.phrases) assert.ok(p.reason.length > 10, `${k.key}: reason too short for "${p.phrase}"`);
  }
});

test('ANSM is context only and never scored', () => {
  assert.equal(ansm.scored, false);
  assert.equal(ansm.phrases.length, 0);
  assert.ok(ansm.why_not_scored.length > 20);
});

test('matchers classify a few known ingredients as the guidance reads', () => {
  const uk = makeMatcher(ukhsa);
  const ca = makeMatcher(canada);
  const furosemide = { name: 'furosemide', atc: ['C03CA'] };
  const losartan = { name: 'losartan', atc: ['C09CA'] };
  const atorvastatin = { name: 'atorvastatin', atc: ['C10AA'] };
  const sertraline = { name: 'sertraline', atc: ['N06AB'] };
  const gabapentin = { name: 'gabapentin', atc: ['N03AX'] };
  const levothyroxine = { name: 'levothyroxine', atc: ['H03AA'] };
  const memantine = { name: 'memantine', atc: ['N06DX'] };
  assert.equal(uk.matches(furosemide), true);
  assert.equal(ca.matches(furosemide), true);
  assert.equal(uk.matches(losartan), true, 'UKHSA counts antihypertensives');
  assert.equal(ca.matches(losartan), false, 'Health Canada names ACE inhibitors but not ARBs');
  assert.equal(uk.matches(atorvastatin), false);
  assert.equal(ca.matches(atorvastatin), false);
  assert.equal(uk.matches(sertraline), true);
  assert.equal(ca.matches(sertraline), true);
  assert.equal(uk.matches(gabapentin), true);
  assert.equal(ca.matches(gabapentin), true);
  assert.equal(uk.matches(levothyroxine), true);
  assert.equal(ca.matches(levothyroxine), false);
  assert.equal(ca.matches(memantine), false, 'narrower reading: not a cholinesterase inhibitor');
  assert.match(uk.phrasesFor(losartan)[0].phrase, /antihypertensives/);
});
