// Public, keyless entry point for developers. Import it straight from the live site:
//
//   import { checkMedicines } from 'https://usv240.github.io/heat-meds/src/api.js';
//   const plan = await checkMedicines(['furosemide 40 mg', 'lisinopril'], { zip: '85004' });
//
// It runs the same modules the site and the evidence run use (RxNorm, RxClass, HeatRisk, the CDC
// rules file), inside the caller's own browser. There is no Heat Meds server, so there is no key to
// issue, nothing to rate-limit on our side, and no medicine list is ever sent to us.

import { resolveMedicine } from './rxnorm.js';
import { classifyMedicine } from './rxclass.js';
import { lookupZip } from './zip.js';
import { forecastFor, chooseWeek } from './heatrisk.js';
import { evaluate, planToText } from './rules.js';
import { makeMatcher } from './answer-keys.js';

const BASE = new URL('../', import.meta.url);
const loadJson = async (path) => {
  const res = await fetch(new URL(path, BASE));
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
};

export const VERSION = '1.0.0';

// names: medicine names as typed (brand, generic, dose text, misspellings).
// options.zip: optional 5-digit US ZIP. options.replay: true to use the saved Phoenix heat wave.
// Returns { plan, text, medicines, unresolved, heat } where unresolved lists names that need a person
// to confirm (did-you-mean or suggestions) or were not recognized. Nothing uncertain is guessed.
export async function checkMedicines(names, { zip = null, replay = false } = {}) {
  const list = (Array.isArray(names) ? names : [names]).map((n) => String(n ?? '').trim()).filter(Boolean).slice(0, 25);
  const [rules, saved, ukhsa, canada] = await Promise.all([
    loadJson('data/cdc-rules.json'),
    loadJson('data/saved-heatwave.json').catch(() => null),
    loadJson('data/answer-keys/ukhsa.json').catch(() => null),
    loadJson('data/answer-keys/health-canada.json').catch(() => null),
  ]);

  const medicines = [];
  const unresolved = [];
  for (let i = 0; i < list.length; i += 3) {
    const batch = await Promise.all(list.slice(i, i + 3).map((n) => resolveMedicine(n)));
    for (const med of batch) {
      if (med.status === 'resolved') {
        await classifyMedicine(med);
        medicines.push(med);
      } else {
        unresolved.push({ input: med.input, status: med.status, candidate: med.candidate?.label ?? null, suggestions: med.suggestions ?? [] });
      }
    }
  }

  let result = null;
  let heat = { mode: 'none', zip: null };
  if (zip) {
    const loc = await lookupZip(zip, { load: (p) => loadJson(`data/zip/${p}.json`).catch(() => null) });
    if (loc) result = await forecastFor(loc.lat, loc.lon);
    heat = { mode: loc ? 'live' : 'zip_not_found', zip };
  }
  const chosen = chooseWeek({ result, saved, replay });
  if (zip || replay) heat = { ...heat, mode: chosen.mode, label: chosen.label ?? null };

  const answerKeys = ukhsa && canada ? { ukhsa: makeMatcher(ukhsa), health_canada: makeMatcher(canada) } : null;
  const saveMode = chosen.mode === 'replay' || chosen.mode === 'fallback';
  const mode = saveMode ? 'replay' : chosen.mode === 'live' ? 'live' : chosen.mode === 'unavailable' ? 'unavailable'
    : chosen.mode === 'error' ? 'unreachable' : zip ? 'zip_not_found' : 'no_zip';
  const plan = evaluate({ medicines, forecast: chosen.week, rules, answerKeys, today: new Date().toISOString().slice(0, 10), mode, place: saveMode ? (saved?.place ?? null) : null });
  return { version: VERSION, plan, text: planToText(plan).join('\n'), medicines, unresolved, heat, disclaimer: 'Educational tool, not medical advice. Never stop or change a medicine on your own. Talk to your pharmacist or doctor.' };
}
