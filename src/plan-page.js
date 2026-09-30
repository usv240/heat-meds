// Orchestrates the plan page: ZIP to coordinates to HeatRisk to heat boxes.
// Slice 1 scope: the heat area only. Later slices add medicines and the rules engine.

import { initTheme } from './theme.js';
import { getZip } from './storage.js';
import { lookupZip } from './zip.js';
import { forecastFor } from './heatrisk.js';
import { placeFor } from './place.js';
import { renderHeatWeek, renderHeatNote } from './plan-render.js';

initTheme();

const placeLine = document.getElementById('placeLine');
const dateLine = document.getElementById('dateLine');
const heatArea = document.getElementById('heatArea');

function setPlace(text) {
  placeLine.textContent = text;
}

async function run() {
  dateLine.textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const zip = getZip();

  if (!zip) {
    setPlace('No ZIP code');
    heatArea.replaceChildren(renderHeatNote("Add a ZIP code to see this week's heat where you live."));
    return;
  }

  const loc = await lookupZip(zip);
  if (!loc) {
    setPlace(`ZIP ${zip}`);
    heatArea.replaceChildren(renderHeatNote(`ZIP ${zip} was not found in the Census ZIP list, so there is no forecast to show. Check the ZIP, or continue without one.`));
    return;
  }

  setPlace(`ZIP ${zip}`);
  placeFor(loc.lat, loc.lon).then((p) => {
    if (p) setPlace(`${p.city}, ${p.state} (ZIP ${zip})`);
  });

  const result = await forecastFor(loc.lat, loc.lon);
  if (result.status === 'ok') {
    heatArea.replaceChildren(renderHeatWeek(result.week));
  } else if (result.status === 'unavailable') {
    heatArea.replaceChildren(renderHeatNote('The HeatRisk forecast is not available for this ZIP. It covers the contiguous United States.'));
  } else {
    heatArea.replaceChildren(renderHeatNote('The National Weather Service forecast could not be reached right now. Try again in a minute.'));
    console.error('HeatRisk error', result.error);
  }
}

run();
