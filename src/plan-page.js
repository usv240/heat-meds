// Orchestrates the plan page: medicines + ZIP -> forecast (live, replay, or saved) -> rules -> sections.

import { initTheme } from './theme.js';
import { getZip, setZip, getList, setList } from './storage.js';
import { lookupZip } from './zip.js';
import { forecastFor, chooseWeek } from './heatrisk.js';
import { placeFor } from './place.js';
import { evaluate } from './rules.js';
import { classifyMedicine } from './rxclass.js';
import { renderHeatWeek, renderHeatNote, renderSummary, renderPlanSections } from './plan-render.js';
import { loadGlossary, infoButton } from './info.js';

initTheme();

const placeLine = document.getElementById('placeLine');
const dateLine = document.getElementById('dateLine');
const heatArea = document.getElementById('heatArea');
const heatLabel = document.getElementById('heatLabel');
const replayRow = document.getElementById('replayRow');
const replayToggle = document.getElementById('replayToggle');
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

const todayIso = () => new Date().toISOString().slice(0, 10);

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
  const list = getList();
  for (const med of list) {
    if ((med.ingredients ?? []).some((i) => !Array.isArray(i.atc))) {
      try { await classifyMedicine(med); } catch { /* the engine treats missing codes as none */ }
    }
  }
  setList(list);
  return list;
}

// Fetches the live forecast for the ZIP. Returns { result, note } where result is null when
// there is no ZIP or the ZIP is not in the gazetteer.
async function loadLive(zip) {
  if (!zip) return { result: null, note: "Add a ZIP code to see this week's heat where you live." };
  const loc = await lookupZip(zip);
  if (!loc) return { result: null, note: `ZIP ${zip} was not found in the Census ZIP list, so there is no forecast to show. The medicine check below still applies.` };
  placeFor(loc.lat, loc.lon).then((p) => { if (p) placeLine.textContent = `${p.city}, ${p.state} (ZIP ${zip})`; });
  const result = await forecastFor(loc.lat, loc.lon);
  if (result.status === 'error') console.error('HeatRisk error', result.error);
  return { result, note: null };
}

function heatNoteFor(mode, liveNote) {
  if (mode === 'none') return liveNote;
  if (mode === 'unavailable') return 'The HeatRisk forecast is not available for this ZIP. It covers the contiguous United States. The medicine check below still applies.';
  if (mode === 'error') return 'The National Weather Service forecast could not be reached right now. The medicine check below still applies.';
  return null;
}

async function run() {
  dateLine.textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const [medicines, rules, saved] = await Promise.all([loadMedicines(), loadJson('data/cdc-rules.json'), loadJson('data/saved-heatwave.json').catch(() => null), loadGlossary()]);
  document.getElementById('heatHeading')?.append(infoButton('heatrisk'));
  const zip = getZip();
  placeLine.textContent = zip ? `ZIP ${zip}` : 'No ZIP code';

  if (!medicines.length) {
    heatArea.replaceChildren(renderHeatNote('No medicines yet. Go back and add at least one medicine, or try the example.'));
    return;
  }

  const live = await loadLive(zip);

  // The example opens on the real past heat wave so the demo shows orange, red, and magenta days.
  let replay = isExample && Boolean(saved);
  if (saved) {
    replayRow.hidden = false;
    replayToggle.checked = replay;
  }

  function render() {
    const chosen = chooseWeek({ result: live.result, saved, replay });
    const note = heatNoteFor(chosen.mode, live.note);
    heatArea.replaceChildren(chosen.week ? renderHeatWeek(chosen.week) : renderHeatNote(note));
    if (chosen.label) {
      heatLabel.hidden = false;
      heatLabel.replaceChildren(document.createTextNode(chosen.mode === 'replay' ? `Past heat wave: ${chosen.label}. This is not this week's forecast.` : `${chosen.label}. The live forecast could not be reached.`), infoButton('saved_data'));
    } else {
      heatLabel.hidden = true;
    }
    const plan = evaluate({ medicines, forecast: chosen.week, rules, today: chosen.mode === 'replay' ? chosen.week[0].date : todayIso() });
    summaryArea.replaceChildren(renderSummary(plan));
    planArea.replaceChildren(renderPlanSections(plan));
  }

  replayToggle.addEventListener('change', () => {
    replay = replayToggle.checked;
    render();
  });
  render();
}

run().catch((err) => {
  console.error(err);
  planArea.replaceChildren(renderHeatNote('Something went wrong building the plan. Reload the page to try again.'));
});
