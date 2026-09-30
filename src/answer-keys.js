// Turns an answer-key file (UKHSA, Health Canada) into a matcher the rules engine can use for
// badges and the evidence runner can use for scoring. Pure: no network.

const norm = (s) => String(s ?? '').trim().toLowerCase();

export function validateKey(key) {
  if (!key || typeof key.key !== 'string') throw new Error('answer key: missing key name');
  if (!key.url || !key.title) throw new Error(`answer key ${key.key}: missing title or url`);
  if (!Array.isArray(key.phrases)) throw new Error(`answer key ${key.key}: phrases[] missing`);
  key.phrases.forEach((p, i) => {
    if (!p.phrase) throw new Error(`answer key ${key.key}: phrase ${i} has no text`);
    if (!p.reason) throw new Error(`answer key ${key.key}: "${p.phrase}" has no reason`);
    const hasMap = (p.atc_prefixes ?? []).length || (p.ingredients ?? []).length;
    if (!hasMap) throw new Error(`answer key ${key.key}: "${p.phrase}" maps to nothing`);
  });
  return key;
}

// Returns { key, title, url, scored, matches(ing), phrasesFor(ing) }.
// `ing` is { name, base_name, atc: [] } as produced by rxnorm.js + rxclass.js.
export function makeMatcher(key) {
  validateKey(key);
  const phrases = key.phrases.map((p) => ({
    phrase: p.phrase,
    reason: p.reason,
    atc: p.atc_prefixes ?? [],
    names: (p.ingredients ?? []).map(norm),
  }));
  const phrasesFor = (ing) => {
    const atc = Array.isArray(ing?.atc) ? ing.atc : [];
    const names = [norm(ing?.name), norm(ing?.base_name)].filter(Boolean);
    return phrases.filter((p) => p.atc.some((prefix) => atc.some((code) => code.startsWith(prefix))) || p.names.some((n) => names.includes(n)));
  };
  return {
    key: key.key,
    title: key.title,
    url: key.url,
    scored: key.scored !== false,
    matches: (ing) => phrasesFor(ing).length > 0,
    phrasesFor,
  };
}

export function makeMatchers(keys) {
  const out = {};
  for (const k of keys) out[k.key] = makeMatcher(k);
  return out;
}
