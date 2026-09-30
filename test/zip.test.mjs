import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { lookupZip, isZip } from '../src/zip.js';

const load = async (prefix) => {
  const p = new URL(`../data/zip/${prefix}.json`, import.meta.url);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, 'utf8'));
};

test('isZip accepts five digits only', () => {
  assert.equal(isZip('85001'), true);
  assert.equal(isZip(' 85001 '), true);
  assert.equal(isZip('8500'), false);
  assert.equal(isZip('85001-1234'), false);
  assert.equal(isZip('abcde'), false);
});

test('lookupZip finds downtown Phoenix 85004 in the bundled gazetteer slice', async () => {
  const r = await lookupZip('85004', { load });
  assert.ok(r, 'expected a row for 85004');
  assert.equal(r.zip, '85004');
  assert.ok(r.lat > 33 && r.lat < 34.5, `lat ${r.lat}`);
  assert.ok(r.lon > -113 && r.lon < -111, `lon ${r.lon}`);
});

test('lookupZip returns null for malformed, unknown, and PO-box-only ZIPs', async () => {
  assert.equal(await lookupZip('abc', { load }), null);
  assert.equal(await lookupZip('85001', { load }), null, '85001 is a PO-box ZIP with no ZCTA');
  assert.equal(await lookupZip('00000', { load }), null);
  assert.equal(await lookupZip('99999', { load }), null);
});
