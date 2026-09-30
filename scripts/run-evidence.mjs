// The 300-medicine proof. Runs every ingredient in data/top300.json through the same modules the
// site uses (rxnorm.js, rxclass.js, rules.js), compares the result with the UKHSA and Health
// Canada answer keys, scans every rendered plan line for stop instructions, and writes
// data/evidence.json (read by evidence.html) and data/saved-lookups.json (the site's fallback).
//
// Nothing on the Evidence page is typed by hand: change a rule, rerun, the page changes.
// Usage: node scripts/run-evidence.mjs

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolveMedicine } from '../src/rxnorm.js';
import { classifyMedicine } from '../src/rxclass.js';
import { evaluate, loadRules, planToText, stopInstructionMatches } from '../src/rules.js';
import { makeMatcher } from '../src/answer-keys.js';

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const rules = loadRules(read('../data/cdc-rules.json'));
const top = read('../data/top300.json');
const ukhsa = makeMatcher(read('../data/answer-keys/ukhsa.json'));
const canada = makeMatcher(read('../data/answer-keys/health-canada.json'));
const savedWeek = read('../data/saved-heatwave.json');
const existingSaved = read('../data/saved-lookups.json');

// Refuse to run while any enabled rule is still a draft: the Evidence page must describe verified rules.
const drafts = [...rules.classes, ...(rules.combinations ?? []), ...(rules.storage ?? []), ...(rules.sun_notes ?? [])]
  .filter((e) => e.enabled !== false && e.quote_status !== 'verified').map((e) => e.id);
if (drafts.length) { console.error('Refusing to run: enabled rules still marked draft:', drafts.join(', ')); process.exit(2); }

const cacheDir = new URL('../data/cache/', import.meta.url);
mkdirSync(cacheDir, { recursive: true });
const cachePath = new URL('evidence-lookups.json', cacheDir);
const cache = existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, 'utf8')) : {};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Resolve + classify one ingredient name with a disk cache and one retry. Concurrency-limited below.
async function lookup(name) {
  const key = name.toLowerCase();
  if (cache[key]) return cache[key];
  let result = null;
  for (let attempt = 0; attempt < 2 && !result; attempt++) {
    try {
      const r = await resolveMedicine(name);
      if (r.status === 'resolved') await classifyMedicine(r);
      result = r;
    } catch (e) {
      await sleep(1500 * (attempt + 1));
    }
  }
  cache[key] = result ?? { input: name, status: 'error', ingredients: [] };
  return cache[key];
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: limit }, async () => {
    while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx], idx); await sleep(60); }
  }));
  return out;
}

console.log(`Resolving ${top.medicines.length} ingredients (4 concurrent, cached)...`);
const results = await mapLimit(top.medicines, 4, async (m, idx) => {
  const r = await lookup(m.ingredient);
  if ((idx + 1) % 50 === 0) { console.log(`  ${idx + 1}/${top.medicines.length}`); writeFileSync(cachePath, JSON.stringify(cache, null, 1)); }
  return r;
});
writeFileSync(cachePath, JSON.stringify(cache, null, 1));

// Evaluate each medicine alone, against the saved heat-wave week, and render its plan to text.
const week = savedWeek.week.map((d) => ({ ...d, validMs: Date.parse(`${d.date}T12:00:00Z`) }));
const rows = [];
let flagsWithoutQuote = 0;
let stopInstructions = 0;
const stopExamples = [];
let unresolved = 0;

for (let i = 0; i < top.medicines.length; i++) {
  const m = top.medicines[i];
  const r = results[i];
  if (r.status !== 'resolved' || !r.ingredients.length) {
    unresolved++;
    rows.push({ rank: m.rank, ingredient: m.ingredient, status: r.status, app_flags: null, cdc_classes: [], ukhsa: null, health_canada: null, atc: [] });
    continue;
  }
  const plan = evaluate({ medicines: [r], forecast: week, rules, answerKeys: { ukhsa, health_canada: canada }, mode: 'replay', place: 'Phoenix, AZ' });
  const lines = planToText(plan);
  const stops = stopInstructionMatches(lines);
  if (stops.length) { stopInstructions++; stopExamples.push({ ingredient: m.ingredient, lines: stops }); }
  for (const c of plan.cards) if (!c.source?.quote) flagsWithoutQuote++;
  const ing = r.ingredients[0];
  const atc = [...new Set(r.ingredients.flatMap((x) => x.atc ?? []))];
  const ingredientForKeys = { name: ing.name, base_name: ing.base_name, atc };
  const flagged = plan.cards.length > 0;
  rows.push({
    rank: m.rank,
    ingredient: m.ingredient,
    status: 'resolved',
    atc,
    app_flags: flagged,
    cdc_classes: plan.cards.map((c) => ({ id: c.class_id, label: c.cdc_label, quote: c.source.quote })),
    storage_only: !flagged && plan.storage.length > 0,
    sun_only: !flagged && (plan.sun_notes ?? []).length > 0,
    ukhsa: ukhsa.matches(ingredientForKeys),
    ukhsa_phrases: ukhsa.phrasesFor(ingredientForKeys).map((p) => p.phrase),
    health_canada: canada.matches(ingredientForKeys),
    health_canada_phrases: canada.phrasesFor(ingredientForKeys).map((p) => p.phrase),
  });
}

const scored = rows.filter((r) => r.status === 'resolved');
function agreement(keyName) {
  const agree = scored.filter((r) => r.app_flags === r[keyName]).length;
  const appOnly = scored.filter((r) => r.app_flags && !r[keyName]);
  const keyOnly = scored.filter((r) => !r.app_flags && r[keyName]);
  return { agree, total: scored.length, rate: scored.length ? agree / scored.length : null, app_only: appOnly.length, key_only: keyOnly.length };
}
const ukhsaAgreement = agreement('ukhsa');
const canadaAgreement = agreement('health_canada');

// Flags among medicines neither UKHSA nor Health Canada lists, each with its CDC quote. Reported, not zero-targeted.
const outsideBoth = scored.filter((r) => r.app_flags && !r.ukhsa && !r.health_canada).map((r) => ({ ingredient: r.ingredient, rank: r.rank, cdc: r.cdc_classes }));

// Disagreement table in both directions, with the mapping reason attached.
function reasonFor(r, keyName, matcher) {
  if (r.app_flags && !r[keyName]) return `The CDC lists ${r.cdc_classes.map((c) => c.label).join('; ')}. ${matcher.title.split(',')[0]} does not name this class.`;
  const phrases = r[`${keyName}_phrases`] ?? [];
  return `${matcher.title.split(',')[0]} lists it under "${phrases[0] ?? '(phrase)'}". The CDC table does not include this class.`;
}
const disagreements = [];
for (const r of scored) {
  for (const [keyName, matcher] of [['ukhsa', ukhsa], ['health_canada', canada]]) {
    if (r.app_flags === r[keyName]) continue;
    disagreements.push({ ingredient: r.ingredient, rank: r.rank, key: keyName, direction: r.app_flags ? 'app flags, guidance does not' : 'guidance lists, app does not', reason: reasonFor(r, keyName, matcher), atc: r.atc });
  }
}

let commit = null;
try { commit = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim(); } catch { /* not in git */ }

const evidence = {
  title: 'How Heat Meds performs on the 300 most-prescribed US medicines',
  run_on: new Date().toISOString(),
  commit,
  rules_version: rules.version,
  test_set: { title: top.title, source: top.source, count: top.medicines.length, derived_on: top.derived_on, method: top.method },
  answer_keys: {
    ukhsa: { title: ukhsa.title, url: ukhsa.url, phrases: read('../data/answer-keys/ukhsa.json').phrases },
    health_canada: { title: canada.title, url: canada.url, phrases: read('../data/answer-keys/health-canada.json').phrases },
    ansm: read('../data/answer-keys/ansm.json'),
  },
  must_be_zero: {
    flags_without_cdc_quote: flagsWithoutQuote,
    stop_instructions: stopInstructions,
    stop_examples: stopExamples,
  },
  flags_outside_uk_and_canada: { count: outsideBoth.length, medicines: outsideBoth },
  agreement: { ukhsa: ukhsaAgreement, health_canada: canadaAgreement },
  counts: {
    resolved: scored.length,
    unresolved,
    app_flagged: scored.filter((r) => r.app_flags).length,
    ukhsa_listed: scored.filter((r) => r.ukhsa).length,
    health_canada_listed: scored.filter((r) => r.health_canada).length,
    resolved_without_atc: scored.filter((r) => !r.atc.length).length,
    resolved_without_atc_names: scored.filter((r) => !r.atc.length).map((r) => r.ingredient),
  },
  disagreements,
  rows,
  limitation: 'This measures agreement with national guidance, not clinical outcomes.',
};
writeFileSync(new URL('../data/evidence.json', import.meta.url), JSON.stringify(evidence, null, 2) + '\n');

// Refresh the site's saved lookups: keep the example entries, add every resolved top-300 ingredient.
const lookups = { ...existingSaved.lookups };
for (let i = 0; i < top.medicines.length; i++) {
  const r = results[i];
  if (r.status !== 'resolved') continue;
  const { candidate, suggestions, ...rest } = r;
  lookups[(r.query ?? top.medicines[i].ingredient).toLowerCase()] = { ...rest, status: 'resolved' };
}
writeFileSync(new URL('../data/saved-lookups.json', import.meta.url), JSON.stringify({ ...existingSaved, saved_on: new Date().toISOString().slice(0, 10), lookups }, null, 2) + '\n');

console.log(`\nflags_without_cdc_quote=${flagsWithoutQuote} stop_instructions=${stopInstructions}`);
console.log(`resolved=${scored.length} unresolved=${unresolved} app_flagged=${evidence.counts.app_flagged}`);
console.log(`agreement UKHSA ${ukhsaAgreement.agree}/${ukhsaAgreement.total} (${(ukhsaAgreement.rate * 100).toFixed(1)}%), Health Canada ${canadaAgreement.agree}/${canadaAgreement.total} (${(canadaAgreement.rate * 100).toFixed(1)}%)`);
console.log(`flags outside UK and Canada: ${outsideBoth.length}; disagreements: ${disagreements.length}`);
console.log('Wrote data/evidence.json and data/saved-lookups.json');
if (flagsWithoutQuote || stopInstructions) process.exit(1);
