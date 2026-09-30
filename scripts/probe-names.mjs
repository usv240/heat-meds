// Live check of name resolution against RxNorm and RxClass, for the cases the spec names.
// Usage: node scripts/probe-names.mjs [names...]

import { resolveMedicine, acceptCandidate } from '../src/rxnorm.js';
import { classifyMedicine } from '../src/rxclass.js';

const names = process.argv.length > 2 ? process.argv.slice(2)
  : ['Lasix 40 mg', 'Toprol XL', 'lisinopril-hydrochlorothiazide', 'furosamide', 'xyzabc', 'hctz', 'metoprolol succinate ER 50mg', 'Entresto'];

let failures = 0;
for (const n of names) {
  const r = await resolveMedicine(n);
  let shown = r;
  if (r.status === 'did_you_mean') shown = acceptCandidate(r);
  if (shown.status === 'resolved') await classifyMedicine(shown);
  const ings = shown.ingredients.map((i) => `${i.name}${i.base_name && i.base_name !== i.name ? ` [base ${i.base_name}]` : ''} ${JSON.stringify(i.atc ?? [])}`).join(' + ');
  console.log(`${n.padEnd(32)} query="${r.query}" status=${r.status}${r.candidate ? ` candidate="${r.candidate.label}" score=${r.candidate.score}` : ''}${r.suggestions.length ? ` suggestions=${JSON.stringify(r.suggestions)}` : ''}${ings ? `\n${''.padEnd(32)} -> ${shown.name} (${shown.tty}) = ${ings}` : ''}`);
  if (r.status === 'error') failures++;
  await new Promise((res) => setTimeout(res, 120));
}
if (failures) process.exit(1);
