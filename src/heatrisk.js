// NWS HeatRisk for a point, via the experimental ArcGIS ImageServer getSamples call.
// See spec.md > Components > HeatRisk client. Verified shape: one sample per day layer
// (HeatRisk_1_Mercator .. HeatRisk_7_Mercator), `value` is a decimal string such as
// "1.000000000", `attributes.idp_validtime` is epoch milliseconds. Samples arrive unordered.

export const SERVICE_URL =
  'https://mapservices.weather.noaa.gov/experimental/rest/services/NWS_HeatRisk/ImageServer/getSamples';

// Official words and legend colors from the ImageServer legend (checked 2026-09-30).
export const LEVELS = [
  { level: 0, word: 'Little to none', color: '#e8f9e7', ink: '#111111' },
  { level: 1, word: 'Minor', color: '#f4f257', ink: '#111111' },
  { level: 2, word: 'Moderate', color: '#f69632', ink: '#111111' },
  { level: 3, word: 'Major', color: '#e22f33', ink: '#ffffff' },
  { level: 4, word: 'Extreme', color: '#7a0e7f', ink: '#ffffff' },
];

// The CDC says to plan for orange, red, and magenta days: level 2 and above.
export const PLAN_THRESHOLD = 2;

export function levelInfo(level) {
  return LEVELS[level] ?? null;
}

export function buildUrl(lat, lon) {
  const geometry = JSON.stringify({ x: lon, y: lat, spatialReference: { wkid: 4326 } });
  const params = new URLSearchParams({
    geometry,
    geometryType: 'esriGeometryPoint',
    returnFirstValueOnly: 'false',
    outFields: 'name,idp_validtime',
    f: 'json',
  });
  return `${SERVICE_URL}?${params}`;
}

function isoDateUtc(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

// Turns a getSamples response into a sorted week: [{ date, level, word, layer }].
// Levels outside 0..4 (NoData is 5) become null, which the page shows as unavailable.
export function parseSamples(json) {
  const samples = Array.isArray(json?.samples) ? json.samples : [];
  const days = samples
    .map((s) => {
      const raw = Number.parseFloat(s?.value);
      const rounded = Number.isFinite(raw) ? Math.round(raw) : NaN;
      const level = rounded >= 0 && rounded <= 4 ? rounded : null;
      const ms = Number(s?.attributes?.idp_validtime);
      return {
        date: Number.isFinite(ms) ? isoDateUtc(ms) : null,
        level,
        word: level === null ? null : LEVELS[level].word,
        layer: s?.attributes?.name ?? null,
        validMs: Number.isFinite(ms) ? ms : null,
      };
    })
    .filter((d) => d.date !== null)
    .sort((a, b) => a.validMs - b.validMs);
  return days;
}

// Fetches the week for a point. Returns one of:
//   { status: 'ok', week }            seven (or fewer) days with levels
//   { status: 'unavailable', week }   the service answered but has no data here
//   { status: 'error', error }        network or service failure (caller decides fallback)
export async function forecastFor(lat, lon, { fetchImpl = fetch, timeoutMs = 10000 } = {}) {
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const res = await fetchImpl(buildUrl(lat, lon), { signal: controller?.signal });
    if (!res.ok) return { status: 'error', error: new Error(`HTTP ${res.status}`) };
    const json = await res.json();
    if (json?.error) return { status: 'error', error: new Error(json.error.message || 'service error') };
    const week = parseSamples(json);
    const usable = week.filter((d) => d.level !== null);
    if (usable.length === 0) return { status: 'unavailable', week };
    return { status: 'ok', week };
  } catch (error) {
    return { status: 'error', error };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// Days at or above the CDC planning threshold (orange, red, magenta).
export function planningDays(week) {
  return (week ?? []).filter((d) => d.level !== null && d.level >= PLAN_THRESHOLD);
}

export function maxLevel(week) {
  return (week ?? []).reduce((m, d) => (d.level !== null && d.level > m ? d.level : m), -1);
}

export function weekdayLabel(isoDate) {
  const d = new Date(`${isoDate}T12:00:00Z`);
  return d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
}

export function shortDateLabel(isoDate) {
  const d = new Date(`${isoDate}T12:00:00Z`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}
