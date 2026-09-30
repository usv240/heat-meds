// One-time script: samples the NWS HeatRisk Day-1 archive GeoTIFFs at a point for a date
// range and writes data/saved-heatwave.json. Used for the "See your list on a real past heat
// wave" replay, "Try an example", and the outage fallback.
//
// Usage: node scripts/sample-heatwave.mjs [startYYYYMMDD] [endYYYYMMDD] [lat] [lon]
// Defaults: 20250803 20250809, downtown Phoenix (33.4516, -112.0699).
//
// The archive rasters are Web Mercator (EPSG:3857), verified by the project author:
// pixel 2539.703 m, origin -14326021.825, 6722143.668, NoData 5. We convert lat/lon to
// Mercator and read the single pixel directly.

import { writeFileSync } from 'node:fs';
import { fromArrayBuffer } from 'geotiff';
import { LEVELS } from '../src/heatrisk.js';

const [startArg = '20250803', endArg = '20250809', latArg = '33.4516', lonArg = '-112.0699'] = process.argv.slice(2);
const lat = Number(latArg);
const lon = Number(lonArg);
const ARCHIVE = 'https://www.wpc.ncep.noaa.gov/heatrisk/data/archive';

function toMercator(latDeg, lonDeg) {
  const R = 6378137;
  const x = (lonDeg * Math.PI / 180) * R;
  const y = Math.log(Math.tan(Math.PI / 4 + (latDeg * Math.PI / 180) / 2)) * R;
  return { x, y };
}

function* dates(start, end) {
  const s = new Date(`${start.slice(0, 4)}-${start.slice(4, 6)}-${start.slice(6, 8)}T12:00:00Z`);
  const e = new Date(`${end.slice(0, 4)}-${end.slice(4, 6)}-${end.slice(6, 8)}T12:00:00Z`);
  for (let d = new Date(s); d <= e; d.setUTCDate(d.getUTCDate() + 1)) yield d.toISOString().slice(0, 10);
}

async function sampleDay(iso) {
  const ymd = iso.replaceAll('-', '');
  const url = `${ARCHIVE}/HeatRisk_CONUS_${ymd}.tif`;
  const res = await fetch(url, { headers: { 'User-Agent': 'heat-meds-poc (sampling one pixel)' } });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const tiff = await fromArrayBuffer(await res.arrayBuffer());
  const image = await tiff.getImage();
  const [ox, oy] = image.getOrigin();
  const [rx, ry] = image.getResolution();
  const { x, y } = toMercator(lat, lon);
  const px = Math.floor((x - ox) / rx);
  const py = Math.floor((y - oy) / ry);
  const w = image.getWidth();
  const h = image.getHeight();
  if (px < 0 || py < 0 || px >= w || py >= h) throw new Error(`point outside raster (${px},${py}) of ${w}x${h}`);
  const [band] = await image.readRasters({ window: [px, py, px + 1, py + 1] });
  const raw = Number(band[0]);
  const nodata = image.getGDALNoData();
  const level = raw >= 0 && raw <= 4 ? raw : null;
  return { date: iso, level, word: level === null ? null : LEVELS[level].word, raw, nodata, source_url: url, origin: [ox, oy], resolution: [rx, ry], pixel: [px, py] };
}

const days = [];
for (const iso of dates(startArg, endArg)) {
  const d = await sampleDay(iso);
  console.log(d.date, d.raw, d.word ?? 'NoData', `px=${d.pixel} origin=${d.origin.map((v) => v.toFixed(3))} res=${d.resolution.map((v) => v.toFixed(3))} nodata=${d.nodata}`);
  days.push(d);
}

const first = days[0].date;
const last = days[days.length - 1].date;
const fmt = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const year = first.slice(0, 4);
const out = {
  label: `HeatRisk as forecast each day, Phoenix, ${fmt(first)} to ${fmt(last)}, ${year}`,
  place: 'Phoenix, AZ',
  zip: '85004',
  lat,
  lon,
  kind: 'saved data',
  note: 'Real past HeatRisk Day-1 forecasts sampled from the NWS archive (one GeoTIFF per day) at downtown Phoenix. Used for the replay toggle, the example, and as the fallback when the live service cannot be reached. This is not a forecast for today.',
  source_title: 'NWS Weather Prediction Center, US Daily Archive of HeatRisk Day 1 Forecasts (experimental)',
  source_index: `${ARCHIVE}/`,
  sampled_on: new Date().toISOString().slice(0, 10),
  raster: { crs: 'EPSG:3857', origin: days[0].origin, resolution: days[0].resolution, nodata: days[0].nodata },
  week: days.map((d) => ({ date: d.date, level: d.level, word: d.word, source_url: d.source_url })),
};
writeFileSync(new URL('../data/saved-heatwave.json', import.meta.url), JSON.stringify(out, null, 2) + '\n');
console.log(`Wrote data/saved-heatwave.json: ${out.week.map((d) => d.word).join(', ')}`);
