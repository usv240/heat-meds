// Medicine name -> RxNorm concept -> ingredients, with spelling help.
// See spec.md > Components > RxNorm client. Free NLM service, no key, 20 requests/second/IP.
// Rule from testing: never accept an approximate match silently; it becomes a did-you-mean.

export const RXNAV = 'https://rxnav.nlm.nih.gov/REST';

const DOSE_RE = /^\d+([.,]\d+)?(mg|mcg|g|gram|grams|ml|l|iu|units?|u|%|meq|mmol)?$/i;
const UNIT_WORDS = new Set(['mg', 'mcg', 'g', 'gram', 'grams', 'ml', 'iu', 'unit', 'units', 'meq', 'mmol', 'percent']);
const FORM_WORDS = new Set([
  'tablet', 'tablets', 'tab', 'tabs', 'capsule', 'capsules', 'cap', 'caps', 'pill', 'pills', 'oral', 'chewable',
  'solution', 'suspension', 'syrup', 'liquid', 'injection', 'injectable', 'pen', 'patch', 'patches', 'cream', 'ointment',
  'gel', 'drops', 'drop', 'inhaler', 'spray', 'nasal', 'topical', 'suppository', 'lozenge', 'film', 'kit', 'vial',
  'daily', 'once', 'twice', 'bid', 'tid', 'qd', 'po', 'prn', 'each', 'per', 'day', 'take', 'by', 'mouth', 'with', 'food',
  'extended', 'delayed', 'release', 'immediate', 'sustained', 'controlled', 'long', 'acting', 'strength', 'extra', 'regular',
]);
const RELEASE_WORDS = new Set(['er', 'xr', 'sr', 'cr', 'dr', 'la', 'xl', 'ir', 'odt', 'hct']);

// Pure. "Lasix 40 mg" -> "lasix"; "Toprol-XL" -> "toprol xl"; "metoprolol succinate ER 50mg" -> "metoprolol succinate".
// Release words (ER, XL, ...) are dropped only when a dose or form word was also present,
// so brand names like "Toprol XL" survive intact.
export function normalizeName(text) {
  const cleaned = String(text ?? '')
    .toLowerCase()
    .replace(/[()\[\],;:]+/g, ' ')
    .replace(/[-_/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '';
  const tokens = cleaned.split(' ');
  const hadDoseOrForm = tokens.some((t) => DOSE_RE.test(t) || UNIT_WORDS.has(t) || FORM_WORDS.has(t));
  const kept = tokens.filter((t) => {
    if (DOSE_RE.test(t)) return false;
    if (UNIT_WORDS.has(t) || FORM_WORDS.has(t)) return false;
    if (hadDoseOrForm && RELEASE_WORDS.has(t)) return false;
    return true;
  });
  // Keep "hct" only when it is part of the name (e.g. "benicar hct"); it is stripped above only with a dose.
  return kept.join(' ').trim();
}

const sessionCache = new Map();

async function getJson(url, fetchImpl) {
  if (sessionCache.has(url)) return sessionCache.get(url);
  const res = await fetchImpl(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`RxNav ${res.status} for ${url}`);
  const json = await res.json();
  sessionCache.set(url, json);
  return json;
}

async function properties(rxcui, f) {
  const j = await getJson(`${RXNAV}/rxcui/${rxcui}/properties.json`, f);
  return j?.properties ?? null;
}

async function relatedIngredients(rxcui, f) {
  const j = await getJson(`${RXNAV}/rxcui/${rxcui}/related.json?tty=IN`, f);
  const out = [];
  for (const g of j?.relatedGroup?.conceptGroup ?? []) {
    for (const c of g.conceptProperties ?? []) out.push({ rxcui: c.rxcui, name: c.name, tty: c.tty });
  }
  return out;
}

// Builds the ingredient list for a concept, following the learner's rule:
// IN/PIN -> itself (PIN also records its base ingredient); anything else -> related INs.
async function ingredientsFor(rxcui, props, f) {
  if (props.tty === 'IN') return [{ rxcui, name: props.name, tty: 'IN', base_name: props.name }];
  if (props.tty === 'PIN') {
    const base = await relatedIngredients(rxcui, f);
    return [{ rxcui, name: props.name, tty: 'PIN', base_name: base[0]?.name ?? props.name, base_rxcui: base[0]?.rxcui ?? null }];
  }
  const ins = await relatedIngredients(rxcui, f);
  return ins.map((i) => ({ ...i, base_name: i.name }));
}

async function conceptFor(rxcui, f) {
  const props = await properties(rxcui, f);
  if (!props) return null;
  const ingredients = await ingredientsFor(rxcui, props, f);
  return { rxcui, name: props.name, tty: props.tty, ingredients };
}

function fromSaved(saved, query) {
  const hit = saved?.lookups?.[query];
  if (!hit) return null;
  return { ...structuredClone(hit), saved: true, status: 'resolved' };
}

// resolveMedicine(text) -> { input, query, rxcui, name, tty, ingredients, candidate, suggestions, status }
//   status: 'resolved' | 'did_you_mean' | 'suggestions' | 'not_recognized' | 'error'
export async function resolveMedicine(text, { fetchImpl = fetch, savedLookups = null } = {}) {
  const input = String(text ?? '').trim();
  const query = normalizeName(input);
  const base = { input, query, rxcui: null, name: null, tty: null, ingredients: [], candidate: null, suggestions: [], status: 'not_recognized' };
  if (!query) return base;

  try {
    // 1. Exact (normalized) lookup.
    const exact = await getJson(`${RXNAV}/rxcui.json?name=${encodeURIComponent(query)}&search=2`, fetchImpl);
    const ids = exact?.idGroup?.rxnormId ?? [];
    if (ids.length) {
      const c = await conceptFor(ids[0], fetchImpl);
      if (c && c.ingredients.length) return { ...base, ...c, status: 'resolved' };
    }

    // 2. Approximate: top candidate becomes a did-you-mean, never accepted silently.
    const approx = await getJson(`${RXNAV}/approximateTerm.json?term=${encodeURIComponent(query)}&maxEntries=5`, fetchImpl);
    const candidates = (approx?.approximateGroup?.candidate ?? []).filter((c) => c.rxcui);
    for (const cand of candidates) {
      const c = await conceptFor(cand.rxcui, fetchImpl);
      if (!c || !c.ingredients.length) continue;
      const ingNames = c.ingredients.map((i) => i.name).join(' + ');
      const label = c.tty === 'IN' || c.tty === 'PIN' || c.tty === 'MIN' ? ingNames : `${ingNames} (${c.name})`;
      return { ...base, candidate: { ...c, label, score: Number(cand.score) }, status: 'did_you_mean' };
    }

    // 3. Spelling suggestions, or not recognized.
    const sp = await getJson(`${RXNAV}/spellingsuggestions.json?name=${encodeURIComponent(query)}`, fetchImpl);
    const suggestions = sp?.suggestionGroup?.suggestionList?.suggestion ?? [];
    if (suggestions.length) return { ...base, suggestions: suggestions.slice(0, 5), status: 'suggestions' };
    return base;
  } catch (error) {
    const saved = fromSaved(savedLookups, query);
    if (saved) return { ...saved, input };
    return { ...base, status: 'error', error: String(error?.message ?? error) };
  }
}

// Turns a did-you-mean result into a resolved one. Only called after the person taps "Yes".
export function acceptCandidate(result) {
  if (result?.status !== 'did_you_mean' || !result.candidate) return result;
  const { label, score, ...concept } = result.candidate;
  return { ...result, ...concept, candidate: null, status: 'resolved', accepted_from_candidate: true };
}

export function clearSessionCache() {
  sessionCache.clear();
}
