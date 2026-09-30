---
doc: prd
status: approved
---

# Heat Meds: Product Requirements

One line: a free, no-account web page where an older adult or a family member types in medicines and a ZIP code and gets one printable heat-and-medicine plan to go over with a pharmacist. It never tells anyone to stop a medicine.
Source: `scope.md > The Unique Kernel`, `scope.md > The Core Loop`.

## The Core Journey

Source: `scope.md > The Core Loop`, `scope.md > What "Working" Looks Like`.

1. **Arrive.** The daughter opens the site on her phone or laptop. The landing page explains in under a minute what it does, who it's for, and why it matters, with sources. She sees a big "Try an example" button, a trust line, and a References section at the bottom.
2. **Add medicines.** She types each name from mom's bottles, brand or generic. Each becomes a chip that resolves to the generic name: "Lasix → furosemide (water pill)". A combination pill is one chip showing both ingredients. A name that can't be recognized is marked "not recognized" with spelling suggestions.
3. **Enter the ZIP (optional).** She types mom's Phoenix ZIP. If she skips it, the medicine cards still appear and the page says "Add a ZIP code to see this week's heat where you live."
4. **See the plan.** The results page shows the next 7 days of heat risk as colored boxes, each with a word as well as a color, a one-line summary at the top, one card per medicine that matters, the combination warning if it applies, storage notes, the honest list of medicines not listed in CDC heat guidance, warning signs for when to call 911, and the bold closing line with sources.
5. **Optionally replay a heat wave.** In a calm week she can flip "See your list on a real past heat wave" to see what the same plan looks like on a bad day, labeled with the real date and place.
6. **Print.** She presses Print and gets one page for the fridge or the pharmacist.
7. **Check the evidence (anyone, any time).** From the landing page or any "i" next to the answer keys, she can open the Evidence page and see how the app performed on the 300 most-prescribed US medicines against two independent national lists.

Success: the Phoenix example, entered from bottle names, produces one printed page with the furosemide card, the water pill plus blood pressure pill combination warning, the insulin storage note, atorvastatin under "not listed in CDC heat guidance," and the never-stop line. The Evidence page shows zero flags without a CDC quote and zero stop instructions.

## Screens and Layout

Three pages plus a print view. No accounts, no navigation beyond these.

### Landing page
Explains itself in 60 seconds: what it does, who it's for, why it matters, with sources. A big "Try an example" button. The trust line, exactly: "Free. No account. We don't store anything. To check your list, medicine names are looked up in the National Library of Medicine's RxNorm and your ZIP goes to the National Weather Service." A link to the Evidence page. A References section at the bottom listing every source with links. The medicine and ZIP entry is either on this page or one step in; the learner described the flow as landing, then add medicines, then ZIP, then results.

### Results page
Top to bottom: summary line, 7-day heat boxes, the "See your list on a real past heat wave" toggle, one card per medicine that matters, combination warning, storage notes, "Not listed in CDC heat guidance" list, "Call 911 if" warning signs, bold closing line, sources. A Print button. Every term and number has a small "i" button.

### Evidence page
The 300-medicine test results, in a fixed order: the two zero numbers first, then agreement with UKHSA and Health Canada, then the full disagreement table with reasons, then the plain-language limitation note.

### Print view
The results page laid out to fit one page. Info buttons, toggles, and navigation are hidden.

## Look and Feel

Source: `scope.md > Inspiration & Identity`, plus this interview.

- Calm. Large, readable text for older eyes. Light and dark mode. Works on phone and desktop.
- Someone who has never heard of this should understand what it does on their first visit.
- Heat colors match the official NWS HeatRisk colors, always paired with a word. Never color alone.
- Honest, not alarming. Medicine wording never gets scarier because of the forecast.
- A References section at the bottom of the landing page lists every source with links.
- Site text uses no emojis and no em dashes.
- No specific typography, brand, or app references were given. Avoid generic AI-app styling; keep it plain, spacious, and legible.

## Features and Behavior

### Adding medicines
Source: `scope.md > The POC Boundary` (RxNorm name recognition).

The user types a medicine name, brand or generic, and adds it. Each medicine becomes a chip.

- [ ] Typing "Lasix" and adding it shows a chip with the brand as typed and the generic it resolved to: "Lasix → furosemide (water pill)."
- [ ] Typing a generic like "atorvastatin" shows a chip with that generic.
- [ ] Dose and form words are ignored: "lasix 40 mg" resolves the same as "Lasix."
- [ ] When only an approximate match exists (for example "Toprol XL" or "hctz"), the chip shows "Did you mean metoprolol (Toprol XL)?" and waits for one tap. An approximate match is never accepted silently.
- [ ] A misspelling like "furosemid" shows spelling suggestions; choosing one adds the resolved chip.
- [ ] Text that can't be recognized (for example "xyzabc") shows a chip marked "not recognized." It is excluded from the plan and the app never guesses.
- [ ] A combination product such as "lisinopril-hydrochlorothiazide" becomes one chip showing both ingredients: "lisinopril + hydrochlorothiazide (a water pill)." One bottle, one chip, because that's what the person holds.
- [ ] Chips can be removed.

### Entering the ZIP and getting the forecast
Source: `scope.md > The POC Boundary` (NWS HeatRisk).

The ZIP is optional. Some people won't want to share a location, and people outside the US can still learn from the medicine check.

- [ ] With at least one recognized medicine and no ZIP, the plan shows the medicine cards, and in place of the heat boxes says "Add a ZIP code to see this week's heat where you live." Cards' "this week" lines are omitted.
- [ ] A valid US ZIP fetches the next 7 days of NWS HeatRisk for that place.
- [ ] Each day shows the official HeatRisk color and its word (for example "Orange: Moderate"). Never color alone.
- [ ] If the ZIP is outside the forecast area, the heat boxes are replaced by a short note saying the forecast isn't available there, and the medicine check still runs.
- [ ] If the forecast service is down, the heat boxes show saved data from a real past heat wave, clearly labeled with "saved data," the real date, and the place. The medicine check still runs.

### The plan: summary and heat boxes
Source: `scope.md > What "Working" Looks Like`.

- [ ] The top of the plan shows the date and the place.
- [ ] Seven heat boxes follow, one per day, color plus word.
- [ ] If any day in the next 7 is red or magenta, the summary line says so plainly, in the spirit of "Tomorrow is a red heat day where you live. Go over this plan today." It never adds medicine or dose advice.
- [ ] If no day is orange or higher, the summary is calm and still invites the user to review the plan before summer.

### The plan: medicine cards
Source: `scope.md > The POC Boundary` (CDC rules file), `scope.md > What "Working" Looks Like`.

One card for each medicine whose drug class the CDC calls out.

- [ ] Each card shows: the name as typed and the generic, the CDC drug class in plain words (for example "water pill"), why it matters in heat in plain language, what to watch for, and one question to ask the pharmacist.
- [ ] Each card has a "this week" line naming the days in the next 7 that are orange or higher, for example "Matters most on Tue, Wed." This uses the CDC's own threshold: plan for orange, red, and magenta days.
- [ ] The card's explanation text is identical whatever the forecast. Only the "this week" line changes. Checkable by viewing the same medicine in a green week and a red week.
- [ ] A combination pill's card explains both ingredients.
- [ ] Furosemide's card reads, in substance: can make you less thirsty and dehydrated faster in heat; watch for dizziness, very dark urine, confusion; ask your pharmacist whether to change how much water you drink on hot days.
- [ ] Every card's "i" button shows the exact CDC quote, a link to the CDC page, and the date the learner checked it.

### Combination warnings and storage notes
Source: `scope.md > What "Working" Looks Like`.

- [ ] When a water pill and a blood pressure medicine are both present, the plan shows the CDC combination warning.
- [ ] A single combination pill containing both (for example lisinopril + hydrochlorothiazide) triggers the warning on its own.
- [ ] If the same ingredient appears twice (a combination pill plus a separate water pill), the warning appears once, not twice.
- [ ] Insulin produces a storage note: "Don't leave your insulin in a hot car." Other CDC storage guidance appears the same way for the medicines it covers.

### Medicines not listed in CDC heat guidance
Source: `scope.md > The Unique Kernel` ("honest and not just scary").

- [ ] Every recognized medicine that matches no CDC class is listed under "Not listed in CDC heat guidance," for example atorvastatin.
- [ ] Each entry carries two badges showing what the UK (UKHSA) and Canada (Health Canada) say about it: listed or not listed.
- [ ] The "i" next to this heading explains that "not listed" means the CDC guidance doesn't list this class, not that heat is harmless, and notes that France's ANSM list is broader and is shown for context only, never scored.

### Warning signs and closing line

- [ ] The plan includes a short "Call 911 if" section with warning signs of heat illness in plain words, sourced.
- [ ] The plan ends with, in bold: "Never stop or change a medicine on your own. Talk to your pharmacist or doctor."
- [ ] Sources are listed below it: CDC (with date checked), NWS HeatRisk, NLM RxNorm.

### Past heat wave replay

- [ ] The results page has a toggle: "See your list on a real past heat wave."
- [ ] When on, the heat boxes, summary line, and each card's "this week" line switch to a real past heat wave, labeled with its real date and place. Medicine explanations don't change.
- [ ] Available to everyone, not only the example, so someone in a calm October week can see what the plan looks like on a bad day.

### Info buttons

- [ ] Every term and number has a small "i" button: HeatRisk, each drug class, "not listed in CDC heat guidance," the two Evidence numbers, and the answer keys.
- [ ] Each opens a short note with three parts: what it is, why it matters, and the source with a link.

### Printing

- [ ] A Print button on the results page produces the plan on one page.
- [ ] The printed page contains the summary, heat boxes with words, medicine cards, combination warning, storage notes, "not listed" list, 911 signs, the bold closing line, and sources. Info buttons, the replay toggle, and navigation are hidden.

### The Evidence page and the 300-medicine test
Source: `scope.md > What "Working" Looks Like` (Proof it works on real data).

The app is run on the 300 most-prescribed US medicines. What it flags is compared with the UKHSA and Health Canada heat-and-medication lists as independent answer keys.

- [ ] The Evidence page is linked from the landing page and from the "i" next to the answer keys.
- [ ] It shows, in this order: the two zero numbers; how often the app agrees with UKHSA and with Health Canada; the disagreement table; the limitation note.
- [ ] Number one: flags without a CDC quote. Must be zero, enforced in code. (Decided in `4-spec`, replacing "false alarms": "listed by CDC" came from the app's own rules file, so that check was partly circular.)
- [ ] Also shown: of the top-300 medicines that neither UKHSA nor Health Canada lists, how many the app flags, each with its CDC quote.
- [ ] Number two: plans that tell someone to stop, skip, or change a medicine. Must be zero. Checked by scanning every line of every generated plan.
- [ ] The disagreement table lists every mismatch drug by drug in both directions: medicines UKHSA or Health Canada flag that the app doesn't, and medicines the app flags that they don't. Each row has a one-line reason (for example "CDC's list is broader than the UK's on aspirin"). Failures are shown, not hidden.
- [ ] The page carries the plain note: "This measures agreement with national guidance, not clinical outcomes."
- [ ] Every number on the page comes straight from the test run. Nothing is typed by hand, so the page can't drift from the results. Checkable by changing one rule, re-running, and seeing the page change.
- [ ] The source of the top-300 list is cited on the page.

### The CDC rules file (as product content)
Source: `scope.md > The POC Boundary`.

Not a screen, but the content behind every card. Described here so the build knows what each entry must contain.

- [ ] One entry per drug class the CDC calls out, with: the class in plain words, the standard class codes it maps to, why it matters in heat, what to watch for, one pharmacist question, the exact CDC quote, the link, and the date checked.
- [ ] Combination rules (which class pairs trigger a warning) and storage rules, each with quote, link, and date.
- [ ] The file is small, versioned, and readable, so anyone can check it against the CDC page.

## States and Boundaries

- **First visit**: the landing page explains itself; no medicines or ZIP are filled in. "Try an example" loads mom's four medicines and a Phoenix ZIP.
- **Resolving a chip**: while a name is being looked up, the chip shows it's checking; then it settles to resolved or "not recognized."
- **Nothing recognized yet**: the plan can't be produced until at least one chip is recognized. The page says so gently.
- **No ZIP**: medicine cards appear; the heat area says "Add a ZIP code to see this week's heat where you live." No "this week" lines, no summary about heat days.
- **ZIP outside the forecast area**: heat boxes replaced by a note; medicine check still works.
- **Forecast service down**: heat boxes show a real past heat wave, labeled "saved data" with date and place; medicine check still works.
- **Calm week**: summary is calm; cards still appear with an empty or "no orange-or-higher days" "this week" line; replay toggle offers the past heat wave.
- **Red or magenta day ahead**: summary line changes to the "go over this plan today" wording. Nothing else gets scarier.
- **Persistence**: "your list stays on your device": the medicine list and ZIP are remembered on this device between visits and never stored on a server. Medicine names are sent to NLM RxNorm to be recognized; see `Open Questions` on making the trust line precise about this.
- **Boundary**: nothing in any plan, summary, card, or note ever tells the user to stop, skip, or change a dose. The Evidence page's second number enforces this across all 300 test runs.

## Product Decisions

- **Landing page that explains itself in 60 seconds**: a stranger should understand it on first visit; the sources go on the landing page, not buried.
- **One chip per bottle, even for combination pills**: "that's what the person holds." The chip shows both ingredients and the card explains both; the pill triggers the combination warning on its own because "people usually don't know one pill is both."
- **Medicine wording never changes with the forecast**: "how furosemide affects thirst doesn't change with the forecast, and I don't want the wording to get scarier." Heat context lives in the "this week" line and the summary, using the CDC's orange-or-higher threshold.
- **Only the summary changes on red or magenta days**: plain "go over this plan today," never medicine or dose advice.
- **Past heat wave replay for everyone**: so someone in a calm October week can prepare before summer. Labeled with real date and place so it's never mistaken for a forecast.
- **Colors always with a word**: accessibility for older eyes and color blindness; also easy to test.
- **"i" buttons on every term and number**: what it is, why it matters, source. Makes the page explain its own evidence.
- **A dedicated Evidence page with failures shown, not hidden**: disagreements listed in both directions with reasons; numbers generated from the test run so the page can't drift.
- **Warnings never repeated** when the same ingredient appears twice.
- **"Not listed in CDC heat guidance" replaces "no known heat concern"** (decided in `4-spec`). The CDC list isn't the only guidance, so the card says exactly what was checked, with UK and Canada badges alongside.
- **ZIP is optional**: "some people won't want to share a location, and people outside the US can still learn from the medicine check." With medicines and no ZIP, cards appear and the page says "Add a ZIP code to see this week's heat where you live."
- **Trust line is exact and honest about lookups**: "Free. No account. We don't store anything. To check your list, medicine names are looked up in the National Library of Medicine's RxNorm and your ZIP goes to the National Weather Service."
- **"Try an example" opens with the past heat wave replay on** so the demo is vivid in any season, as long as the replay label is clearly visible.
- **Print uses the browser's print**, with the page styled to fit one sheet.
- **At least one recognized chip is required** before the plan appears.
- **References section at the bottom of the landing page** listing every source with links. Site text uses no emojis and no em dashes.

## What We're Building

- Landing page with explanation, sources, "Try an example," the exact trust line, Evidence link, and a References section.
- Medicine entry with RxNorm-resolved chips, spelling suggestions, "not recognized," combination pills as one chip.
- Optional ZIP entry and 7-day NWS HeatRisk boxes with color plus word; "add a ZIP" prompt when absent; out-of-area note; labeled saved data when the service is down.
- The plan: summary line, medicine cards with "this week" lines, combination warning, storage notes, "not listed" list, 911 signs, bold closing line, sources.
- Past heat wave replay toggle, labeled.
- "i" buttons on every term and number.
- Print to one page.
- The CDC rules file with quotes, links, and dates.
- The 300-medicine test against UKHSA and Health Canada, and the Evidence page generated from its results.
- Static site on GitHub Pages.

## Deferred From the POC

- **An API for other apps**: the same check as a service. Not needed to prove the kernel on a screen.
- **Hot-day calendar reminders**: requires scheduling and notifications; the replay toggle covers "prepare before summer" for now.
- **Reading a photo of pill bottles**: image recognition is a project of its own; typing names with RxNorm suggestions is enough for the proof.
- **Automatic re-checking of the CDC page**: the dated, versioned rules file is the proof-of-concept answer to drift.
- **Multiple people or saved lists**: one list on one device is the whole loop.

## Possible Later Enhancements

- Sharing a plan by link with a pharmacist.
- Languages beyond English.
- Expanding the rules file with UKHSA or Health Canada classes the CDC doesn't list, shown as "other national guidance."

## Non-Goals

- **Advice to stop, skip, or change a dose.** The learner's hard rule. The pharmacist or doctor decides.
- **General drug-drug interactions.** Only the heat combinations the CDC names.
- **Accounts, logins, or storing plans on a server.** The printed page is the artifact; the list stays on the device.
- **A hand-maintained drug name list.** RxNorm knows nearly every US prescription.
- **Wording that escalates with the heat level.** Tempting during the build; explicitly rejected.
- **Hand-typed numbers on the Evidence page.** They must come from the test run.

## Open Questions

- **Source of the "300 most-prescribed US medicines" list (can wait for `4-spec`).** A published, citable list is needed; spec picks it.
- **Which past heat wave to replay (can wait for `4-spec`).** Needs a real place and date with archived HeatRisk data.
- **HeatRisk coverage area (can wait for `4-spec`).** Spec confirms which ZIPs count as "outside the forecast area."
- **Exact CDC classes, quotes, and storage items (resolved during the build).** The learner curates these from the CDC page into the rules file; the build starts with this per the agreed order in `scope.md`.
