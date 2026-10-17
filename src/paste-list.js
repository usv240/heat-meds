// Bring your own list: turn text pasted from a pharmacy printout, a patient portal, or a note into
// medicine names. Runs only in the browser; nothing is uploaded. Each name then goes through the same
// lookup as a typed name, so uncertain matches still need a tap.

const SKIP_LINE = /^(medications?|medicines?|current medications?|active medications?|prescriptions?|rx|name|drug|sig|directions|instructions|refills?|qty|quantity|prescriber|pharmacy|date|status)\s*:?$/i;
const BULLET = /^\s*(?:[-*•·]|\d+[.)]|\(\d+\))\s*/;

// Directions and pharmacy details that follow a name on the same line.
const TAIL = new RegExp([
  String.raw`\b(?:take|takes|taking|use|apply|inject|inhale|instill)\b`,
  String.raw`\b(?:by mouth|orally|po|qd|bid|tid|qid|qhs|prn|daily|once|twice|every)\b`,
  String.raw`\b(?:qty|quantity|refills?|disp|dispense|rx\s*#|sig)\b`,
  String.raw`\b(?:at bedtime|at night|nightly|in the (?:morning|evening)|with (?:food|meals|water)|before|after|as needed|when needed|for)\b`,
  String.raw`[(\[]`,
].join('|'), 'i');

export const MAX_ITEMS = 25;

export function parseMedicineList(text) {
  const names = [];
  const seen = new Set();
  // Per line: drop the bullet, cut off directions and pharmacy details, then split what is left on
  // commas and semicolons (unless a comma is a decimal comma inside a dose).
  const pieces = String(text ?? '').split(/\r?\n/).flatMap((line) => {
    let s = line.replace(BULLET, '').trim();
    const cut = s.search(TAIL);
    if (cut > 0) s = s.slice(0, cut);
    return /\d,\d/.test(s) ? [s] : s.split(/[,;]/);
  });
  for (const raw of pieces) {
    let s = raw.replace(BULLET, '').trim();
    if (!s || SKIP_LINE.test(s)) continue;
    s = s.replace(/\s{2,}/g, ' ').replace(/[\s:,-]+$/, '').trim();
    if (s.length < 3 || !/[a-z]/i.test(s)) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(s);
    if (names.length >= MAX_ITEMS) break;
  }
  return names;
}
