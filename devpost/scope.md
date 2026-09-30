---
doc: scope
status: approved
---

# Heat Meds (working title, from the folder name)

One line: type in your medicines and ZIP code, get one printable page that says which of your medicines make hot days more dangerous, what this week's heat looks like where you live, and what to ask your pharmacist. It never tells anyone to stop a medicine.

## The Unique Kernel
The CDC asked doctors in 2025 to make a heat-and-medication plan with patients, but patients have no tool to do it themselves. This flips that: the patient or their family drives it, the plan is tied to the real 7-day heat forecast for their ZIP, and every medicine line traces back to a quoted, dated line of CDC guidance. It is honest in both directions: it names the medicines that matter and also lists the ones checked with no known heat concern, "so it's honest and not just scary."

## Who It's For
A daughter, around 45, whose mom is 74 and lives alone in Phoenix. Mom takes a water pill, a blood pressure pill, an antidepressant, and insulin. It's June and the forecast says the next few days are really hot. Today, neither of them knows those medicines change the risk, and nobody has handed them a plan. Either the daughter sits down with the pill bottles or mom does it herself.

## The Core Loop
Type the medicines (by any name you'd find on the bottle) and the ZIP code. In about a minute, get one page to print, take to the pharmacist, or stick on the fridge. Come back when the forecast changes or a medicine changes.

## Inspiration & Identity
Calm, and very easy to read for older eyes: large text, light and dark mode, works on phone and desktop. Someone who has never heard of this should understand what it does on their first visit. One printed page with colored heat boxes for the next 7 days, plain-language reasons ("can make you less thirsty and dehydrated faster in heat"), and a bold closing line. Honest, not alarming. Sources visible on the page. No specific app or site references volunteered.

Sources named by the learner:
- CDC heat and medication guidance (web page with a table by drug class; curated by hand into the app).
- NWS HeatRisk 7-day forecast (live at runtime).
- NLM RxNorm / RxNav API (live at runtime, free, no key).
- UKHSA and Health Canada heat-and-medication lists (independent answer keys for testing, not shown to users).

## Why This Matters to the Learner
"Some everyday medicines, like water pills, some blood pressure pills and some antidepressants, make hot days more dangerous, and most people don't know that." The CDC told clinicians to do this; patients have nothing. Learning goals riding on this project: writing requirements precise enough to test, and proving the tool works with real outside data, not hand-picked examples.

## What "Working" Looks Like
Open the public site, click "try an example" or enter mom's four medicines and a Phoenix ZIP. The page comes back with, roughly:

- Top: date, place, and the next 7 days of heat risk as colored boxes, like "Tue orange, Wed red."
- One line per medicine that matters, e.g. "Furosemide (water pill): can make you less thirsty and dehydrated faster in heat. Watch for dizziness, very dark urine, confusion. Ask your pharmacist: should I change how much water I drink on hot days?"
- The combination warning if it applies (the water pill plus the blood pressure pill, because the CDC calls that combination out).
- A storage note: "Don't leave your insulin in a hot car."
- A short list of medicines checked with no known heat concern, like atorvastatin.
- Warning signs for when to call 911.
- Bottom, in bold: "Never stop or change a medicine on your own. Talk to your pharmacist or doctor." Plus the sources.

The "oh, that's cool" beat: type "Lasix" and watch it resolve to furosemide, land in the CDC's diuretics row with the exact quote and link, next to the real HeatRisk colors for that ZIP. Then it prints on one page.

Proof it works on real data:
- Run the app on the 300 most-prescribed US medicines, "not a handful of examples I picked."
- Compare what the app flags against the UKHSA and Health Canada heat-medicine lists as independent answer keys.
- Track two numbers: false alarms on common medicines no guideline flags (goal: zero), and plans that tell someone to stop a medicine (must be zero).
- A medicine the app truly can't recognize says "not recognized" and never guesses.

## The POC Boundary
In:
- Medicine name recognition via RxNorm/RxNav: brand or generic to generic ingredient and standard drug class code. Misspellings get RxNorm's spelling suggestions. Unrecognized means "not recognized," never a guess.
- Heat forecast via NWS HeatRisk for the ZIP, 7 days, shown as colors.
- A small, versioned CDC rules file, curated by the learner: each CDC drug class mapped to standard class codes, the reason it matters in heat, the exact CDC quote plus link, and the date checked. Same for combination warnings and storage notes. Covers all the classes the CDC calls out, not every drug.
- The one-page printable plan described above, calm and large-text, light and dark mode, phone and desktop.
- Deployed as a simple static site on GitHub Pages, with a "try an example" button, so judges and real people can try it without installing anything.
- Clearly labeled saved data (RxNorm lookups for common medicines, one past heat-wave forecast) so the demo still works if a government service is slow or down.
- The 300-medicine test run with the UKHSA and Health Canada answer keys and the two tracked numbers above.

## Later
- An API so other apps can run the same check.
- A hot-day calendar reminder when the forecast for your ZIP turns orange or red.
- Reading a photo of pill bottles instead of typing the names.
- Re-checking the CDC page automatically for changes, rather than by hand with a dated file.
- Multiple people or saved medicine lists per user.

## Explicitly Cut
- Any advice to stop, skip, or change a dose. The learner's hard rule; the page points to the pharmacist or doctor instead.
- Drug-drug interactions in general. Only the heat combinations the CDC names are in; everything else is a pharmacist's job.
- Accounts, logins, or saving plans on a server. Not needed to prove the kernel; the printed page is the artifact.
- A hand-maintained list of drug names. RxNorm already knows nearly every US prescription, so the app should not carry its own.

## Notes for Later Phases
- A static site on GitHub Pages means RxNorm and NWS calls happen from the browser with no server. `4-spec` should confirm both services allow that (CORS) and decide how the saved fallback data is loaded.
- The CDC rules file, the answer-key comparison, and the two tracked numbers are the natural home for the learner's testable-requirements goal in `3-prd`.
- Build order agreed at scope approval: the CDC rules file and the Phoenix example first, the answer-key comparison last. `5-build` sequences the middle.
