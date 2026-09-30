// Best-effort place name for coordinates, from the National Weather Service points API.
// The Census gazetteer has no place names, so this fills in "Phoenix, AZ" when it can.
// Same organization as the HeatRisk service, so the trust line still holds. If it fails,
// the page shows the ZIP alone.

export async function placeFor(lat, lon, { fetchImpl = fetch, timeoutMs = 6000 } = {}) {
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const url = `https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`;
    const res = await fetchImpl(url, {
      signal: controller?.signal,
      headers: { Accept: 'application/geo+json' },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const rel = json?.properties?.relativeLocation?.properties;
    if (!rel?.city) return null;
    return { city: rel.city, state: rel.state ?? '' };
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
