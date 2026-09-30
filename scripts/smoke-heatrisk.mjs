// Build step one: a live smoke check of the experimental HeatRisk service at a point.
// Usage: node scripts/smoke-heatrisk.mjs [lat] [lon]   (defaults to downtown Phoenix)

import { forecastFor, buildUrl } from '../src/heatrisk.js';

const lat = Number(process.argv[2] ?? 33.448);
const lon = Number(process.argv[3] ?? -112.074);

console.log('GET', buildUrl(lat, lon));
const r = await forecastFor(lat, lon);
if (r.status !== 'ok') {
  console.error('Status:', r.status, r.error?.message ?? '');
  process.exit(1);
}
for (const d of r.week) console.log(d.date, d.level, d.word, d.layer);
console.log(`OK: ${r.week.length} days`);
