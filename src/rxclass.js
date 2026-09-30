// Ingredient RxCUI -> ATC drug classes (level 4, e.g. C03CA), via NLM RxClass.
// See spec.md > Components > RxClass client. The trap the learner found: byRxcui also returns
// classes of combination products that CONTAIN the ingredient (furosemide came back with
// C03CB, metformin with A10BD). Keep only rows whose class member is the ingredient itself.

import { RXNAV } from './rxnorm.js';

const cache = new Map();

// Pure: filters a raw byRxcui response down to the ingredient's own ATC codes.
// `allowed` is the ingredient's RxCUI, or a list: for a precise ingredient (PIN) RxClass reports
// the class member as the base ingredient (metoprolol succinate -> metoprolol), so both are allowed.
export function filterAtcRows(json, allowed) {
  const ok = new Set((Array.isArray(allowed) ? allowed : [allowed]).filter(Boolean).map(String));
  const rows = json?.rxclassDrugInfoList?.rxclassDrugInfo ?? [];
  const codes = [];
  for (const row of rows) {
    if (!ok.has(String(row?.minConcept?.rxcui))) continue;
    const item = row?.rxclassMinConceptItem;
    if (!item || item.classType !== 'ATC1-4') continue;
    if (!codes.includes(item.classId)) codes.push(item.classId);
  }
  return codes.sort();
}

export async function classesForIngredient(rxcui, { fetchImpl = fetch, baseRxcui = null } = {}) {
  const key = String(rxcui);
  if (cache.has(key)) return cache.get(key);
  const url = `${RXNAV}/rxclass/class/byRxcui.json?rxcui=${encodeURIComponent(key)}&relaSource=ATC`;
  const res = await fetchImpl(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`RxClass ${res.status} for ${key}`);
  const json = await res.json();
  const atc = filterAtcRows(json, [key, baseRxcui]);
  cache.set(key, atc);
  return atc;
}

// RxClass often attaches the ATC code to a precise form rather than the base ingredient
// (olmesartan medoxomil carries C09CA; plain olmesartan has nothing). When a base ingredient
// has no codes, ask for its precise forms (PIN) and take their codes. Found by the evidence run.
async function classesViaPreciseForms(rxcui, { fetchImpl = fetch } = {}) {
  const res = await fetchImpl(`${RXNAV}/rxcui/${encodeURIComponent(rxcui)}/related.json?tty=PIN`, { headers: { Accept: 'application/json' } });
  if (!res.ok) return [];
  const json = await res.json();
  const pins = (json?.relatedGroup?.conceptGroup ?? []).flatMap((g) => g.conceptProperties ?? []);
  const codes = [];
  for (const pin of pins.slice(0, 6)) {
    const key = `pin:${pin.rxcui}`;
    let atc = cache.get(key);
    if (!atc) {
      const r = await fetchImpl(`${RXNAV}/rxclass/class/byRxcui.json?rxcui=${encodeURIComponent(pin.rxcui)}&relaSource=ATC`, { headers: { Accept: 'application/json' } });
      atc = r.ok ? filterAtcRows(await r.json(), [pin.rxcui, rxcui]) : [];
      cache.set(key, atc);
    }
    for (const c of atc) if (!codes.includes(c)) codes.push(c);
  }
  return codes.sort();
}

// Adds `atc` to every ingredient of a resolved medicine (in place) and returns it.
export async function classifyMedicine(med, opts = {}) {
  for (const ing of med.ingredients ?? []) {
    if (Array.isArray(ing.atc) && ing.atc.length) continue;
    try {
      ing.atc = await classesForIngredient(ing.rxcui, { ...opts, baseRxcui: ing.base_rxcui ?? null });
      if (!ing.atc.length && (ing.tty === 'IN' || !ing.tty)) {
        ing.atc = await classesViaPreciseForms(ing.rxcui, opts);
        if (ing.atc.length) ing.atc_via = 'precise forms';
      }
    } catch (error) {
      ing.atc = ing.atc ?? [];
      ing.atc_error = String(error?.message ?? error);
    }
  }
  return med;
}
