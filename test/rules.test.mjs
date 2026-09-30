import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { evaluate, loadRules, planToText, stopInstructionMatches, uniqueIngredients } from '../src/rules.js';

const rules = JSON.parse(readFileSync(new URL('../data/cdc-rules.json', import.meta.url), 'utf8'));
const saved = JSON.parse(readFileSync(new URL('../data/saved-lookups.json', import.meta.url), 'utf8'));
const L = (key) => structuredClone(saved.lookups[key]);

const greenWeek = [0, 1, 1, 0, 1, 1, 0].map((level, i) => ({ date: `2025-10-0${i + 1}`, level, word: 'x', validMs: i }));
const redWeek = [2, 2, 2, 4, 4, 3, 2].map((level, i) => ({ date: `2025-08-0${i + 3}`, level, word: 'x', validMs: i }));
const phoenix = () => [L('lasix'), L('lisinopril'), L('zoloft'), L('lantus'), L('atorvastatin')];

test('loadRules accepts the shipped rules file', () => {
  assert.ok(loadRules(rules));
  assert.ok(rules.classes.length >= 20);
});

test('loadRules throws on an enabled entry without a CDC quote', () => {
  const broken = structuredClone(rules);
  broken.classes[0].cdc_quote = '';
  assert.throws(() => loadRules(broken), /no cdc_quote/);
  const disabledOk = structuredClone(rules);
  disabledOk.classes[0].cdc_quote = '';
  disabledOk.classes[0].enabled = false;
  assert.ok(loadRules(disabledOk), 'disabled entries are not required to carry a quote');
});

test('Phoenix example: furosemide card, one combination warning, insulin storage, atorvastatin not listed', () => {
  const plan = evaluate({ medicines: phoenix(), forecast: redWeek, rules, today: '2025-08-03' });
  const names = plan.cards.map((c) => c.ingredient).sort();
  assert.deepEqual(names, ['furosemide', 'lisinopril', 'sertraline']);
  const furo = plan.cards.find((c) => c.ingredient === 'furosemide');
  assert.equal(furo.class_id, 'diuretics');
  assert.deepEqual(furo.as_typed, ['Lasix']);
  assert.match(furo.why, /thirst/);
  assert.match(furo.ask, /water/);
  assert.ok(furo.source.quote.length > 10 && furo.source.url.startsWith('https://www.cdc.gov/'));
  assert.equal(plan.combinations.length, 1);
  assert.equal(plan.combinations[0].id, 'diuretic_plus_raas');
  assert.deepEqual(plan.storage.map((s) => s.id), ['insulin']);
  assert.deepEqual(plan.not_listed.map((n) => n.ingredient), ['atorvastatin']);
  assert.ok(plan.never_stop.text.startsWith('Never stop or change a medicine on your own.'));
  assert.equal(plan.summary.level_max, 4);
  assert.match(plan.summary.text, /Extreme heat risk day where you live\. Go over this plan today\./);
  assert.match(furo.this_week, /Matters most on/);
  assert.equal(furo.this_week_days.length, 7);
});

test('a single combination pill (lisinopril + HCTZ) triggers the combination warning on its own', () => {
  const plan = evaluate({ medicines: [L('lisinopril-hydrochlorothiazide')], forecast: greenWeek, rules });
  assert.deepEqual(plan.cards.map((c) => c.ingredient).sort(), ['hydrochlorothiazide', 'lisinopril']);
  assert.equal(plan.combinations.length, 1);
});

test('HCTZ + furosemide + lisinopril-HCTZ still yields one combination warning and no duplicate cards', () => {
  const hctz = { input: 'hydrochlorothiazide', status: 'resolved', ingredients: [{ rxcui: '5487', name: 'hydrochlorothiazide', atc: ['C03AA'] }] };
  const plan = evaluate({ medicines: [hctz, L('furosemide'), L('lisinopril-hydrochlorothiazide')], forecast: greenWeek, rules });
  assert.equal(plan.combinations.length, 1);
  const names = plan.cards.map((c) => c.ingredient);
  assert.equal(new Set(names).size, names.length, 'no duplicate cards');
  const h = plan.cards.find((c) => c.ingredient === 'hydrochlorothiazide');
  assert.deepEqual(h.as_typed.sort(), ['hydrochlorothiazide', 'lisinopril-hydrochlorothiazide'].sort());
});

test('card text is identical in a green week and a red week; only the this-week line and summary change', () => {
  const a = evaluate({ medicines: phoenix(), forecast: greenWeek, rules });
  const b = evaluate({ medicines: phoenix(), forecast: redWeek, rules });
  const strip = (c) => ({ ingredient: c.ingredient, class: c.class, why: c.why, watch_for: c.watch_for, ask: c.ask });
  assert.deepEqual(a.cards.map(strip), b.cards.map(strip));
  assert.notEqual(a.cards[0].this_week, b.cards[0].this_week);
  assert.match(a.cards[0].this_week, /No orange, red, or magenta days/);
  assert.notEqual(a.summary.text, b.summary.text);
  assert.match(a.summary.text, /calm week/i);
});

test('no forecast: week is null, no this-week line, summary asks for a ZIP', () => {
  const plan = evaluate({ medicines: phoenix(), forecast: null, rules });
  assert.equal(plan.week, null);
  assert.equal(plan.cards[0].this_week, null);
  assert.deepEqual(plan.cards[0].this_week_days, []);
  assert.match(plan.summary.text, /Add a ZIP code/);
  assert.equal(plan.cards.length, 3, 'cards still appear without a forecast');
});

test('lithium gets the lithium card, not the antipsychotic card', () => {
  const li = { input: 'lithium', status: 'resolved', ingredients: [{ rxcui: '6448', name: 'lithium', atc: ['N05AN'] }] };
  const plan = evaluate({ medicines: [li], forecast: null, rules });
  assert.equal(plan.cards.length, 1);
  assert.equal(plan.cards[0].class_id, 'lithium');
  assert.equal(plan.cards[0].also_listed_under.length, 0);
});

test('aspirin gets one card (its own), not the antiplatelet or NSAID card', () => {
  const asa = { input: 'aspirin', status: 'resolved', ingredients: [{ rxcui: '1191', name: 'aspirin', atc: ['B01AC', 'N02BA'] }] };
  const plan = evaluate({ medicines: [asa], forecast: null, rules });
  assert.equal(plan.cards.length, 1);
  assert.equal(plan.cards[0].class_id, 'aspirin');
  assert.equal(plan.cards[0].also_listed_under.length, 0);
});

test('laxatives, enabled after the curation pass, get a card', () => {
  const senna = { input: 'senna', status: 'resolved', ingredients: [{ rxcui: '9620', name: 'senna', atc: ['A06AB'] }] };
  const plan = evaluate({ medicines: [senna], forecast: null, rules });
  assert.equal(plan.cards.length, 1);
  assert.equal(plan.cards[0].class_id, 'laxatives');
});

test('a sun-sensitizing antibiotic gets the sun note, not a heat card, and is not "not listed"', () => {
  const doxy = { input: 'doxycycline', status: 'resolved', ingredients: [{ rxcui: '3640', name: 'doxycycline', atc: ['J01AA', 'A01AB'] }] };
  const plan = evaluate({ medicines: [doxy], forecast: null, rules });
  assert.equal(plan.cards.length, 0);
  assert.equal(plan.sun_notes.length, 1);
  assert.deepEqual(plan.sun_notes[0].ingredients, ['doxycycline']);
  assert.equal(plan.not_listed.length, 0);
});

test('every enabled class entry is verified against the CDC page, and MDMA/alcohol are recorded as excluded', () => {
  for (const c of rules.classes) if (c.enabled !== false) assert.equal(c.quote_status, 'verified', c.id);
  assert.ok(rules.excluded_rows.rows.some((r) => /MDMA/.test(r)));
  assert.ok(rules.excluded_rows.rows.includes('Alcohol'));
});

test('warning signs carry the 911 action and the NWS source', () => {
  const plan = evaluate({ medicines: [], forecast: null, rules });
  assert.match(plan.warning_signs.action, /Call 911/);
  assert.match(plan.warning_signs.source_url, /weather\.gov\/safety\/heat-illness/);
  assert.ok(plan.warning_signs.signs.length >= 6);
});

test('not-recognized chips are listed, never guessed', () => {
  const bad = { input: 'xyzabc', status: 'not_recognized', ingredients: [] };
  const plan = evaluate({ medicines: [bad, L('atorvastatin')], forecast: null, rules });
  assert.deepEqual(plan.unrecognized, ['xyzabc']);
  assert.equal(plan.cards.length, 0);
});

test('the rendered example contains no instruction to stop, skip, or change a dose', () => {
  const plan = evaluate({ medicines: phoenix(), forecast: redWeek, rules, today: '2025-08-03' });
  const lines = planToText(plan);
  assert.ok(lines.length > 10);
  assert.deepEqual(stopInstructionMatches(lines), []);
});

test('every enabled rule text is free of stop instructions, and the scanner catches a real one', () => {
  const lines = [];
  for (const c of rules.classes) if (c.enabled !== false) lines.push(c.why, c.watch_for, c.ask_pharmacist);
  for (const c of rules.combinations) lines.push(c.text, c.ask_pharmacist ?? '');
  for (const s of rules.storage) lines.push(s.text);
  lines.push(rules.storage_general.text, rules.never_stop.text);
  assert.deepEqual(stopInstructionMatches(lines), []);
  assert.deepEqual(stopInstructionMatches(['You should stop taking your water pill on hot days.']).length, 1);
  assert.deepEqual(stopInstructionMatches(['Take less of your dose when it is hot.']).length, 1);
  assert.deepEqual(stopInstructionMatches(['Never stop or change a medicine on your own.']), []);
});

test('uniqueIngredients merges the same ingredient from two chips', () => {
  const u = uniqueIngredients([L('furosemide'), L('lasix')]);
  assert.equal(u.length, 1);
  assert.deepEqual(u[0].as_typed, ['furosemide', 'Lasix']);
});
