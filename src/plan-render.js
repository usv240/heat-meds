// Turns data into DOM: the heat week, notes, and every plan section in the PRD's order.
// Every term and number gets a small "i" button (see info.js); cards' "i" show the exact CDC quote.

import { levelInfo, weekdayLabel, shortDateLabel } from './heatrisk.js';
import { infoButton, sourceEntry } from './info.js';

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (v !== null && v !== undefined) node.setAttribute(k, v);
  }
  for (const c of children) if (c !== null && c !== undefined) node.append(c);
  return node;
}

export function renderHeatNote(text) {
  return el('p', { class: 'note', text });
}

// Seven boxes, each with the official color and its word. Never color alone.
export function renderHeatWeek(week) {
  const list = el('ul', { class: 'heat-week', 'aria-label': 'Heat risk for the next seven days' });
  for (const day of week) {
    const info = day.level === null ? null : levelInfo(day.level);
    const li = el('li', {
      class: `heat-day${info ? '' : ' unknown'}`,
      style: info ? `background:${info.color};color:${info.ink}` : null,
    }, [
      el('span', { class: 'dow', text: weekdayLabel(day.date) }),
      el('span', { class: 'date', text: shortDateLabel(day.date) }),
      el('span', { class: 'word', text: info ? info.word : 'No data' }),
    ]);
    li.setAttribute('aria-label', `${weekdayLabel(day.date)} ${shortDateLabel(day.date)}: ${info ? info.word : 'no data'}`);
    list.append(li);
  }
  return list;
}

const CDC_WHY = 'Every card on this plan is built from the CDC guidance for clinicians. The exact wording is quoted here with the date it was checked, so you or your pharmacist can verify it.';

function cdcInfo(term, source, what) {
  return infoButton(sourceEntry(term, source, what, CDC_WHY));
}

function heading(level, id, text, info) {
  return el(level, { id }, [document.createTextNode(text), info ?? null]);
}

function typedLabel(card) {
  const typed = (card.as_typed ?? []).filter((t) => t.toLowerCase() !== card.ingredient.toLowerCase());
  return typed.length ? `${typed.join(', ')} → ${card.ingredient}` : card.ingredient;
}

// "Zoloft → sertraline, an antidepressant (SSRI)"
function cardTitle(card) {
  return `${typedLabel(card)}, ${card.class}`;
}

export function renderSummary(plan) {
  return el('p', { class: 'summary', text: plan.summary.text });
}

export function renderCards(plan) {
  const wrap = el('section', { 'aria-labelledby': 'cardsHeading' });
  wrap.append(heading('h2', 'cardsHeading', 'Medicines that matter in heat', infoButton('drug_class')));
  if (!plan.cards.length) {
    wrap.append(el('p', { class: 'note', text: 'None of the medicines you entered are on the CDC heat and medication list.' }));
    return wrap;
  }
  for (const card of plan.cards) {
    const art = el('article', { class: 'card med-card' });
    art.append(el('h3', {}, [document.createTextNode(cardTitle(card)), cdcInfo(`${card.ingredient}: what the CDC says`, card.source, `The CDC lists this medicine's class, ${card.cdc_label}, in its heat and medications table.`)]));
    art.append(el('p', { text: card.why }));
    art.append(el('p', {}, [el('strong', { text: 'Watch for: ' }), document.createTextNode(card.watch_for)]));
    art.append(el('p', {}, [el('strong', { text: 'Ask your pharmacist: ' }), document.createTextNode(card.ask)]));
    if (card.this_week) art.append(el('p', { class: 'this-week' }, [document.createTextNode(`This week: ${card.this_week}`), infoButton('this_week')]));
    for (const also of card.also_listed_under) art.append(el('p', { class: 'small muted' }, [document.createTextNode(`Also listed by the CDC under: ${also.class}`), cdcInfo(`${also.cdc_label}`, also.source, `The CDC also lists this medicine under ${also.cdc_label}.`)]));
    wrap.append(art);
  }
  return wrap;
}

export function renderCombinations(plan) {
  if (!plan.combinations.length) return null;
  const wrap = el('section', { 'aria-labelledby': 'comboHeading' });
  wrap.append(heading('h2', 'comboHeading', 'Combination warning', infoButton('combination')));
  for (const combo of plan.combinations) {
    const box = el('div', { class: 'card warn' });
    box.append(el('p', {}, [document.createTextNode(combo.text), cdcInfo('The CDC on this combination', combo.source, 'The CDC names this pairing specifically.')]));
    if (combo.ask) box.append(el('p', {}, [el('strong', { text: 'Ask your pharmacist: ' }), document.createTextNode(combo.ask)]));
    wrap.append(box);
  }
  return wrap;
}

export function renderStorage(plan) {
  const wrap = el('section', { 'aria-labelledby': 'storageHeading' });
  wrap.append(heading('h2', 'storageHeading', 'Storing your medicines in heat', infoButton('storage')));
  const list = el('ul', { class: 'plain-list' });
  for (const s of plan.storage) {
    list.append(el('li', {}, [el('strong', { text: `${s.ingredients.join(', ')}: ` }), document.createTextNode(s.text), cdcInfo('The CDC on storage', s.source, 'Storage advice from the CDC guidance.')]));
  }
  if (plan.storage_general) list.append(el('li', {}, [document.createTextNode(plan.storage_general.text), cdcInfo('The CDC on storage', plan.storage_general.source, 'General storage advice from the CDC guidance.')]));
  wrap.append(list);
  return wrap;
}

export function renderSunNotes(plan) {
  if (!plan.sun_notes?.length) return null;
  const wrap = el('section', { 'aria-labelledby': 'sunHeading' });
  wrap.append(heading('h2', 'sunHeading', plan.sun_notes[0].heading || 'Sun and your skin'));
  for (const s of plan.sun_notes) {
    const box = el('div', { class: 'card' });
    box.append(el('p', {}, [el('strong', { text: `${s.ingredients.join(', ')}: ` }), document.createTextNode(s.text), cdcInfo('The CDC on sun sensitivity', s.source, 'The CDC describes a sun reaction for these medicines, not a heat reaction, so it is shown separately.')]));
    if (s.ask) box.append(el('p', {}, [el('strong', { text: 'Ask your pharmacist: ' }), document.createTextNode(s.ask)]));
    wrap.append(box);
  }
  return wrap;
}

export function renderNotListed(plan) {
  const wrap = el('section', { 'aria-labelledby': 'notListedHeading' });
  wrap.append(heading('h2', 'notListedHeading', 'Not listed in CDC heat guidance', infoButton('not_listed')));
  if (!plan.not_listed.length && !plan.unrecognized.length) {
    wrap.append(el('p', { class: 'muted', text: 'Every medicine you entered is on the CDC list above.' }));
    return wrap;
  }
  const list = el('ul', { class: 'plain-list' });
  for (const n of plan.not_listed) {
    const li = el('li', {}, [el('span', { text: typedLabel({ as_typed: n.as_typed, ingredient: n.ingredient }) })]);
    const badges = [];
    if (n.badges.ukhsa !== null) badges.push(el('span', { class: `badge ${n.badges.ukhsa ? 'on' : ''}` }, [document.createTextNode(n.badges.ukhsa ? 'UK lists it' : 'UK: not listed'), infoButton('badge_ukhsa')]));
    if (n.badges.health_canada !== null) badges.push(el('span', { class: `badge ${n.badges.health_canada ? 'on' : ''}` }, [document.createTextNode(n.badges.health_canada ? 'Canada lists it' : 'Canada: not listed'), infoButton('badge_health_canada')]));
    if (badges.length) li.append(el('span', { class: 'badges' }, badges));
    list.append(li);
  }
  for (const u of plan.unrecognized) list.append(el('li', { class: 'muted' }, [el('span', { text: `${u}: not recognized. It was left out of this plan.` })]));
  wrap.append(list);
  wrap.append(el('p', { class: 'small muted', text: '"Not listed" means the CDC guidance does not list this medicine\'s class. It does not mean heat is harmless.' }));
  return wrap;
}

export function renderWarningSigns(plan) {
  if (!plan.warning_signs) return null;
  const w = plan.warning_signs;
  const wrap = el('section', { class: 'card emergency', 'aria-labelledby': 'signsHeading' });
  wrap.append(el('h2', { id: 'signsHeading', text: w.heading }));
  wrap.append(el('p', { text: w.intro }));
  wrap.append(el('ul', { class: 'signs' }, w.signs.map((s) => el('li', { text: s }))));
  if (w.action) wrap.append(el('p', {}, [el('strong', { text: w.action })]));
  if (w.also) wrap.append(el('p', { text: w.also }));
  wrap.append(el('p', { class: 'small muted' }, [document.createTextNode('Source: '), el('a', { href: w.source_url, target: '_blank', rel: 'noopener', text: w.source_title })]));
  return wrap;
}

export function renderClosing(plan) {
  const wrap = el('section', { class: 'closing' });
  if (plan.never_stop) {
    wrap.append(el('p', { class: 'never-stop' }, [el('strong', { text: plan.never_stop.text }), cdcInfo('Why we never say to stop a medicine', plan.never_stop.source, 'The CDC tells clinicians to remind patients not to stop medicines abruptly; any change must come from your own clinician or pharmacist.')]));
  }
  return wrap;
}

export const SOURCES = [
  ['CDC, Heat and Medications: Guidance for Clinicians (page dated Sept. 18, 2025)', 'https://www.cdc.gov/heat-health/hcp/clinical-guidance/heat-and-medications-guidance-for-clinicians.html'],
  ['National Weather Service, Heat Cramps, Exhaustion, Stroke (warning signs, attributed to the CDC)', 'https://www.weather.gov/safety/heat-illness'],
  ['National Weather Service HeatRisk (experimental), including the Day 1 archive', 'https://www.wpc.ncep.noaa.gov/heatrisk/'],
  ['National Library of Medicine RxNorm and RxClass', 'https://rxnav.nlm.nih.gov/'],
  ['U.S. Census Bureau ZCTA Gazetteer (ZIP locations)', 'https://www.census.gov/geographies/reference-files/time-series/geo/gazetteer-files.html'],
];

export const NLM_ATTRIBUTION = 'This product uses publicly available data from the U.S. National Library of Medicine (NLM), National Institutes of Health, Department of Health and Human Services; NLM is not responsible for the product and does not endorse or recommend this or any other product.';

export function renderSources(extra = []) {
  const wrap = el('section', { class: 'sources small muted', 'aria-label': 'Sources' });
  wrap.append(el('h2', { text: 'Sources' }));
  const list = el('ul');
  for (const [label, href] of [...SOURCES, ...extra]) list.append(el('li', {}, [el('a', { href, target: '_blank', rel: 'noopener', text: label })]));
  wrap.append(list);
  wrap.append(el('p', { text: NLM_ATTRIBUTION }));
  return wrap;
}

// The whole plan below the heat area, in the PRD's order.
export function renderPlanSections(plan) {
  const frag = document.createDocumentFragment();
  for (const node of [renderCards(plan), renderCombinations(plan), renderStorage(plan), renderSunNotes(plan), renderNotListed(plan), renderWarningSigns(plan), renderClosing(plan), renderSources()]) {
    if (node) frag.append(node);
  }
  return frag;
}
