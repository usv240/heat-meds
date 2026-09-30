// Out-of-area ZIPs must never show saved data, and saved data must never be described as today.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { forecastFor, chooseWeek, insideForecastArea } from '../src/heatrisk.js';
import { evaluate } from '../src/rules.js';

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const saved = read('../data/saved-heatwave.json');
const rules = read('../data/cdc-rules.json');
const fixture = read('./fixtures/getsamples-phoenix.json');
const zip = (prefix, code) => read(`../data/zip/${prefix}.json`)[code];

test('Honolulu, Anchorage, San Juan, and Saipan are outside the forecast area; Phoenix and Miami are inside', () => {
  for (const [z, name] of [['96813', 'Honolulu'], ['99501', 'Anchorage'], ['00901', 'San Juan'], ['96950', 'Saipan']]) {
    const [lat, lon] = zip(z.slice(0, 3), z);
    assert.equal(insideForecastArea(lat, lon), false, name);
  }
  for (const [z, name] of [['85004', 'Phoenix'], ['33101', 'Miami'], ['98101', 'Seattle'], ['04101', 'Portland ME']]) {
    const [lat, lon] = zip(z.slice(0, 3), z);
    assert.equal(insideForecastArea(lat, lon), true, name);
  }
});

test('an out-of-area point is unavailable without calling the service, and never falls back to saved data', async () => {
  let called = 0;
  const [lat, lon] = zip('968', '96813');
  const r = await forecastFor(lat, lon, { fetchImpl: async () => { called++; return { ok: true, json: async () => fixture }; } });
  assert.equal(r.status, 'unavailable');
  assert.equal(called, 0, 'no network call for a point outside the area');
  assert.equal(chooseWeek({ result: r, saved }).mode, 'unavailable');
  assert.equal(chooseWeek({ result: r, saved }).week, null);
});

test('the service rejecting a point (HTTP 400, or an error body with code 400) is unavailable, not a failure', async () => {
  const http400 = await forecastFor(33.45, -112.07, { fetchImpl: async () => ({ ok: false, status: 400 }) });
  assert.equal(http400.status, 'unavailable');
  const body400 = await forecastFor(33.45, -112.07, { fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ error: { code: 400, message: 'Invalid or missing input parameters.' } }) }) });
  assert.equal(body400.status, 'unavailable');
  assert.equal(chooseWeek({ result: body400, saved }).mode, 'unavailable');
  const http503 = await forecastFor(33.45, -112.07, { fetchImpl: async () => ({ ok: false, status: 503 }) });
  assert.equal(http503.status, 'error');
  assert.equal(chooseWeek({ result: http503, saved }).mode, 'fallback', 'only a real service failure uses saved data');
});

const NEVER = /\b(today|tomorrow|where you live)\b/i;

test('the "never say" pattern really matches the phrases it guards against (guards this file against a vacuous check)', () => {
  assert.ok(NEVER.test('Wed is an Extreme heat risk day where you live.'));
  assert.ok(NEVER.test('Today is a Major day.'));
  assert.ok(NEVER.test('Tomorrow is hot.'));
  assert.ok(!NEVER.test('During this past heat wave, Phoenix, AZ had 2 Extreme days.'));
});
const phoenix = () => {
  const lookups = read('../data/saved-lookups.json').lookups;
  return ['lasix', 'lisinopril'].map((k) => structuredClone(lookups[k]));
};

test('replay and fallback modes both use past-heat-wave wording; live mode may say today', () => {
  const week = saved.week.map((d) => ({ ...d, validMs: Date.parse(`${d.date}T12:00:00Z`) }));
  for (const mode of ['replay', 'fallback']) {
    const chosen = chooseWeek({ result: mode === 'fallback' ? { status: 'error', error: new Error('offline') } : { status: 'ok', week }, saved, replay: mode === 'replay' });
    assert.equal(chosen.mode, mode);
    const savedMode = chosen.mode === 'replay' || chosen.mode === 'fallback';
    const plan = evaluate({ medicines: phoenix(), forecast: chosen.week, rules, today: '2026-09-30', mode: savedMode ? 'replay' : 'live', place: saved.place });
    assert.ok(!NEVER.test(plan.summary.text), `${mode}: "${plan.summary.text}"`);
    assert.match(plan.summary.text, /^During this past heat wave, Phoenix, AZ had 2 Extreme days/);
    assert.ok(plan.cards.every((c) => !NEVER.test(c.this_week)), `${mode}: this-week lines`);
  }
  const live = evaluate({ medicines: phoenix(), forecast: [{ date: '2026-09-30', level: 4, validMs: 1 }], rules, today: '2026-09-30', mode: 'live' });
  assert.match(live.summary.text, /^Today is an Extreme heat risk day where you live/);
});

test('with no boxes, the summary names what happened to the ZIP and only the no-ZIP invitation says "where you live"', () => {
  const run = (mode) => evaluate({ medicines: phoenix(), forecast: null, rules, mode }).summary.text;
  assert.equal(run('unavailable'), "The heat forecast isn't available for this ZIP, so this plan covers your medicines only.");
  assert.equal(run('zip_not_found'), "That ZIP code wasn't found, so this plan covers your medicines only.");
  assert.equal(run('unreachable'), "The heat forecast couldn't be reached right now, so this plan covers your medicines only.");
  for (const m of ['unavailable', 'zip_not_found', 'unreachable']) assert.ok(!NEVER.test(run(m)), m);
  assert.equal(run('no_zip'), "Add a ZIP code to see this week's heat where you live.");
});
