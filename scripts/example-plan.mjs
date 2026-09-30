// Prints the example plan as text, using the live HeatRisk forecast for the example ZIP.
// A command-line check that the whole path works: saved lookups -> ZIP -> forecast -> rules.
// Usage: node scripts/example-plan.mjs

import { readFileSync } from 'node:fs';
import { lookupZip } from '../src/zip.js';
import { forecastFor } from '../src/heatrisk.js';
import { evaluate, planToText, stopInstructionMatches } from '../src/rules.js';

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const saved = read('../data/saved-lookups.json');
const rules = read('../data/cdc-rules.json');
const load = (prefix) => { try { return read(`../data/zip/${prefix}.json`); } catch { return null; } };

const medicines = saved.example.medicines.map((k) => saved.lookups[k]);
const loc = await lookupZip(saved.example.zip, { load });
if (!loc) throw new Error(`example ZIP ${saved.example.zip} not in gazetteer`);
const fc = await forecastFor(loc.lat, loc.lon);
const week = fc.status === 'ok' ? fc.week : null;
console.log(`ZIP ${saved.example.zip} -> ${loc.lat},${loc.lon}; forecast: ${fc.status}`);

const plan = evaluate({ medicines, forecast: week, rules, today: new Date().toISOString().slice(0, 10) });
const lines = planToText(plan);
for (const l of lines) console.log('  ' + l);
const bad = stopInstructionMatches(lines);
console.log(`\ncards=${plan.cards.length} combinations=${plan.combinations.length} storage=${plan.storage.length} not_listed=${plan.not_listed.length} stop_instructions=${bad.length}`);
if (bad.length) { console.error('STOP INSTRUCTIONS FOUND:', bad); process.exit(1); }
