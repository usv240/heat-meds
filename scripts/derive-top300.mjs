// Derives data/top300.json, the 300 most-prescribed US medicines by ingredient, from
// AHRQ MEPS HC-254A (2024 Prescribed Medicines file, public domain).
//
// Method (recorded in the output):
//   1. Read every fill record from the fixed-width ASCII file (one row = one household-reported fill).
//   2. Group fills by RXDRGNAM (MEPS's normalized drug name) and sum PERWT24F, the person weight,
//      so each fill counts for the people it represents nationally.
//   3. Resolve each drug name to RxNorm ingredients (crediting a combination product's weight to
//      each of its ingredients), then rank ingredients by total weight and keep 300.
//
// Usage: node scripts/derive-top300.mjs path/to/h254a.dat
// Column positions come from the MEPS R programming statements (h254aru.txt).

import { createReadStream, writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { resolveMedicine } from '../src/rxnorm.js';
import { normalizeName } from '../src/rxnorm.js';

const datPath = process.argv[2];
if (!datPath) { console.error('Usage: node scripts/derive-top300.mjs path/to/h254a.dat'); process.exit(2); }

// 1-based inclusive positions from h254aru.txt
const COL = { RXDRGNAM: [129, 188], RXNDC: [189, 199], PERWT24F: [570, 581] };
const field = (line, [s, e]) => line.slice(s - 1, e).trim();

console.log('Reading', datPath);
const byName = new Map();
let rows = 0;
let masked = 0;
for await (const line of createInterface({ input: createReadStream(datPath, { encoding: 'latin1' }) })) {
  if (!line.trim()) continue;
  rows++;
  const name = field(line, COL.RXDRGNAM);
  const ndc = field(line, COL.RXNDC);
  const w = Number(field(line, COL.PERWT24F));
  // MEPS masks some drug names with a therapeutic-class placeholder (for example
  // "CARDIOVASCULAR AGENTS") and sets RXNDC to -15. Keep only fills with a real NDC.
  if (!/^\d{10,11}$/.test(ndc)) { masked++; continue; }
  if (!name || name.startsWith('-') || !Number.isFinite(w) || w <= 0) continue;
  const rec = byName.get(name) ?? { name, fills: 0, weight: 0 };
  rec.fills += 1;
  rec.weight += w;
  byName.set(name, rec);
}
console.log(`${rows} fill rows, ${masked} with a masked name (no NDC) dropped, ${byName.size} distinct drug names with positive weight`);

// Resolve the top N names (more than 300, since combinations split and some names fail).
const names = [...byName.values()].sort((a, b) => b.weight - a.weight).slice(0, 700);
const cacheDir = new URL('../data/cache/', import.meta.url);
mkdirSync(cacheDir, { recursive: true });
const cachePath = new URL('meps-name-resolution.json', cacheDir);
const cache = existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, 'utf8')) : {};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// An approximate match is accepted for the test list only when the MEPS name and the RxNorm
// candidate clearly share words: at least half of the query's tokens (5+ letters) must prefix-match
// a word in the candidate's concept or ingredient names. This rejects MEPS category placeholders
// such as "CNS STIMULANTS" matching an unrelated concept.
const GENERIC = new Set(['agents', 'agent', 'inhibitors', 'inhibitor', 'products', 'product', 'blockers', 'antagonists', 'agonists', 'combinations', 'preparations', 'supplements', 'hormones', 'miscellaneous', 'other']);
function approxLooksRight(query, candidate) {
  const tokens = query.split(' ').filter((t) => t.length >= 5 && !GENERIC.has(t));
  if (!tokens.length) return false;
  const hay = (candidate.ingredients ?? []).map((i) => i.name.toLowerCase()).join(' ').split(/[^a-z0-9]+/);
  return tokens.every((t) => hay.some((w) => w.startsWith(t.slice(0, 6))));
}

const byIngredient = new Map();
const unresolved = [];
let done = 0;
for (const rec of names) {
  const key = normalizeName(rec.name);
  let r = cache[key];
  if (!r) {
    let attempt = 0;
    while (attempt < 3) {
      try {
        const res = await resolveMedicine(rec.name);
        // A did-you-mean is accepted here ONLY for deriving the test list, never in the app.
        if (res.status === 'did_you_mean') {
          r = approxLooksRight(res.query, res.candidate)
            ? { status: 'resolved_approx', name: res.candidate.name, ingredients: res.candidate.ingredients, query: res.query }
            : { status: 'rejected_approx', name: res.candidate.name, ingredients: [], query: res.query };
        } else {
          r = { status: res.status, name: res.name, ingredients: res.ingredients };
        }
        break;
      } catch (e) {
        attempt++;
        await sleep(1000 * attempt);
      }
    }
    if (!r) r = { status: 'error', ingredients: [] };
    cache[key] = r;
    writeFileSync(cachePath, JSON.stringify(cache, null, 1));
    await sleep(80);
  }
  done++;
  if (done % 50 === 0) console.log(`  resolved ${done}/${names.length}`);
  if (!r.ingredients?.length) { unresolved.push({ name: rec.name, weight: rec.weight }); continue; }
  for (const ing of r.ingredients) {
    const k = ing.rxcui;
    const cur = byIngredient.get(k) ?? { rxcui: ing.rxcui, name: ing.base_name ?? ing.name, weight: 0, fills: 0, from_names: [] };
    cur.weight += rec.weight;
    cur.fills += rec.fills;
    if (!cur.from_names.includes(rec.name)) cur.from_names.push(rec.name);
    byIngredient.set(k, cur);
  }
}

// Merge precise ingredients (PIN) into their base ingredient by name so "metoprolol succinate"
// and "metoprolol tartrate" both count toward metoprolol.
const merged = new Map();
for (const ing of byIngredient.values()) {
  const key = ing.name.toLowerCase();
  const cur = merged.get(key) ?? { name: ing.name, rxcuis: [], weight: 0, fills: 0, from_names: [] };
  cur.rxcuis.push(ing.rxcui);
  cur.weight += ing.weight;
  cur.fills += ing.fills;
  for (const n of ing.from_names) if (!cur.from_names.includes(n)) cur.from_names.push(n);
  merged.set(key, cur);
}

const ranked = [...merged.values()].sort((a, b) => b.weight - a.weight);
const top = ranked.slice(0, 300).map((ing, i) => ({ rank: i + 1, ingredient: ing.name, rxcuis: ing.rxcuis, weighted_fills: Math.round(ing.weight), fills: ing.fills, meps_names: ing.from_names.slice(0, 6) }));

const out = {
  title: 'The 300 most-prescribed US medicines, by ingredient',
  source: {
    title: 'AHRQ Medical Expenditure Panel Survey, HC-254A: 2024 Prescribed Medicines File (public domain)',
    url: 'https://meps.ahrq.gov/mepsweb/data_stats/download_data_files_detail.jsp?cboPufNumber=HC-254A',
    layout: 'https://meps.ahrq.gov/data_stats/download_data/pufs/h254a/h254aru.txt',
  },
  method: [
    'Each MEPS record is one household-reported prescription fill in 2024. Fills whose drug name MEPS masked with a therapeutic-class placeholder (RXNDC = -15) were dropped.',
    'Fills were grouped by RXDRGNAM (the MEPS normalized drug name) and weighted by PERWT24F, the full-year person weight, so each fill counts for the people it represents nationally.',
    `The ${names.length} highest-weight names were resolved to RxNorm ingredients with the same rxnorm.js module the site uses. A combination product credits its full weight to each ingredient. Precise ingredients (for example metoprolol succinate) were merged into their base ingredient.`,
    'Ingredients were ranked by total weight and the top 300 kept. Weighted fills are rounded.',
  ],
  derived_on: new Date().toISOString().slice(0, 10),
  fill_rows: rows,
  masked_rows_dropped: masked,
  distinct_names: byName.size,
  names_resolved: names.length - unresolved.length,
  names_unresolved: unresolved.slice(0, 40),
  approximate_matches_accepted: Object.entries(cache).filter(([, v]) => v.status === 'resolved_approx').map(([k, v]) => ({ meps_name: k, rxnorm: v.name })),
  approximate_matches_rejected: Object.entries(cache).filter(([, v]) => v.status === 'rejected_approx').map(([k, v]) => ({ meps_name: k, rejected_candidate: v.name })),
  sanity_check: {
    note: 'Compare the top 20 below with published top-drug rankings for comparison only; those rankings are not reproduced here.',
    top20: top.slice(0, 20).map((t) => t.ingredient),
  },
  medicines: top,
};
writeFileSync(new URL('../data/top300.json', import.meta.url), JSON.stringify(out, null, 2) + '\n');
console.log('Top 20:', out.sanity_check.top20.join(', '));
console.log(`Unresolved names: ${unresolved.length} (first: ${unresolved.slice(0, 5).map((u) => u.name).join('; ')})`);
console.log('Wrote data/top300.json');
