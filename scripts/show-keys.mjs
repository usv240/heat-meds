// Prints the answer-key mapping tables and the top 20 of the MEPS list, for the learner's review.
import { readFileSync, existsSync } from 'node:fs';

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
for (const f of ['ukhsa', 'health-canada']) {
  const k = read(`../data/answer-keys/${f}.json`);
  console.log(`\n=== ${k.title}\n    ${k.url}\n`);
  for (const p of k.phrases) {
    console.log(`- "${p.phrase}"`);
    console.log(`    ATC: ${(p.atc_prefixes ?? []).join(', ') || '(none)'}${(p.ingredients ?? []).length ? `; by name: ${p.ingredients.join(', ')}` : ''}`);
    console.log(`    why: ${p.reason}`);
  }
}
const topPath = new URL('../data/top300.json', import.meta.url);
if (existsSync(topPath)) {
  const t = read('../data/top300.json');
  console.log(`\n=== ${t.title} (derived ${t.derived_on}; ${t.fill_rows} fill rows, ${t.distinct_names} names, ${t.names_unresolved.length} unresolved)\n`);
  t.medicines.slice(0, 20).forEach((m) => console.log(`${String(m.rank).padStart(3)}. ${m.ingredient.padEnd(28)} weighted fills ${m.weighted_fills.toLocaleString('en-US')}`));
} else {
  console.log('\n(top300.json not derived yet)');
}
