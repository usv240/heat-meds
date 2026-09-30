// Orchestrates the plan page: medicines + ZIP -> forecast -> rules engine -> sections.
// Slice 2: the example list comes from data/saved-lookups.json. Slice 3 adds live chips.

import { initTheme } from './theme.js';
import { getZip, setZip, getList, setList } from './storage.js';
import { lookupZip } from './zip.js';
import { forecastFor } from './heatrisk.js';
import { placeFor } from './place.js';
import { evaluate } from './rules.js';
import { renderHeatWeek, renderHeatNote, renderSummary, renderPlanSections } from './plan-render.js';

initTheme();

const placeLine = document.getElementById('placeLine');
const dateLine = document.getElementById('dateLine');
const heatArea = document.getElementById('heatArea');
const summaryArea = document.getElementById('summaryArea');
const planArea = document.getElementById('planArea');
const exampleBanner = document.getElementById('exampleBanner');

const params = new URLSearchParams(window.location.search);
const isExample = params.get('example') === '1';

async function loadJson(path) {
  const res = await fetch(path, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

async function loadMedicines() {
  if (isExample) {
    const saved = await loadJson('data/saved-lookups.json');
    const meds = saved.example.medicines.map((key) => saved.lookups[key]).filter(Boolean);
    setList(meds);
    setZip(saved.example.zip);
    if (exampleBanner) {
      exampleBanner.hidden = false;
      exampleBanner.textContent = `Example: ${saved.example.description} Medicine lookups are ${saved.label.toLowerCase()} from ${saved.saved_on}.`;
    }
    return meds;
  }
  return getList();
}

async function loadForecast(zip) {
  if (!zip) return { week: null, note: "Add a ZIP code to see this week's heat where you live." };
  const loc = await lookupZip(zip);
  if (!loc) return { week: null, note: `ZIP ${zip} was not found in the Census ZIP list, so there is no forecast to show. The medicine check below still applies.` };
  placeFor(loc.lat, loc.lon).then((p) => { if (p) placeLine.textContent = `${p.city}, ${p.state} (ZIP ${zip})`; });
  const result = await forecastFor(loc.lat, loc.lon);
  if (result.status === 'ok') return { week: result.week, note: null };
  if (result.status === 'unavailable') return { week: null, note: 'The HeatRisk forecast is not available for this ZIP. It covers the contiguous United States. The medicine check below still applies.' };
  console.error('HeatRisk error', result.error);
  return { week: null, note: 'The National Weather Service forecast could not be reached right now. The medicine check below still applies.' };
}

async function run() {
  dateLine.textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const [medicines, rules] = await Promise.all([loadMedicines(), loadJson('data/cdc-rules.json')]);
  const zip = getZip();
  placeLine.textContent = zip ? `ZIP ${zip}` : 'No ZIP code';

  if (!medicines.length) {
    heatArea.replaceChildren(renderHeatNote('No medicines yet. Go back and add at least one medicine, or try the example.'));
    return;
  }

  const forecast = await loadForecast(zip);
  heatArea.replaceChildren(forecast.week ? renderHeatWeek(forecast.week) : renderHeatNote(forecast.note));

  const plan = evaluate({ medicines, forecast: forecast.week, rules, today: todayIso() });
  summaryArea.replaceChildren(renderSummary(plan));
  planArea.replaceChildren(renderPlanSections(plan));
}

run().catch((err) => {
  console.error(err);
  planArea.replaceChildren(renderHeatNote('Something went wrong building the plan. Reload the page to try again.'));
});
