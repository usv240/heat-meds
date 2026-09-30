import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeName, resolveMedicine, acceptCandidate, clearSessionCache } from '../src/rxnorm.js';
import { filterAtcRows } from '../src/rxclass.js';

const furoRows = JSON.parse(readFileSync(new URL('./fixtures/rxclass-furosemide.json', import.meta.url), 'utf8'));
const approxToprol = JSON.parse(readFileSync(new URL('./fixtures/approx-toprol-xl.json', import.meta.url), 'utf8'));

test('normalizeName strips dose and form words and keeps brand suffixes without a dose', () => {
  assert.equal(normalizeName('Lasix 40 mg'), 'lasix');
  assert.equal(normalizeName('lasix 40mg tablet'), 'lasix');
  assert.equal(normalizeName('Toprol-XL'), 'toprol xl');
  assert.equal(normalizeName('metoprolol succinate ER 50mg'), 'metoprolol succinate');
  assert.equal(normalizeName('lisinopril-hydrochlorothiazide'), 'lisinopril hydrochlorothiazide');
  assert.equal(normalizeName('  Zoloft (sertraline) 50 mg, take 1 by mouth daily '), 'zoloft sertraline');
  assert.equal(normalizeName(''), '');
});

test('filterAtcRows keeps only rows whose class member is the ingredient itself', () => {
  assert.deepEqual(filterAtcRows(furoRows, '4603'), ['C03CA']);
  const all = furoRows.rxclassDrugInfoList.rxclassDrugInfo.map((r) => r.rxclassMinConceptItem.classId);
  assert.ok(all.includes('C03CB'), 'fixture really contains the combination-class leak');
});

test('filterAtcRows accepts the base ingredient as member for a precise ingredient (PIN)', () => {
  const pinRows = { rxclassDrugInfoList: { rxclassDrugInfo: [
    { minConcept: { rxcui: '6918', name: 'metoprolol', tty: 'IN' }, rxclassMinConceptItem: { classId: 'C07AB', classType: 'ATC1-4' } },
  ] } };
  assert.deepEqual(filterAtcRows(pinRows, ['221124', '6918']), ['C07AB']);
  assert.deepEqual(filterAtcRows(pinRows, '221124'), []);
});

// A tiny fake RxNav: routes by URL so the whole resolve flow can run offline.
function fakeRxnav(routes) {
  return async (url) => {
    for (const [pattern, body] of routes) {
      if (url.includes(pattern)) return { ok: true, json: async () => body };
    }
    return { ok: true, json: async () => ({}) };
  };
}

test('resolveMedicine: exact hit on a brand resolves to its ingredient', async () => {
  clearSessionCache();
  const fetchImpl = fakeRxnav([
    ['rxcui.json?name=lasix', { idGroup: { rxnormId: ['202991'] } }],
    ['rxcui/202991/properties', { properties: { rxcui: '202991', name: 'Lasix', tty: 'BN' } }],
    ['rxcui/202991/related.json?tty=IN', { relatedGroup: { conceptGroup: [{ tty: 'IN', conceptProperties: [{ rxcui: '4603', name: 'furosemide', tty: 'IN' }] }] } }],
  ]);
  const r = await resolveMedicine('Lasix 40 mg', { fetchImpl });
  assert.equal(r.status, 'resolved');
  assert.equal(r.query, 'lasix');
  assert.deepEqual(r.ingredients.map((i) => i.name), ['furosemide']);
});

test('resolveMedicine: no exact hit becomes a did-you-mean, never resolved silently; accept turns it into resolved', async () => {
  clearSessionCache();
  const fetchImpl = fakeRxnav([
    ['rxcui.json?name=toprol', { idGroup: {} }],
    ['approximateTerm.json', approxToprol],
    ['rxcui/220348/properties', {}],
    ['rxcui/865575/properties', { properties: { rxcui: '865575', name: 'Toprol', tty: 'BN' } }],
    ['rxcui/865575/related.json?tty=IN', { relatedGroup: { conceptGroup: [{ tty: 'IN', conceptProperties: [{ rxcui: '6918', name: 'metoprolol', tty: 'IN' }] }] } }],
  ]);
  const r = await resolveMedicine('Toprol XL', { fetchImpl });
  assert.equal(r.status, 'did_you_mean');
  assert.equal(r.ingredients.length, 0, 'nothing resolved yet');
  assert.equal(r.candidate.label, 'metoprolol (Toprol)');
  const accepted = acceptCandidate(r);
  assert.equal(accepted.status, 'resolved');
  assert.deepEqual(accepted.ingredients.map((i) => i.name), ['metoprolol']);
  assert.equal(accepted.accepted_from_candidate, true);
});

test('resolveMedicine: a PIN records its base ingredient rxcui and name', async () => {
  clearSessionCache();
  const fetchImpl = fakeRxnav([
    ['rxcui.json?name=metoprolol%20succinate', { idGroup: { rxnormId: ['221124'] } }],
    ['rxcui/221124/properties', { properties: { rxcui: '221124', name: 'metoprolol succinate', tty: 'PIN' } }],
    ['rxcui/221124/related.json?tty=IN', { relatedGroup: { conceptGroup: [{ tty: 'IN', conceptProperties: [{ rxcui: '6918', name: 'metoprolol', tty: 'IN' }] }] } }],
  ]);
  const r = await resolveMedicine('metoprolol succinate ER 50mg', { fetchImpl });
  assert.equal(r.status, 'resolved');
  assert.equal(r.ingredients[0].base_name, 'metoprolol');
  assert.equal(r.ingredients[0].base_rxcui, '6918');
});

test('resolveMedicine: nothing anywhere is not recognized; spelling suggestions when RxNorm offers them', async () => {
  clearSessionCache();
  const none = fakeRxnav([['rxcui.json', { idGroup: {} }], ['approximateTerm', { approximateGroup: {} }], ['spellingsuggestions', { suggestionGroup: { suggestionList: {} } }]]);
  assert.equal((await resolveMedicine('xyzabc', { fetchImpl: none })).status, 'not_recognized');
  const sugg = fakeRxnav([['rxcui.json', { idGroup: {} }], ['approximateTerm', { approximateGroup: {} }], ['spellingsuggestions', { suggestionGroup: { suggestionList: { suggestion: ['furosemide'] } } }]]);
  const r = await resolveMedicine('furosemid', { fetchImpl: sugg });
  assert.equal(r.status, 'suggestions');
  assert.deepEqual(r.suggestions, ['furosemide']);
});

test('resolveMedicine: network failure falls back to saved lookups, marked as saved', async () => {
  clearSessionCache();
  const savedLookups = JSON.parse(readFileSync(new URL('../data/saved-lookups.json', import.meta.url), 'utf8'));
  const offline = async () => { throw new Error('offline'); };
  const r = await resolveMedicine('Lasix', { fetchImpl: offline, savedLookups });
  assert.equal(r.status, 'resolved');
  assert.equal(r.saved, true);
  assert.deepEqual(r.ingredients.map((i) => i.name), ['furosemide']);
  const miss = await resolveMedicine('nowhere', { fetchImpl: offline, savedLookups });
  assert.equal(miss.status, 'error');
});
