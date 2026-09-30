import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseSamples, forecastFor, planningDays, maxLevel, LEVELS, buildUrl } from '../src/heatrisk.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/getsamples-phoenix.json', import.meta.url), 'utf8'));

test('parseSamples sorts the seven day layers by valid time and parses string values', () => {
  const week = parseSamples(fixture);
  assert.equal(week.length, 7);
  for (let i = 1; i < week.length; i++) assert.ok(week[i].validMs > week[i - 1].validMs, 'sorted ascending');
  assert.equal(week[0].layer, 'HeatRisk_1_Mercator');
  assert.equal(week[6].layer, 'HeatRisk_7_Mercator');
  assert.ok(week.every((d) => Number.isInteger(d.level) && d.level >= 0 && d.level <= 4));
  assert.ok(week.every((d) => typeof d.word === 'string' && d.word.length > 0), 'every day has a word');
  assert.match(week[0].date, /^\d{4}-\d{2}-\d{2}$/);
});

test('parseSamples treats NoData (5) and junk as null level', () => {
  const week = parseSamples({ samples: [
    { value: '5.000000000', attributes: { name: 'HeatRisk_1_Mercator', idp_validtime: 1790769600000 } },
    { value: 'NoData', attributes: { name: 'HeatRisk_2_Mercator', idp_validtime: 1790856000000 } },
    { value: '2.000000000', attributes: { name: 'HeatRisk_3_Mercator', idp_validtime: 1790942400000 } },
  ] });
  assert.deepEqual(week.map((d) => d.level), [null, null, 2]);
  assert.equal(week[2].word, 'Moderate');
});

test('LEVELS carry the five official words and a color each', () => {
  assert.deepEqual(LEVELS.map((l) => l.word), ['Little to none', 'Minor', 'Moderate', 'Major', 'Extreme']);
  assert.ok(LEVELS.every((l) => /^#[0-9a-f]{6}$/.test(l.color)));
});

test('planningDays uses the CDC threshold (orange and above) and maxLevel reports the peak', () => {
  const week = [0, 1, 2, 3, 4, 1, 0].map((level, i) => ({ date: `2025-08-0${i + 3}`, level, validMs: i }));
  assert.deepEqual(planningDays(week).map((d) => d.level), [2, 3, 4]);
  assert.equal(maxLevel(week), 4);
  assert.equal(maxLevel([]), -1);
});

test('forecastFor returns ok with a week from a stubbed fetch', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => fixture });
  const r = await forecastFor(33.448, -112.074, { fetchImpl });
  assert.equal(r.status, 'ok');
  assert.equal(r.week.length, 7);
});

test('forecastFor returns unavailable when every sample is NoData, and error on network failure', async () => {
  const nodata = { samples: [{ value: '5.0', attributes: { name: 'HeatRisk_1_Mercator', idp_validtime: 1790769600000 } }] };
  const r1 = await forecastFor(0, 0, { fetchImpl: async () => ({ ok: true, json: async () => nodata }) });
  assert.equal(r1.status, 'unavailable');
  const r2 = await forecastFor(0, 0, { fetchImpl: async () => { throw new Error('offline'); } });
  assert.equal(r2.status, 'error');
  const r3 = await forecastFor(0, 0, { fetchImpl: async () => ({ ok: false, status: 503 }) });
  assert.equal(r3.status, 'error');
});

test('buildUrl targets the ImageServer with a WGS84 point', () => {
  const url = new URL(buildUrl(33.448, -112.074));
  assert.equal(url.hostname, 'mapservices.weather.noaa.gov');
  assert.equal(url.searchParams.get('geometryType'), 'esriGeometryPoint');
  assert.deepEqual(JSON.parse(url.searchParams.get('geometry')), { x: -112.074, y: 33.448, spatialReference: { wkid: 4326 } });
});

// Slice 4: the saved heat wave and the fallback decision.
import { chooseWeek, savedWeek } from '../src/heatrisk.js';
const saved = JSON.parse(readFileSync(new URL('../data/saved-heatwave.json', import.meta.url), 'utf8'));

test('the saved heat wave is the Phoenix Aug 3-9 2025 week with source URLs', () => {
  assert.equal(saved.week.length, 7);
  assert.deepEqual(saved.week.map((d) => d.level), [2, 2, 2, 4, 4, 3, 2]);
  assert.ok(saved.week.every((d) => d.source_url.includes('HeatRisk_CONUS_2025080')));
  assert.match(saved.label, /Phoenix, Aug 3 to Aug 9, 2025/);
  assert.equal(saved.kind, 'saved data');
});

test('chooseWeek: live when ok, replay when asked, saved fallback on error, none without a ZIP', async () => {
  const live = await forecastFor(33.45, -112.07, { fetchImpl: async () => ({ ok: true, json: async () => fixture }) });
  assert.equal(chooseWeek({ result: live, saved }).mode, 'live');
  assert.equal(chooseWeek({ result: live, saved, replay: true }).mode, 'replay');
  const failed = await forecastFor(33.45, -112.07, { fetchImpl: async () => { throw new Error('offline'); } });
  const fb = chooseWeek({ result: failed, saved });
  assert.equal(fb.mode, 'fallback');
  assert.match(fb.label, /^Saved data: /);
  assert.deepEqual(fb.week.map((d) => d.level), [2, 2, 2, 4, 4, 3, 2]);
  assert.equal(chooseWeek({ result: null, saved }).mode, 'none');
  const nodata = await forecastFor(0, 0, { fetchImpl: async () => ({ ok: true, json: async () => ({ samples: [{ value: '5', attributes: { name: 'HeatRisk_1_Mercator', idp_validtime: 1790769600000 } }] }) }) });
  assert.equal(chooseWeek({ result: nodata, saved }).mode, 'unavailable', 'out of area is reported, not replaced by saved data');
  assert.equal(savedWeek(saved)[0].date, '2025-08-03');
});
