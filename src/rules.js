// The rules engine. Pure: no network, no DOM. Imported by the plan page AND by the tests
// and the evidence runner, so the numbers on the Evidence page describe the exact code the
// site runs. See spec.md > Components > Rules engine.

import { planningDays, maxLevel, levelInfo, weekdayLabel } from './heatrisk.js';

const norm = (s) => String(s ?? '').trim().toLowerCase();

// Validates the rules file. Throws on any enabled entry without a CDC quote and link,
// so a flag without a quote cannot be produced.
export function loadRules(json) {
  if (!json || !Array.isArray(json.classes)) throw new Error('rules: classes[] missing');
  const check = (entry, kind) => {
    if (entry.enabled === false) return;
    if (!entry.id) throw new Error(`rules: ${kind} entry without id`);
    if (!String(entry.cdc_quote ?? '').trim()) throw new Error(`rules: ${kind} "${entry.id}" has no cdc_quote`);
    if (!String(entry.cdc_url ?? '').trim()) throw new Error(`rules: ${kind} "${entry.id}" has no cdc_url`);
    if (!String(entry.checked_on ?? '').trim()) throw new Error(`rules: ${kind} "${entry.id}" has no checked_on`);
  };
  for (const c of json.classes) check(c, 'class');
  for (const c of json.combinations ?? []) check(c, 'combination');
  for (const s of json.storage ?? []) check(s, 'storage');
  for (const s of json.sun_notes ?? []) check(s, 'sun_note');
  if (json.never_stop) check({ id: 'never_stop', ...json.never_stop }, 'never_stop');
  if (json.storage_general) check({ id: 'storage_general', ...json.storage_general }, 'storage_general');
  return json;
}

function matchesRule(ing, rule) {
  const atc = Array.isArray(ing.atc) ? ing.atc : [];
  const names = [norm(ing.name), norm(ing.base_name)].filter(Boolean);
  const exNames = (rule.exclude_ingredients ?? []).map(norm);
  if (names.some((n) => exNames.includes(n))) return false;
  const exAtc = rule.exclude_atc_prefixes ?? [];
  if (atc.some((code) => exAtc.some((p) => code.startsWith(p)))) return false;
  const byAtc = (rule.atc_prefixes ?? []).some((p) => atc.some((code) => code.startsWith(p)));
  const byName = (rule.ingredients ?? []).map(norm).some((n) => names.includes(n));
  const byContains = (rule.name_contains ?? []).map(norm).some((n) => names.some((x) => x.includes(n)));
  return byAtc || byName || byContains;
}

// Collapses the chip list into unique ingredients, keeping every name it was typed as.
export function uniqueIngredients(medicines) {
  const byKey = new Map();
  for (const med of medicines ?? []) {
    if (med.status && med.status !== 'resolved') continue;
    for (const ing of med.ingredients ?? []) {
      const key = ing.rxcui ? `rxcui:${ing.rxcui}` : `name:${norm(ing.name)}`;
      if (!byKey.has(key)) {
        byKey.set(key, { rxcui: ing.rxcui ?? null, name: ing.name, base_name: ing.base_name ?? null, atc: [...(ing.atc ?? [])], as_typed: [] });
      }
      const u = byKey.get(key);
      for (const code of ing.atc ?? []) if (!u.atc.includes(code)) u.atc.push(code);
      const typed = med.input ?? med.name ?? ing.name;
      if (typed && !u.as_typed.includes(typed)) u.as_typed.push(typed);
    }
  }
  return [...byKey.values()];
}

function dayPhrase(isoDate, todayIso) {
  if (todayIso) {
    const t = new Date(`${todayIso}T12:00:00Z`).getTime();
    const d = new Date(`${isoDate}T12:00:00Z`).getTime();
    const diff = Math.round((d - t) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
  }
  return weekdayLabel(isoDate);
}

function article(word) {
  return /^[aeiou]/i.test(word) ? 'an' : 'a';
}

function monthDay(isoDate) {
  return new Date(`${isoDate}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function listDates(dates) {
  const parts = dates.map(monthDay);
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

function summarize(week, todayIso, { mode = 'live', place = null } = {}) {
  if (!week) {
    // No boxes are shown. Only the no-ZIP invitation may say "where you live", because the person
    // has not told us where that is yet; every other case names what happened to their ZIP.
    const text = {
      unavailable: "The heat forecast isn't available for this ZIP, so this plan covers your medicines only.",
      zip_not_found: "That ZIP code wasn't found, so this plan covers your medicines only.",
      unreachable: "The heat forecast couldn't be reached right now, so this plan covers your medicines only.",
    }[mode] ?? "Add a ZIP code to see this week's heat where you live.";
    return { level_max: null, planning_days: [], text };
  }
  const max = maxLevel(week);
  const planning = planningDays(week);
  const planningDates = planning.map((d) => d.date);

  if (mode === 'replay') {
    const where = place ?? 'this place';
    if (max >= 2) {
      const word = levelInfo(max).word;
      const peakDays = week.filter((d) => d.level === max).map((d) => d.date);
      const n = peakDays.length;
      return { level_max: max, planning_days: planningDates, text: `During this past heat wave, ${where} had ${n} ${word} day${n === 1 ? '' : 's'} (${listDates(peakDays)}). This is how your plan would have looked.` };
    }
    return { level_max: max, planning_days: [], text: `During this past week, ${where} had no orange, red, or magenta days. This is how your plan would have looked.` };
  }

  if (max >= 3) {
    const first = week.find((d) => d.level !== null && d.level >= 3);
    const word = levelInfo(first.level).word;
    return { level_max: max, planning_days: planningDates, text: `${dayPhrase(first.date, todayIso)} is ${article(word)} ${word} heat risk day where you live. Go over this plan today.` };
  }
  if (max === 2) {
    return { level_max: max, planning_days: planningDates, text: 'Heat risk reaches Moderate this week. A good week to go over this plan.' };
  }
  return { level_max: max, planning_days: [], text: 'Little heat risk is expected this week. A calm week is a good time to go over this plan before the next hot spell.' };
}

function thisWeekLine(planning, week) {
  if (!week) return null;
  if (!planning.length) return 'No orange, red, or magenta days in the next 7 days.';
  return `Matters most on ${planning.map((d) => weekdayLabel(d.date)).join(', ')}.`;
}

function source(entry) {
  return { quote: entry.cdc_quote, url: entry.cdc_url, checked_on: entry.checked_on, label: entry.cdc_label ?? null, quote_status: entry.quote_status ?? 'draft' };
}

// evaluate({ medicines, forecast, rules, answerKeys, today }) -> plan object.
//   medicines: chips from rxnorm.js (status 'resolved' counted; 'not_recognized' listed)
//   forecast:  [{ date, level, word }] or null when there is no ZIP / no data
//   rules:     the parsed cdc-rules.json (run through loadRules)
//   answerKeys: optional { ukhsa: { matches(ing) }, health_canada: { matches(ing) } }
export function evaluate({ medicines = [], forecast = null, rules, answerKeys = null, today = null, mode = 'live', place = null }) {
  const r = loadRules(rules);
  const week = Array.isArray(forecast) && forecast.length ? forecast : null;
  const planning = planningDays(week);
  const summary = summarize(week, today, { mode, place });
  const thisWeek = thisWeekLine(planning, week);

  const ingredients = uniqueIngredients(medicines);
  const enabledClasses = r.classes.filter((c) => c.enabled !== false);
  const enabledStorage = (r.storage ?? []).filter((s) => s.enabled !== false);
  const enabledSun = (r.sun_notes ?? []).filter((s) => s.enabled !== false);

  const cards = [];
  const storage = [];
  const sunNotes = [];
  const notListed = [];
  const matchedClassIds = new Set();

  for (const ing of ingredients) {
    const matched = enabledClasses.filter((c) => matchesRule(ing, c));
    const storageHits = enabledStorage.filter((s) => matchesRule(ing, s));
    const sunHits = enabledSun.filter((s) => matchesRule(ing, s));
    for (const c of matched) matchedClassIds.add(c.id);
    for (const s of storageHits) {
      const existing = storage.find((x) => x.id === s.id);
      if (existing) existing.ingredients.push(ing.name);
      else storage.push({ id: s.id, ingredients: [ing.name], text: s.text, source: source(s) });
    }
    for (const s of sunHits) {
      const existing = sunNotes.find((x) => x.id === s.id);
      if (existing) existing.ingredients.push(ing.name);
      else sunNotes.push({ id: s.id, heading: s.heading, ingredients: [ing.name], text: s.text, ask: s.ask_pharmacist ?? null, source: source(s) });
    }
    if (matched.length) {
      const primary = matched[0];
      cards.push({
        ingredient: ing.name,
        rxcui: ing.rxcui,
        as_typed: ing.as_typed,
        atc: ing.atc,
        class_id: primary.id,
        class: primary.plain_name,
        cdc_label: primary.cdc_label,
        why: primary.why,
        watch_for: primary.watch_for,
        ask: primary.ask_pharmacist,
        also_listed_under: matched.slice(1).map((c) => ({ id: c.id, class: c.plain_name, cdc_label: c.cdc_label, source: source(c) })),
        this_week_days: planning.map((d) => d.date),
        this_week: thisWeek,
        source: source(primary),
      });
    } else if (!storageHits.length && !sunHits.length) {
      notListed.push({
        ingredient: ing.name,
        rxcui: ing.rxcui,
        as_typed: ing.as_typed,
        atc: ing.atc,
        badges: {
          ukhsa: answerKeys?.ukhsa ? Boolean(answerKeys.ukhsa.matches(ing)) : null,
          health_canada: answerKeys?.health_canada ? Boolean(answerKeys.health_canada.matches(ing)) : null,
        },
      });
    }
  }

  const combinations = [];
  for (const combo of r.combinations ?? []) {
    if (combo.enabled === false) continue;
    const ok = (combo.requires_all ?? []).every((group) => group.some((id) => matchedClassIds.has(id)));
    if (ok) combinations.push({ id: combo.id, text: combo.text, ask: combo.ask_pharmacist ?? null, source: source(combo) });
  }

  const unrecognized = (medicines ?? []).filter((m) => m.status === 'not_recognized').map((m) => m.input ?? m.name);

  return {
    summary,
    week,
    cards,
    combinations,
    storage,
    storage_general: r.storage_general ? { text: r.storage_general.text, source: source(r.storage_general) } : null,
    sun_notes: sunNotes,
    not_listed: notListed,
    unrecognized,
    warning_signs: r.warning_signs ?? null,
    never_stop: r.never_stop ? { text: r.never_stop.text, source: source(r.never_stop) } : null,
    rules_version: r.version ?? null,
  };
}

// Everything a person reads on the plan, as plain text lines. Used by the stop-instruction
// scan and by tests. Quotes shown behind "i" buttons are CDC text and are not included.
export function planToText(plan) {
  const lines = [];
  if (plan.summary?.text) lines.push(plan.summary.text);
  for (const c of plan.cards) {
    lines.push(`${c.ingredient}, ${c.class}`, c.why, c.watch_for, `Ask your pharmacist: ${c.ask}`);
    if (c.this_week) lines.push(c.this_week);
    for (const a of c.also_listed_under) lines.push(`Also listed under: ${a.class}`);
  }
  for (const combo of plan.combinations) { lines.push(combo.text); if (combo.ask) lines.push(`Ask your pharmacist: ${combo.ask}`); }
  for (const s of plan.storage) lines.push(s.text);
  if (plan.storage_general) lines.push(plan.storage_general.text);
  for (const s of plan.sun_notes ?? []) { lines.push(s.text); if (s.ask) lines.push(`Ask your pharmacist: ${s.ask}`); }
  for (const n of plan.not_listed) lines.push(`${n.ingredient}: not listed in CDC heat guidance`);
  for (const u of plan.unrecognized) lines.push(`${u}: not recognized`);
  if (plan.warning_signs) {
    lines.push(plan.warning_signs.intro, ...plan.warning_signs.signs);
    if (plan.warning_signs.action) lines.push(plan.warning_signs.action);
    if (plan.warning_signs.also) lines.push(plan.warning_signs.also);
  }
  if (plan.never_stop) lines.push(plan.never_stop.text);
  return lines.filter(Boolean);
}

// Sentences that read as an instruction to stop, skip, or change a dose. The bold closing
// line ("Never stop or change...") and any "avoid/do not/never ... stop" sentence are allowed.
const STOP_RE = /\b(stop|stopping|quit|skip|skipping|discontinue|hold|pause)\b[^.]{0,50}\b(medicine|medication|medications|pill|pills|dose|doses|taking|it)\b|\b(take (less|more|fewer|extra|half|double)|(lower|raise|increase|decrease|reduce|change|adjust|halve|double) (the |your |a )?(dose|dosage|amount))\b/i;
const ALLOW_RE = /\b(never|avoid|do not|don't|without)\b[^.]{0,40}\b(stop|stopping|change|changing|skip|adjust)/i;

export function stopInstructionMatches(lines) {
  const out = [];
  for (const line of lines) {
    for (const sentence of String(line).split(/(?<=[.!?])\s+/)) {
      if (!STOP_RE.test(sentence)) continue;
      if (ALLOW_RE.test(sentence)) continue;
      out.push(sentence.trim());
    }
  }
  return out;
}
