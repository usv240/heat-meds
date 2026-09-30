# Heat Meds

Type in your medicines and ZIP code. Get one printable page that says which of your medicines make hot days more dangerous, what this week's heat looks like where you live, and what to ask your pharmacist. It never tells anyone to stop a medicine.

A proof of concept built for the Devpost Build With AI: Basics hackathon. Planning documents are in `devpost/`.

## Run it locally

The site is plain HTML, CSS, and JavaScript modules with no build step. Modules need an HTTP server, not `file://`.

```
python -m http.server 8000
```

Then open http://localhost:8000/ in a browser. Any static server works, for example `npx serve .`.

## Tests

Requires Node 20 or newer.

```
node --test
```

Build step one, a live check of the experimental National Weather Service HeatRisk service:

```
node scripts/smoke-heatrisk.mjs
```

## Data

- `data/zip/` is generated from the U.S. Census Bureau 2024 ZCTA Gazetteer (public domain) by `node scripts/build-zip-index.mjs`.

## Sources

- National Weather Service HeatRisk (experimental): https://www.wpc.ncep.noaa.gov/heatrisk/
- U.S. Census Bureau Gazetteer files: https://www.census.gov/geographies/reference-files/time-series/geo/gazetteer-files.html

## License

MIT. See `LICENSE`.
