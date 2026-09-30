// The home page's live example: the Phoenix past heat wave and the furosemide card, built by the
// same code the plan page uses (rules.js evaluate, plan-render.js renderHeatWeek and renderCard).
// It is always labeled as a past heat wave so it can never be read as this week's forecast.

import { savedWeek } from './heatrisk.js';
import { evaluate } from './rules.js';
import { el, renderHeatWeek, renderCard } from './plan-render.js';
import { loadGlossary } from './info.js';

async function loadJson(path) {
  const res = await fetch(path, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

export async function renderHomePreview(container) {
  const label = container.querySelector('.preview-label');
  try {
    const [saved, lookups, rules] = await Promise.all([
      loadJson('data/saved-heatwave.json'), loadJson('data/saved-lookups.json'), loadJson('data/cdc-rules.json'), loadGlossary(),
    ]);
    const week = savedWeek(saved);
    const medicine = structuredClone(lookups.lookups.furosemide);
    const plan = evaluate({ medicines: [medicine], forecast: week, rules, mode: 'replay', place: saved.place });
    container.replaceChildren(
      label,
      renderHeatWeek(week),
      el('p', { class: 'small heat-label', text: `Past heat wave: ${saved.label}. Not this week's forecast.` }),
      renderCard(plan.cards[0]),
    );
  } catch (error) {
    console.error(error);
    container.replaceChildren(label, el('p', { class: 'note', text: 'The example could not load here. Press Try an example to see the full plan.' }));
  }
}
