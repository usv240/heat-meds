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
  // Major is darkened slightly from the legend's #e22f33, whose white label measures 4.48:1, to
  // #dc2a2f (4.76:1) so the small day labels meet WCAG AA 4.5:1. Still reads as the official red.
  { level: 3, word: 'Major', color: '#dc2a2f', ink: '#ffffff' },
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

// The HeatRisk ImageServer covers the contiguous United States only. Points outside this box
// (Hawaii, Alaska, Puerto Rico, the territories) get HTTP 400 "Invalid or missing input
// parameters" from getSamples, verified by the project author for Honolulu, Anchorage, and
// San Juan. They are "outside the forecast area", never a reason to show saved data.
export const CONUS_BOUNDS = { latMin: 24.3, latMax: 49.6, lonMin: -125.2, lonMax: -66.8 };

export function insideForecastArea(lat, lon) {
  return Number.isFinite(lat) && Number.isFinite(lon)
    && lat >= CONUS_BOUNDS.latMin && lat <= CONUS_BOUNDS.latMax
    && lon >= CONUS_BOUNDS.lonMin && lon <= CONUS_BOUNDS.lonMax;
}

// Fetches the week for a point. Returns one of:
//   { status: 'ok', week }            seven (or fewer) days with levels
//   { status: 'unavailable', week }   outside the forecast area, or the service has no data here
//   { status: 'error', error }        network or service failure (caller decides fallback)
export async function forecastFor(lat, lon, { fetchImpl = fetch, timeoutMs = 10000 } = {}) {
  if (!insideForecastArea(lat, lon)) return { status: 'unavailable', week: [], reason: 'outside forecast area' };
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const res = await fetchImpl(buildUrl(lat, lon), { signal: controller?.signal });
    // A 400 means the point is not covered (the service rejects it), not that the service is down.
    if (res.status === 400) return { status: 'unavailable', week: [], reason: 'service rejected point' };
    if (!res.ok) return { status: 'error', error: new Error(`HTTP ${res.status}`) };
    const json = await res.json();
    // ArcGIS may answer HTTP 200 with an error body; code 400 means the point is not covered.
    if (json?.error) {
      if (Number(json.error.code) === 400) return { status: 'unavailable', week: [], reason: 'service rejected point' };
      return { status: 'error', error: new Error(json.error.message || 'service error') };
    }
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

// Shapes the saved heat wave file into a week the page can render.
export function savedWeek(saved) {
  return (saved?.week ?? []).map((d) => ({ date: d.date, level: d.level, word: d.word, validMs: Date.parse(`${d.date}T12:00:00Z`), source_url: d.source_url ?? null }));
}

// Chooses what to show for the heat area. `result` is from forecastFor (or null when there is
// no ZIP / no coordinates). Returns { week, mode, label } where mode is one of
// 'live' | 'replay' | 'fallback' | 'unavailable' | 'none'.
export function chooseWeek({ result, saved, replay = false }) {
  if (replay && saved) return { week: savedWeek(saved), mode: 'replay', label: saved.label };
  if (!result) return { week: null, mode: 'none', label: null };
  if (result.status === 'ok') return { week: result.week, mode: 'live', label: null };
  if (result.status === 'unavailable') return { week: null, mode: 'unavailable', label: null };
  if (saved) return { week: savedWeek(saved), mode: 'fallback', label: `Saved data: ${saved.label}` };
  return { week: null, mode: 'error', label: null };
}
