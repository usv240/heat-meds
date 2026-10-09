# Usability review (research-based, no live participants)

Date: October 9, 2026. Reviewer: the builder, with an AI assistant.

**Honest scope.** No real users were tested. This review applies published, validated checklists and measured
tools to the live site, so judges can see exactly what was checked and what was not. It is a substitute for
user testing, not equal to it.

## 1. AHRQ PEMAT-P, for the printed plan

The Patient Education Materials Assessment Tool for printable materials (AHRQ,
https://www.ahrq.gov/health-literacy/patient-education/pemat-p.html) scores understandability and
actionability. Agree = 1, Disagree = 0, Not applicable excluded. Rated on the Phoenix example printout.

### Understandability

| # | Item | Rating | Evidence |
|---|---|---|---|
| 1 | Purpose is completely evident | 1 | Title "Your heat and medicine plan", place, and the In short box at the top |
| 2 | No distracting content | 1 | Only the week, the medicines, warnings, and sources |
| 3 | Common, everyday language | 1 | "water pill", "blood pressure medicine"; card text measures grade 7.3 |
| 4 | Medical terms only to familiarize, and defined | 1 | Class names appear after a plain name: "a water pill (diuretic)" |
| 5 | Active voice | 1 | "Take this page to your pharmacist", "Keep insulin in the refrigerator" |
| 6 | Numbers clear | 1 | Only counts ("3 of your medicines") and dates |
| 7 | No calculations expected | 1 | None |
| 8 | Chunked into short sections | 1 | One card per medicine, separate boxes for combination, storage, 911 |
| 9 | Informative headers | 1 | "Medicines that matter in heat", "Call 911 if" |
| 10 | Logical sequence | 1 | Week, summary, medicines, warnings, emergency, never stop, sources |
| 11 | Provides a summary | 1 | "In short" box (added in this review) |
| 12 | Visual cues for key points | 1 | Bold labels, colored day boxes with words, bordered warning and 911 boxes |
| 15 | Visual aids where they help | 1 | The colored seven-day heat week |
| 16 | Visual aids reinforce content | 1 | Each box carries a word as well as a color |
| 17 | Visual aids have clear titles | 1 | "This week's heat risk" and the past heat wave label |
| 18 | Illustrations clear and uncluttered | N/A | No illustrations or photographs |
| 19 | Simple tables | N/A | No tables on the printout |

**Understandability: 15 of 15 applicable items = 100%.**

### Actionability

| # | Item | Rating | Evidence |
|---|---|---|---|
| 20 | At least one clear action | 1 | "Take this page to your pharmacist or doctor" |
| 21 | Addresses the user directly | 1 | "Ask your pharmacist", "your medicines" |
| 22 | Actions broken into explicit steps | 1 | Numbered "Your next steps" (added in this review) |
| 23 | Tangible tool | 1 | A tick box beside each pharmacist question on paper (added in this review) |
| 24 | Instructions for calculations | N/A | No calculations |
| 25 | Explains how to use charts or diagrams | 1 | Step 3 says which colored days matter and what to do on them |
| 26 | Visual aids that help act | 1 | Colored days show when to act |

**Actionability: 6 of 6 applicable items = 100%.**

Before this review the printout had no summary, no numbered steps, and no tick boxes: items 11, 22 and 23
would have scored 0, giving about 93% understandability and 67% actionability. The three additions came from
the checklist, not from guessing.

## 2. Plain language, measured

- Medicine card text (every enabled CDC class: why, watch for, ask your pharmacist): Flesch-Kincaid grade 7.3,
  about 15 words per sentence. Most health-literacy guidance targets grade 8 or below.
- Landing page: Flesch-Kincaid grade about 7.3.
- Known exceptions: a few "watch for" lines score higher only because they are lists of symptom words
  ("Dizziness, unsteadiness, unusual weakness"), which readability formulas over-penalize.

## 3. Older adults and accessibility

Checked against WCAG 2.2 AA and the NIA/NLM "Making Your Website Senior Friendly" recommendations
(large type, high contrast, no reliance on color alone, large click targets, plain language, simple navigation):

- axe-core 4.10, WCAG 2.2 AA rules: 0 violations on the home, plan, Evidence, and 404 pages, at 375 px and
  1280 px, in light and dark mode.
- Base text 20 px, the Atkinson Hyperlegible Next typeface (designed for low-vision readers), buttons at least
  48 px tall, every heat level shown with a word as well as a color.
- One shared header with two links; the main task is reachable from the home page in one scroll.
- Keyboard: every "i" button opens with Enter, closes with Escape, and shows a visible focus ring.

## 4. Nielsen's 10 usability heuristics (quick pass)

| Heuristic | How the site meets it |
|---|---|
| Visibility of status | Chips show "checking", resolved, or not recognized; saved and past data are labeled |
| Match with the real world | Bottle names accepted; plain names before class names |
| User control | Every chip has Remove; replay can be turned off; Change medicines or ZIP |
| Consistency | Same header, card layout, and "i" pattern on every page |
| Error prevention | Uncertain names need a tap ("Did you mean"); nothing is guessed |
| Recognition over recall | Example list and sample text; the plan repeats each medicine's name |
| Flexibility | Brand, generic, dose text, and misspellings all work |
| Minimalist design | One task per page; details behind "i" buttons |
| Error recovery | Clear messages for unknown names, bad ZIPs, out-of-area ZIPs, and service outages |
| Help | An "i" button on every term and number, with the source |

## 5. What this review cannot tell us

- Whether a real 74-year-old understands every card without help.
- Whether pharmacists find the questions useful.
- How the site works with screen readers beyond automated checks.

These are the first things to test with real people after the hackathon.
