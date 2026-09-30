---
doc: spec
status: approved
---

# Heat Meds: Technical Spec

## How This Works, In Plain Language

The site is three plain web pages served from GitHub Pages: a landing page, the plan page, and an Evidence page. There is no server of ours. Everything runs in the visitor's browser.

When someone types a medicine name, the browser asks the National Library of Medicine's RxNorm service what that name is. RxNorm turns "Lasix" into furosemide and tells us whether a bottle holds one ingredient or several. Dose and form words like "40 mg" are stripped first, and if the only match is approximate, the chip asks "Did you mean metoprolol (Toprol XL)?" and waits for a tap rather than guessing. The browser then asks RxNorm's sister service, RxClass, which ATC drug classes each ingredient belongs to. ATC is the World Health Organization's classification code, like a library call number for medicines.

The browser then opens our own small rules file. That file is the CDC's heat-and-medication table, typed in by hand, one entry per drug class the CDC calls out, each with the exact CDC quote, a link, and the date checked. The rules engine, one JavaScript module, matches the ingredient's ATC codes and names against those entries and builds the plan: which medicines matter, why, what to watch for, what to ask the pharmacist, any combination warning, any storage note, and which medicines the CDC doesn't list.

For the weather, the browser looks up the ZIP in a bundled Census file to get coordinates, then asks the National Weather Service's HeatRisk map service for the next 7 days at that point. If that service is down, the page shows a saved real heat wave instead, clearly labeled.

The proof works because the test harness imports the same rules module the site runs. A Node script pushes the 300 most-prescribed US medicines, derived from a government survey, through RxNorm, RxClass, and the rules engine, compares what gets flagged with the UK and Canadian answer keys, scans every generated plan for any "stop your medicine" language, and writes a results file. The Evidence page reads that file. Nothing on it is typed by hand.

Why this shape: no bundler, no framework, no server, and no accounts means the whole thing is a folder of files anyone can read, run locally with one command, and host for free. The one clever part is that the test and the site share the exact same code path.

## The Core Journey Through the System

PRD ref: `prd.md > The Core Journey`.

1. **Arrive.** The browser loads `index.html`. Plain HTML and CSS, the self-hosted font, the trust line, sources, References, and the "Try an example" button. Nothing is fetched yet.
2. **Add a medicine.** She types "Lasix 40 mg" and presses Add. `rxnorm.js` strips dose and form words, leaving "Lasix", and calls RxNorm's exact name lookup. It gets back an RxCUI (RxNorm's ID number) and its term type. Because Lasix is a brand, the module asks RxNorm for the brand's ingredients and gets furosemide. The chip renders "Lasix → furosemide". If exact lookup fails, the module asks for an approximate match and the chip shows "Did you mean metoprolol (Toprol XL)?" with one tap to accept; nothing approximate is ever accepted silently. If there is no candidate, the chip offers spelling suggestions, and failing that reads "not recognized." The list is saved to the browser's localStorage, a sticky note the browser keeps for this site.
3. **Classify.** For each ingredient, `rxclass.js` asks RxClass for ATC classes, keeping only rows where the class member is the ingredient itself, not a combination product containing it. Furosemide comes back with C03CA (loop diuretics).
4. **Enter the ZIP.** She types 85001. `zip.js` loads `data/zip/850.json`, a slice of the Census ZCTA gazetteer, and finds Phoenix's coordinates. `heatrisk.js` calls the HeatRisk ImageServer's getSamples at that point and gets 7 samples, each with a date and a level 0 to 4. If the ZIP isn't in the file, the heat area says the ZIP wasn't found and the medicine check continues. If she skips the ZIP, the heat area says "Add a ZIP code to see this week's heat where you live."
5. **Build the plan.** `rules.js` takes the resolved medicines and the forecast and returns a plan object: cards for matching ingredients, one combination warning if a diuretic and an ACE inhibitor or ARB are both present, storage notes, a "Not listed in CDC heat guidance" list with UK and Canada badges, unrecognized names, a summary line, and each card's "this week" days at orange or higher. `plan-render.js` turns that into the page.
6. **Replay a heat wave.** The toggle swaps the forecast for `data/saved-heatwave.json`, Phoenix Aug 3 to 9, 2025, labeled with its source. The rules engine reruns with the same medicines; card text is unchanged, only the boxes, summary, and "this week" lines change.
7. **Print.** The Print button calls the browser's print. `print.css` hides controls and fits one Letter page.
8. **Evidence.** `evidence.html` loads `data/evidence.json`, written by the last test run, and renders the two zero numbers, agreement rates, the disagreement table, the answer-key mapping table, and the limitation note.

## Stack

Learner-selected, with accepted tradeoffs.

- **HTML, CSS, JavaScript ES modules, no bundler.** Files are served as written. Tradeoff accepted: no framework conveniences; the pages share code through plain module imports. Modules need an HTTP server even locally, since browsers block module imports from `file://`.
- **Node 20 or newer for scripts and tests, using the built-in `node:test` and global `fetch`.** Docs: https://nodejs.org/api/test.html. Reason, in the learner's words: "the browser and the test import the same rules module, so the numbers describe the exact code the site runs."
- **No runtime dependencies for the site.** The only npm packages are dev-time, for one-time scripts: `geotiff` (MIT) to sample the archived HeatRisk rasters. Docs: https://geotiffjs.github.io/. Verified by the learner: the archive GeoTIFFs are Web Mercator and sampling them in Mercator coordinates works.
- **Font: Atkinson Hyperlegible Next**, self-hosted from the Google Fonts GitHub repository under SIL OFL 1.1, with the system font stack as fallback. Source: https://github.com/google/fonts/tree/main/ofl/atkinsonhyperlegiblenext. Not the Braille Institute download, which has its own license.
- **Hosting: GitHub Pages** from the repository root on the main branch, with a `.nojekyll` file so folders and files starting with underscores aren't skipped. Docs: https://docs.github.com/en/pages.

## Where It Runs and How Someone Tries It

- **Runtime:** any modern browser. No API keys. No environment variables.
- **Local run:** from the repo root, `npx serve .` or `python -m http.server 8000`, then open `http://localhost:8000/`. Any static server works; the requirement is HTTP, not `file://`.
- **Tests:** `node --test` runs the unit tests in `test/`. `node scripts/run-evidence.mjs` runs the 300-medicine proof against live RxNorm and RxClass and writes `data/evidence.json`. It takes a few minutes because of the 20 requests per second limit and caching.
- **Demo recording:** open the landing page, press "Try an example," show the chips resolving, the heat wave replay label, the furosemide card, the combination warning, the "Not listed" section with badges, press Print to show the one-page preview, then open the Evidence page. Under two minutes.
- **Deployment (chosen, optional for the hackathon):** GitHub Pages. Settings, Pages, source: main branch, root. The public URL becomes `https://<user>.github.io/<repo>/`. `6-ship` records the final URL.
- **Public repository:** https://github.com/usv240/heat-meds (public, MIT license detected by GitHub, created 2026-09-30).
- **Live site:** https://usv240.github.io/heat-meds/ (GitHub Pages from `main`, root). Verified without login; RxNorm, RxClass, HeatRisk, and the NWS points API all allow requests from this origin. Re-check any time with `BASE_URL=https://usv240.github.io/heat-meds/ node scripts/check-pages.mjs`.
- **Demo video:** not recorded yet. Hackathon rules: under 3 minutes, public on YouTube or Vimeo, no third-party trademarks or copyrighted music. To keep trademarks out, "Try an example" uses generic names only (furosemide, lisinopril, sertraline, insulin glargine, atorvastatin) and the entry placeholder reads "furosemide"; typing a brand name still works. The video types "furosamide", "metoprolol succinate 25 mg tablet", and "lisinopril-hydrochlorothiazide", each checked live by `scripts/check-pages.mjs`.
- **Submission:** a public GitHub repository and a short demo video are required. The Pages URL is in addition, so judges and real people can try it without installing anything.

## Look and Feel

Carried from `prd.md > Look and Feel` and `scope.md > Inspiration & Identity`.

- **Typography:** Atkinson Hyperlegible Next, base size 20 px, line height 1.55, generous paragraph spacing. Headings only modestly larger; the page should read like a well-set leaflet, not a marketing site.
- **Color:** a warm off-white light theme and a soft dark theme, chosen by `prefers-color-scheme` with a visible toggle. One accent for buttons. Heat boxes use the official HeatRisk palette for levels 0 to 4 (green, yellow, orange, red, magenta), taken from the WPC legend, each with its word: Little to None, Minor, Moderate, Major, Extreme. Verify the exact hex values from the WPC page during the build; never color alone.
- **Density and energy:** spacious and calm. One column on phones, a comfortable single column with wide margins on desktop. Big touch targets. Chips large enough to read at arm's length.
- **Copy tone:** plain, honest, never alarming. No emojis. No em dashes. Short sentences. The bold closing line and the trust line are fixed strings from the PRD.
- **Print:** Letter page, 0.5 inch margins, black text on white, heat boxes keep both color and word, controls hidden, one page for the Phoenix example.

- **Shared header and home layout (design polish, before the demo video):** every page uses one header (Heat Meds, Check my medicines, Evidence, theme toggle). The home page is wider (68rem) with a live example preview beside the headline at 900 px and wider, built by `src/home-preview.js` from the plan page's own renderers, and a three-step How it works strip. Heat weeks size by their container, not the screen. `assets/social-preview.png` (1200 x 630) is the Open Graph, Twitter, and GitHub preview, made by `scripts/make-social-image.mjs`.

## Components

### Landing page (`index.html`)
Static content: what it does, who it's for, why it matters with sources, the "Try an example" button, the trust line, the Evidence link, and a References section listing every source with links (CDC, NWS HeatRisk, NLM RxNorm and RxClass with NLM's requested attribution statement, Census gazetteer, MEPS, UKHSA, Health Canada, ANSM). The medicine and ZIP entry lives on this page below the explanation, so the flow is one scroll: read, add medicines, add ZIP, press "See my plan," which goes to `plan.html`. "Try an example" writes the example list and ZIP to localStorage and opens `plan.html?example=1`.
PRD ref: `prd.md > Screens and Layout > Landing page`, `prd.md > Look and Feel`.

### Medicine entry and chips (`src/chips.js`)
A text input and Add button. On Add, calls `resolveMedicine` from `rxnorm.js`, renders a chip in one of five states: checking; resolved (name as typed → generic, or both ingredients for a combination); did-you-mean (one candidate, one tap to accept, otherwise dismissed); suggestions (a short list to pick from); not recognized. An approximate match is never accepted silently. Remove button on every chip. Persists only resolved chips through `storage.js`.
PRD ref: `prd.md > Features and Behavior > Adding medicines`.

### RxNorm client (`src/rxnorm.js`)
Exports `resolveMedicine(text)` returning `{ input, query, rxcui, name, tty, ingredients: [{ rxcui, name, base_name }], candidate, suggestions: [], status }` where `status` is one of `resolved`, `did_you_mean`, `suggestions`, `not_recognized`. Steps:
0. `normalizeName(text)`: lowercase, trim, drop dose and form words (numbers with mg, mcg, g, ml, units; tablet, tab, cap, capsule, er, xr, sr, xl when standalone, and similar) and stray punctuation, so "lasix 40 mg" becomes "lasix" and "Toprol-XL" becomes "toprol xl". The learner found exact search fails on "Toprol XL" and "lasix 40 mg" without this. Pure function, unit tested.
1. `GET /REST/rxcui.json?name={query}&search=2`. If an ID comes back, continue to step 3 with `status: resolved`.
2. If not, `GET /REST/approximateTerm.json?term={query}&maxEntries=3`. Scores are unreliable (the learner measured 5.8 for "hctz", 8.0 for "furosamide", 29.4 for "Toprol-XL"), so no threshold: the top candidate is resolved through steps 3 to 5 and returned as `status: did_you_mean` with `candidate: { label: "metoprolol (Toprol XL)" }`. The chip shows "Did you mean ...?" and only a tap accepts it. Never accepted silently.
3. `GET /REST/rxcui/{rxcui}/properties.json` for the name and term type (`tty`).
4. If `tty` is `IN` (ingredient) or `PIN` (precise ingredient such as metoprolol succinate), the ingredient list is the concept itself. For a `PIN`, also record `base_name`, the plain ingredient, because name-based rules match on the base ingredient. Do not follow related multi-ingredient products. This is the learner's rule: only split into ingredients when the input itself is a combination.
5. Otherwise (`BN`, `SBD`, `SCD`, `MIN`, `GPCK`, and so on), `GET /REST/rxcui/{rxcui}/related.json?tty=IN` and take every ingredient returned. One ingredient means a single-ingredient brand; two or more means a combination pill.
6. If step 2 returned no candidate, `GET /REST/spellingsuggestions.json?name={query}` and return `status: suggestions`, or `not_recognized` if empty.
Caches every response in memory for the session. If the network fails, consults `data/saved-lookups.json` (written by the evidence run) and marks the chip "saved lookup."
PRD ref: `prd.md > Features and Behavior > Adding medicines`.

### RxClass client (`src/rxclass.js`)
Exports `classesForIngredient(rxcui)` returning `{ atc: ["C03CA", ...] }`. Calls `GET /REST/rxclass/class/byRxcui.json?rxcui={rxcui}&relaSource=ATC`. Keeps only rows whose `minConcept.rxcui` equals the ingredient's own RxCUI; rows for combination products that contain the ingredient are dropped. This is the trap the learner found: furosemide alone came back with C03CB (a combination class) and metformin with A10BD. Verified by the learner: RxClass returns ATC level 4 codes (C03CA, C07AB, H03AA), so prefixes in the rules file are 3 to 5 characters. A precise ingredient (PIN, such as metoprolol succinate) gets ATC codes directly, but name-based rules match on the base ingredient (metoprolol), which `rxnorm.js` records as `base_name`.
PRD ref: `prd.md > Features and Behavior > The plan: medicine cards`.

### CDC rules file (`data/cdc-rules.json`)
The product content behind every card. Curated by the learner from the CDC clinician guidance page dated Sept 18, 2025: https://www.cdc.gov/heat-health/hcp/clinical-guidance/heat-and-medications-guidance-for-clinicians.html. Three arrays:

- `classes[]`: `{ id, plain_name, cdc_label, atc_prefixes: [], ingredients: [], exclude_ingredients: [], why, watch_for, ask_pharmacist, cdc_quote, cdc_url, checked_on }`. A medicine matches if any of its ATC codes starts with a listed prefix or its ingredient name is listed, and it isn't excluded.
- `combinations[]`: `{ id, requires: [class_id, class_id], text, cdc_quote, cdc_url, checked_on }`. The CDC one: a diuretic with an ACE inhibitor or ARB "may significantly increase risk of harm from heat exposure"; ARNIs carry the same additive risk.
- `storage[]`: `{ id, atc_prefixes: [], ingredients: [], text, cdc_quote, cdc_url, checked_on }`. Insulin refrigeration and heat loss of potency; inhalers can burst in hot cars; epinephrine autoinjectors can under-deliver; don't leave medicines in cars.

Seed list from the page, to be curated line by line by the learner against the CDC page; anything not on the page is dropped. Every class entry must carry a `cdc_quote`; the engine refuses to load an entry without one.

- Diuretics (C03, plus acetazolamide by name), beta blockers (C07), calcium channel blockers (C08), ACE inhibitors (C09A, C09B), ARBs (C09C, C09D), ARNI (sacubitril/valsartan by name), antiplatelets (B01AC), nitrates (C01DA), lithium (N05AN), antipsychotics (N05A minus lithium), SSRIs (N06AB), SNRIs (by name: venlafaxine, duloxetine, desvenlafaxine, levomilnacipran), tricyclics (N06AA), topiramate, oxcarbazepine, carbamazepine (by name), anticholinergic antihistamines (by name: diphenhydramine, doxylamine, promethazine; narrower reading), NSAIDs (M01A), aspirin (by name), sulfonamide antibiotics (J01E), stimulants (N06BA).
- **Confirm or drop:** acetaminophen, levothyroxine, indinavir. They appeared in a fetched summary of the page; the learner will check whether the CDC table actually lists them.
- **Confirm:** laxatives, opiates, benzodiazepines, apixaban, antacids, and sun-sensitizing drugs (flucytosine, griseofulvin, voriconazole, metronidazole, tetracyclines, fluoroquinolones). The page mentions these in its text on sedation, electrolyte disturbance, reduced clearance, and photosensitivity; the learner decides whether each becomes a card.
- Storage: insulins (A10A), inhalers (R03 inhaled), epinephrine autoinjector, "don't leave medicines in cars."

Narrower reading wherever the CDC phrase is ambiguous, with the reason in the entry.
PRD ref: `prd.md > Features and Behavior > The CDC rules file (as product content)`.

### Rules engine (`src/rules.js`)
Pure function, no network, imported by both the browser and the tests. `evaluate({ medicines, forecast, rules })` returns:

```
{
  summary: { level_max, red_or_worse_days: [], text },
  week: [{ date, level, word }],          // or null when no forecast
  cards: [{ ingredient, as_typed, class, why, watch_for, ask, this_week_days: [], source }],
  combinations: [{ text, source }],       // deduplicated by rule id
  storage: [{ ingredient, text, source }],
  not_listed: [{ ingredient, as_typed, badges: { ukhsa, health_canada } }],
  unrecognized: [as_typed, ...]
}
```

Rules: a class entry without a non-empty `cdc_quote` is invalid and `evaluate` throws when loading the rules, so a flag without a CDC quote cannot be produced; the evidence runner asserts this too. Deduplicate ingredients by RxCUI before matching, so a combination pill plus a separate water pill yields one card per ingredient and one combination warning. Name-based rules compare against `base_name` when present. A single combination pill whose ingredients hit both required classes triggers the combination on its own. Card text comes only from the rules file; the forecast affects only `this_week_days` (days at level 2 or higher) and `summary`. Summary text: if any day is level 3 or 4, "Tomorrow is a red heat day where you live. Go over this plan today." pattern with the actual day; otherwise a calm line. No forecast means `week: null`, no `this_week_days`, and a summary that says to add a ZIP. Badges come from `data/answer-keys/*.json`, loaded alongside rules, so the "Not listed" section can say what the UK and Canada say.
PRD ref: `prd.md > Features and Behavior > The plan: medicine cards`, `Combination warnings and storage notes`, `Medicines not listed in CDC heat guidance`, `The plan: summary and heat boxes`.

### ZIP lookup (`src/zip.js`, `data/zip/*.json`)
`lookupZip("85001")` fetches `data/zip/850.json` and returns `{ lat, lon, place, state }` or `null`. The files are built once by `scripts/build-zip-index.mjs` from the Census ZCTA Gazetteer (public domain), split by the first three digits so each lookup loads one small file. ZCTAs approximate ZIP codes; some post-office-box ZIPs are absent, which shows as "ZIP not found" while the medicine check continues.
PRD ref: `prd.md > Features and Behavior > Entering the ZIP and getting the forecast`.

### HeatRisk client (`src/heatrisk.js`)
`forecastFor(lat, lon)` calls the ArcGIS ImageServer getSamples operation, verified by the learner on Sept 29, 2026:

```
GET https://mapservices.weather.noaa.gov/experimental/rest/services/NWS_HeatRisk/ImageServer/getSamples
  ?geometry={"x":<lon>,"y":<lat>,"spatialReference":{"wkid":4326}}
  &geometryType=esriGeometryPoint
  &returnFirstValueOnly=false
  &outFields=name,idp_validtime
  &f=json
```

The response holds one sample per day layer (`HeatRisk_1_Mercator` to `HeatRisk_7_Mercator`), each with `attributes.idp_validtime` as epoch milliseconds and a `value` that arrives as a string ("1"), parsed to an integer 0 to 4. Verified by the learner. The module sorts by valid time and returns `[{ date, level, word }]`. Empty samples or NoData at the point means outside the forecast area. Any network or non-JSON failure returns `{ fallback: true, forecast: savedHeatWave }`, labeled "saved data." CORS was confirmed working by the learner; the service is labeled experimental, so **verifying this call is build step one**.
PRD ref: `prd.md > Features and Behavior > Entering the ZIP and getting the forecast`.

### Saved heat wave (`data/saved-heatwave.json`)
Phoenix, Aug 3 to 9, 2025, read from the WPC archive's Day-1 GeoTIFFs, one per day, at Phoenix's coordinates: orange, orange, orange, magenta, magenta, red, orange. Written once by `scripts/sample-heatwave.mjs` and committed with the seven source URLs. The archive GeoTIFFs are Web Mercator (pixel size 2539.703 m, origin -14326021.825, 6722143.668, NoData 5); the script converts the coordinates to Mercator and reads the pixel directly. Verified by the learner. Labeled on the page as "HeatRisk as forecast each day, Phoenix, Aug 3 to 9, 2025." Used by the replay toggle, by "Try an example," and as the outage fallback.
PRD ref: `prd.md > Features and Behavior > Past heat wave replay`.

### Plan page (`plan.html`, `src/plan-render.js`)
Reads the list and ZIP from localStorage (or loads the example when `?example=1`), runs resolution and classification if anything is missing, fetches the forecast, calls `evaluate`, and renders: summary, heat boxes, replay toggle, cards, combination warning, storage notes, "Not listed in CDC heat guidance" with badges, "Call 911 if," the bold closing line, sources, Print button. Every term and number gets an "i" from `info.js`. With `?example=1` the replay toggle starts on and its label is visible at the top of the heat area.
PRD ref: `prd.md > Screens and Layout > Results page`, `prd.md > Features and Behavior > Printing`.

### Info buttons (`src/info.js`, `data/glossary.json`)
A small button that opens an inline popover with three parts: what it is, why it matters, source link. Entries: HeatRisk and each level, each CDC class in the rules file, "Not listed in CDC heat guidance," the UKHSA and Health Canada badges, the ANSM note (context only, not scored), each Evidence number, the answer keys. Popovers are plain HTML, keyboard reachable, hidden in print.
PRD ref: `prd.md > Features and Behavior > Info buttons`.

### Local storage (`src/storage.js`)
Keys `heatmeds.list` (the resolved chips) and `heatmeds.zip`. Written on every change, read on page load. Nothing else is stored anywhere. Clearing the browser's site data clears it.
PRD ref: `prd.md > States and Boundaries > Persistence`.

### Print stylesheet (`assets/print.css`)
`@page { size: Letter; margin: 0.5in }`. Hides buttons, toggle, popovers, navigation. Forces the heat boxes to print their background colors alongside their words. Card spacing tightened so the Phoenix example fits one page.
PRD ref: `prd.md > Features and Behavior > Printing`.

### Evidence page (`evidence.html`, `src/evidence.js`, `data/evidence.json`)
Renders, in order: the two must-be-zero numbers (flags without a CDC quote; stop instructions); the count of app flags among top-300 medicines that neither UKHSA nor Health Canada lists, each shown with its CDC quote; agreement with UKHSA and with Health Canada; the disagreement table (medicine, direction, one-line reason); the answer-key mapping table so anyone can disagree with it; the ANSM note as context; the limitation sentence "This measures agreement with national guidance, not clinical outcomes."; the source of the top-300 list and the date of the run. All values come from the JSON.
PRD ref: `prd.md > Features and Behavior > The Evidence page and the 300-medicine test`.

### Top-300 derivation (`scripts/derive-top300.mjs`, `data/top300.json`)
From AHRQ MEPS HC-254A, the 2024 Prescribed Medicines file (public domain). Group fills by drug name, sum the person weight, normalize names to RxNorm ingredients (crediting a combination product's fills to each ingredient), rank by ingredient, keep 300. The output records the method and a sanity note comparing the top 20 with published rankings, for comparison only, not republished. Unverified: the MEPS download format (ASCII with SAS/Stata programs versus a CSV); check first and adapt the reader.
PRD ref: `prd.md > Features and Behavior > The Evidence page and the 300-medicine test`.

### Answer keys (`data/answer-keys/ukhsa.json`, `health-canada.json`, `ansm.json`)
Each maps a guidance phrase to ATC prefixes or ingredient names with a one-line reason. Committed before the evidence run so the history shows they weren't tuned afterwards. Ambiguous phrases take the narrower reading, noted in the entry. UKHSA (Open Government Licence) and Health Canada (2024 guidance for pharmacists) are scored. ANSM is context only in the "i" panel and never scored, because its list is much broader.
PRD ref: `prd.md > Features and Behavior > The Evidence page and the 300-medicine test`.

### Evidence runner (`scripts/run-evidence.mjs`)
For each of the 300: resolve with RxNorm, classify with RxClass, evaluate with the rules, render the plan to plain text. Throttled to 4 concurrent requests, well under 20 per second, with every response cached to `data/cache/` and a compact `data/saved-lookups.json` for the site's fallback. Computes:
- flags without a CDC quote: must be 0, enforced in code (the engine throws on a quoteless entry; the runner asserts every emitted card carries its quote). This replaces the earlier "false alarms" number, which the learner found partly circular because "listed by CDC" came from the app's own rules file;
- flags outside the UK and Canada lists: of the top-300 medicines that neither UKHSA nor Health Canada lists, how many the app flags, each recorded with its CDC quote for the Evidence page. Reported, not zero-targeted;
- stop instructions: any plan text matching a "stop, skip, quit, discontinue, change your dose, take less, take more" pattern, checked against every line; must be zero;
- agreement with each answer key, and the disagreement table in both directions with the reason from the mapping entry.
Writes `data/evidence.json` with a timestamp and the rules file version.

### Unit tests (`test/`)
`node:test` files importing `src/rules.js` directly with fixtures:
- Phoenix example: furosemide, lisinopril, sertraline, insulin, atorvastatin produce the furosemide card, one combination warning, one storage note, atorvastatin under "Not listed."
- lisinopril + hydrochlorothiazide as one combination pill triggers the combination warning alone.
- hydrochlorothiazide + furosemide + lisinopril-HCTZ still produces one warning.
- The same medicine in a green week and a red week yields identical card text except `this_week_days`.
- No forecast yields `week: null` and no "this week" days.
- No plan text ever matches the stop-instruction pattern.
- A rules file entry missing `cdc_quote` makes `evaluate` throw.
- `normalizeName`: "lasix 40 mg" → "lasix", "Toprol-XL" → "toprol xl", "metoprolol succinate ER 50mg" → "metoprolol succinate".
- A `did_you_mean` result is never stored as resolved without an explicit accept.
- Site copy check: every HTML file and `data/*.json` string contains no em dash (U+2014) and no emoji.
- Copy check: the trust line and the closing line match the PRD strings exactly.

## Data Model

No database. Data lives in four places.

- **In the browser session:** resolved medicines `{ input, rxcui, name, tty, ingredients[], status }`, the forecast `[{ date, level, word }]`, and the plan object from `evaluate`. Rebuilt on each page load.
- **In localStorage:** the medicine list and the ZIP. Updated on every change; survives closing the browser; cleared by the user's browser settings.
- **In committed data files:** `cdc-rules.json` (curated), `glossary.json` (curated), `answer-keys/*.json` (curated, committed before the run), `zip/*.json` (generated once), `saved-heatwave.json` (generated once), `top300.json` (generated once), `saved-lookups.json` and `evidence.json` (generated by every evidence run).
- **In external services, never stored by us:** medicine names go to RxNorm and RxClass; coordinates go to the HeatRisk service.

## File Structure

```
heat-meds-app/
├── index.html                 # Landing: explanation, sources, entry form, Try an example, trust line, References
├── plan.html                  # The plan page
├── evidence.html              # The Evidence page
├── .nojekyll                  # Let GitHub Pages serve every file as-is
├── assets/
│   ├── site.css               # Light and dark themes, typography, layout
│   ├── print.css              # One-page Letter print layout
│   └── fonts/                 # Atkinson Hyperlegible Next woff2 files + OFL.txt
├── src/
│   ├── chips.js               # Medicine entry and chip states
│   ├── rxnorm.js              # Name → RxCUI → ingredients, spelling suggestions
│   ├── rxclass.js             # Ingredient RxCUI → ATC classes (filtered to the ingredient itself)
│   ├── rules.js               # The rules engine, shared by the site and the tests
│   ├── zip.js                 # ZIP → coordinates from bundled gazetteer slices
│   ├── heatrisk.js            # getSamples call, fallback to saved heat wave
│   ├── plan-render.js         # Plan object → DOM
│   ├── info.js                # "i" popovers from the glossary
│   ├── storage.js             # localStorage read/write
│   └── evidence.js            # evidence.json → Evidence page
├── data/
│   ├── cdc-rules.json         # Curated CDC classes, combinations, storage; quotes, links, dates
│   ├── glossary.json          # Text for every "i" button
│   ├── answer-keys/
│   │   ├── ukhsa.json         # Phrase → ATC/ingredients, reason (scored)
│   │   ├── health-canada.json # Same (scored)
│   │   └── ansm.json          # Context only, never scored
│   ├── zip/                   # 850.json etc., generated from the Census gazetteer
│   ├── saved-heatwave.json    # Phoenix Aug 3-9 2025 with source URLs
│   ├── top300.json            # Derived from MEPS HC-254A with method notes
│   ├── saved-lookups.json     # RxNorm/RxClass results for the 300, site fallback
│   ├── evidence.json          # Written by the evidence run; read by evidence.html
│   └── cache/                 # Raw API responses from the evidence run (gitignored)
├── scripts/
│   ├── build-zip-index.mjs    # Gazetteer → data/zip/*.json
│   ├── sample-heatwave.mjs    # Archive GeoTIFFs → saved-heatwave.json (uses geotiff)
│   ├── derive-top300.mjs      # MEPS → top300.json
│   └── run-evidence.mjs       # The 300-medicine proof → evidence.json, saved-lookups.json
├── test/
│   ├── rules.test.mjs         # Engine fixtures: Phoenix example, combos, dedupe, forecast independence
│   ├── copy.test.mjs          # No em dashes, no emojis, exact trust and closing lines
│   └── fixtures/              # Resolved-medicine and forecast fixtures
├── devpost/                   # Devpost learning workspace
├── package.json               # "test": "node --test"; devDependency: geotiff
├── LICENSE                    # MIT
├── .gitignore
└── README.md                  # How to run, test, regenerate evidence, and deploy
```

## External Services and Dependencies

### NLM RxNorm API
- Base: `https://rxnav.nlm.nih.gov/REST/`. Docs: https://lhncbc.nlm.nih.gov/RxNav/APIs/RxNormAPIs.html
- Calls used: `rxcui.json?name=&search=2`, `approximateTerm.json?term=&maxEntries=3`, `rxcui/{id}/properties.json`, `rxcui/{id}/related.json?tty=IN`, `spellingsuggestions.json?name=`.
- No key. Free. Limit: 20 requests per second per IP (terms: https://lhncbc.nlm.nih.gov/RxNav/TermsofService.html). NLM asks apps to include their attribution statement beginning "This product uses publicly available data from the U.S. National Library of Medicine (NLM), National Institutes of Health" and not to use the NLM name or logo as endorsement. Goes in References.
- CORS: confirmed working from the browser by the learner during testing.

### NLM RxClass API
- Base: `https://rxnav.nlm.nih.gov/REST/rxclass/`. Docs: https://lhncbc.nlm.nih.gov/RxNav/APIs/RxClassAPIs.html
- Call used: `class/byRxcui.json?rxcui=&relaSource=ATC`. Filter to `minConcept.rxcui === ingredient`.
- Same terms and limit as RxNorm.

### NWS HeatRisk ImageServer (experimental)
- `https://mapservices.weather.noaa.gov/experimental/rest/services/NWS_HeatRisk/ImageServer/getSamples` as above. Product page: https://www.wpc.ncep.noaa.gov/heatrisk/. Data page: https://www.wpc.ncep.noaa.gov/heatrisk/data.html. Archive of Day-1 GeoTIFFs from Aug 1, 2024: https://www.wpc.ncep.noaa.gov/heatrisk/data/archive/
- No key. No stated limit. Labeled experimental. Coverage: the contiguous US; Alaska is a separate product and Hawaii isn't mentioned, so those ZIPs will read as outside the forecast area unless verified otherwise.

### Census ZCTA Gazetteer
- Public domain. https://www.census.gov/geographies/reference-files/time-series/geo/gazetteer-files.html. Used once by a script; not called at runtime.

### AHRQ MEPS HC-254A (2024 Prescribed Medicines)
- Public domain. https://meps.ahrq.gov/mepsweb/data_stats/download_data_files.jsp. Used once by a script.

### UKHSA and Health Canada guidance, ANSM
- UKHSA heat and medicines guidance, Open Government Licence. Health Canada 2024 guidance for pharmacists. ANSM list (France), context only. Exact URLs recorded in `data/answer-keys/*.json` and the References section when the learner curates them.

### Fonts
- Atkinson Hyperlegible Next, SIL OFL 1.1, from https://github.com/google/fonts/tree/main/ofl/atkinsonhyperlegiblenext. Include `OFL.txt` alongside the woff2 files.

### GitHub Pages
- Free. Root of main. Docs: https://docs.github.com/en/pages.

## Important Failure Modes

- **HeatRisk getSamples fails, returns non-JSON, or the experimental service moves** → heat boxes show the saved Phoenix heat wave labeled "saved data" with date and place; medicine check unaffected. Verified as build step one, and the fallback is exercised by a test with fetch stubbed to fail.
- **RxNorm is slow or down** → the chip shows "couldn't check right now, try again"; for the example list and any medicine among the 300, `saved-lookups.json` is used and the chip is marked "saved lookup."
- **ZIP not in the gazetteer or outside the contiguous US** → "ZIP not found" or "forecast not available for this ZIP" in the heat area; cards still render.
- **Evidence run hits the rate limit** → the runner throttles to 4 concurrent requests and retries once after a pause; every response is cached so reruns are cheap.

## What Was Simplified and Why

- **Three static pages, no bundler, no framework** instead of a component framework: a folder of readable files is enough for three screens, and it removes setup and deployment steps. The fuller version would add a build step and a dependency tree.
- **Bundled ZIP centroid slices** instead of a geocoding service: no third external dependency, no rate limit, works offline for the lookup. The cost is a few hundred kilobytes of generated files.
- **One saved heat wave** instead of a general archive browser: one labeled real week proves the replay and doubles as the outage fallback.
- **Committed `evidence.json`** instead of a CI pipeline: the numbers still come only from the run; a GitHub Action can regenerate it later.
- **ANSM shown, not scored**: its much broader list would dominate the agreement numbers without adding to the proof; it's context in the "i" panel.
- **Single-ingredient inputs never expand to combination products**: following RxNorm's related multi-ingredient concepts would create false alarms; only combination inputs are split.
- **In-memory session cache for RxNorm** instead of a persistent one: the list is short; the evidence run has its own disk cache.

## Decisions and Open Issues

### Learner decisions
- **Plain HTML/CSS/JS ES modules, Node `node:test` for the harness.** Reason: the site and the test import the same rules module. Tradeoff: no framework conveniences.
- **HeatRisk via the ImageServer getSamples call from the browser**, verified on Sept 29, 2026, with the saved-data fallback. Verification is build step one because the service is experimental.
- **Past heat wave: Phoenix, Aug 3 to 9, 2025**, sampled once from the archive Day-1 GeoTIFFs and committed with source URLs.
- **ZIP to coordinates from a bundled Census ZCTA gazetteer**, split by the first three digits. No third external service.
- **Top-300 derived from MEPS HC-254A**, not ClinCalc, because ClinCalc's site terms forbid redistribution. Counted by ingredient, crediting combination fills to each ingredient.
- **Answer keys: UKHSA and Health Canada scored; ANSM context only.** False alarms are medicines flagged by the app and listed by none of CDC, UKHSA, or Health Canada.
- **Product wording change:** "Not listed in CDC heat guidance" replaces "no known heat concern," with badges showing what the UK and Canada say. Recorded in `prd.md` as well.
- **RxClass filter:** keep only class rows whose member is the ingredient itself. **RxNorm rule:** only split ingredients when the input is itself a combination.
- **Font: Atkinson Hyperlegible Next** from the Google Fonts repo (OFL), self-hosted, system stack fallback, 20 px base. Not the Braille Institute download.
- **Commit the generated evidence file;** GitHub Action later.
- **Name lookup never guesses silently.** Dose and form words are stripped before lookup; any approximate match becomes a one-tap "Did you mean ...?" chip. Reason: exact search failed on "Toprol XL" and "lasix 40 mg", and approximate scores proved unreliable in testing.
- **"Flags without a CDC quote" replaces "false alarms."** The old check was partly circular because "listed by CDC" came from the app's own rules file. The new must-be-zero number is enforced in code, and flags among medicines neither UKHSA nor Health Canada lists are reported with their CDC quotes. `prd.md` updated to match.
- **CDC seed list is curated line by line** from the CDC page; acetaminophen, levothyroxine, and indinavir are "confirm or drop"; laxatives, opiates, benzodiazepines, apixaban, antacids, and sun-sensitizing drugs are "confirm."
- **MIT license** file in the repo.
- **No em dashes** in site text, the devpost docs, or the README.

### Implementation details derived from those decisions
- Three HTML files sharing modules; localStorage carries the list between pages; `?example=1` loads the example with the replay on.
- Rules file supports ATC prefixes (RxClass returns level 4) and ingredient names matched on the base ingredient.
- `normalizeName` is a pure function in `rxnorm.js` so it can be unit tested without the network.
- Evidence runner throttles to 4 concurrent requests and caches to disk.

### The useful unknown
**Mapping UKHSA's broad phrases to ATC codes decides the agreement numbers, and could be tuned to flatter the app.** The learner's check: write both answer-key mappings with a one-line reason per phrase and commit them before the evidence run, so history shows they weren't adjusted afterwards; take the narrower reading of any ambiguous phrase and note it; show the mapping table on the Evidence page so anyone can disagree. Evidence during the build: the commit of `data/answer-keys/*.json` precedes the first commit of `data/evidence.json`.

A second, smaller one: **MEPS name normalization.** Counting by ingredient with combination fills credited to each ingredient; sanity check by comparing the top 20 with published rankings, for comparison only. Evidence: a note in `data/top300.json` recording the comparison.

### Open issues
- **Build step one:** a live smoke check of getSamples from the browser at the Phoenix point, since the service is experimental. The response shape is already known (string `value`, epoch-ms `idp_validtime`), so this is confirmation, not discovery.
- **MEPS file format** for HC-254A; adapt the reader in `derive-top300.mjs`.
- **Exact HeatRisk hex colors** from the WPC legend, and NoData behavior at points outside the contiguous US (the archive rasters use NoData 5; confirm the live service does too).
- **Exact UKHSA and Health Canada URLs and license text** for References, recorded when the learner curates the keys.

Resolved by the learner's tests before approval: RxClass returns ATC level 4; getSamples returns string values and epoch-ms times; the archive GeoTIFFs are Web Mercator and sample correctly in Mercator coordinates; PIN concepts get ATC directly but name rules use the base ingredient.
- Carried from `prd.md > Open Questions`: the CDC classes, quotes, and storage items are curated first in the build, per the agreed order.
