// ZIP code to coordinates, from the bundled Census ZCTA gazetteer slices in data/zip/.
// See spec.md > Components > ZIP lookup.

export function isZip(text) {
  return /^\d{5}$/.test(String(text ?? '').trim());
}

async function defaultLoad(prefix) {
  const res = await fetch(`data/zip/${prefix}.json`, { cache: 'force-cache' });
  if (!res.ok) return null;
  return res.json();
}

// Returns { zip, lat, lon } or null when the ZIP is malformed or not in the gazetteer.
// `load(prefix)` is injectable so tests can read the files without a browser.
export async function lookupZip(zipText, { load = defaultLoad } = {}) {
  const zip = String(zipText ?? '').trim();
  if (!isZip(zip)) return null;
  const table = await load(zip.slice(0, 3));
  if (!table) return null;
  const row = table[zip];
  if (!row) return null;
  return { zip, lat: row[0], lon: row[1] };
}
