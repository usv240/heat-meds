// Turns data into DOM: the heat week, notes, and every plan section in the PRD's order.
// Slice 5 replaces the interim <details> source reveals with "i" popovers.

import { levelInfo, weekdayLabel, shortDateLabel } from './heatrisk.js';

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

function sourceReveal(source, label = 'Source') {
  if (!source) return null;
  const d = el('details', { class: 'source' });
  d.append(el('summary', { text: `${label}: CDC, checked ${source.checked_on}` }));
  d.append(el('p', { class: 'small' }, [el('q', { text: source.quote })]));
  d.append(el('p', { class: 'small' }, [el('a', { href: source.url, target: '_blank', rel: 'noopener', text: 'CDC heat and medications guidance for clinicians' })]));
  if (source.quote_status === 'draft') d.append(el('p', { class: 'small muted', text: 'Quote status: draft, awaiting line-by-line check against the live CDC page.' }));
  return d;
}

function typedLabel(card) {
  const typed = (card.as_typed ?? []).filter((t) => t.toLowerCase() !== card.ingredient.toLowerCase());
  return typed.length ? `${typed.join(', ')} → ${card.ingredient}` : card.ingredient;
}

export function renderSummary(plan) {
  return el('p', { class: 'summary', text: plan.summary.text });
}

export function renderCards(plan) {
  const wrap = el('section', { 'aria-labelledby': 'cardsHeading' });
  wrap.append(el('h2', { id: 'cardsHeading', text: 'Medicines that matter in heat' }));
  if (!plan.cards.length) {
    wrap.append(el('p', { class: 'note', text: 'None of the medicines you entered are on the CDC heat and medication list.' }));
    return wrap;
  }
  for (const card of plan.cards) {
    const art = el('article', { class: 'card med-card' });
    art.append(el('h3', {}, [el('span', { text: typedLabel(card) }), el('span', { class: 'muted', text: ` (${card.class})` })]));
    art.append(el('p', { text: card.why }));
    art.append(el('p', {}, [el('strong', { text: 'Watch for: ' }), document.createTextNode(card.watch_for)]));
    art.append(el('p', {}, [el('strong', { text: 'Ask your pharmacist: ' }), document.createTextNode(card.ask)]));
    if (card.this_week) art.append(el('p', { class: 'this-week', text: `This week: ${card.this_week}` }));
    for (const also of card.also_listed_under) art.append(el('p', { class: 'small muted', text: `Also listed by the CDC under: ${also.class}` }));
    art.append(sourceReveal(card.source));
    wrap.append(art);
  }
  return wrap;
}

export function renderCombinations(plan) {
  if (!plan.combinations.length) return null;
  const wrap = el('section', { 'aria-labelledby': 'comboHeading' });
  wrap.append(el('h2', { id: 'comboHeading', text: 'Combination warning' }));
  for (const combo of plan.combinations) {
    const box = el('div', { class: 'card warn' });
    box.append(el('p', { text: combo.text }));
    if (combo.ask) box.append(el('p', {}, [el('strong', { text: 'Ask your pharmacist: ' }), document.createTextNode(combo.ask)]));
    box.append(sourceReveal(combo.source));
    wrap.append(box);
  }
  return wrap;
}

export function renderStorage(plan) {
  const wrap = el('section', { 'aria-labelledby': 'storageHeading' });
  wrap.append(el('h2', { id: 'storageHeading', text: 'Storing your medicines in heat' }));
  const list = el('ul', { class: 'plain-list' });
  for (const s of plan.storage) {
    list.append(el('li', {}, [el('strong', { text: `${s.ingredients.join(', ')}: ` }), document.createTextNode(s.text), sourceReveal(s.source)]));
  }
  if (plan.storage_general) list.append(el('li', {}, [document.createTextNode(plan.storage_general.text), sourceReveal(plan.storage_general.source)]));
  wrap.append(list);
  return wrap;
}

export function renderNotListed(plan) {
  const wrap = el('section', { 'aria-labelledby': 'notListedHeading' });
  wrap.append(el('h2', { id: 'notListedHeading', text: 'Not listed in CDC heat guidance' }));
  if (!plan.not_listed.length && !plan.unrecognized.length) {
    wrap.append(el('p', { class: 'muted', text: 'Every medicine you entered is on the CDC list above.' }));
    return wrap;
  }
  const list = el('ul', { class: 'plain-list' });
  for (const n of plan.not_listed) {
    const li = el('li', {}, [el('span', { text: typedLabel({ as_typed: n.as_typed, ingredient: n.ingredient }) })]);
    const badges = [];
    if (n.badges.ukhsa !== null) badges.push(el('span', { class: `badge ${n.badges.ukhsa ? 'on' : ''}`, text: n.badges.ukhsa ? 'UK lists it' : 'UK: not listed' }));
    if (n.badges.health_canada !== null) badges.push(el('span', { class: `badge ${n.badges.health_canada ? 'on' : ''}`, text: n.badges.health_canada ? 'Canada lists it' : 'Canada: not listed' }));
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
  wrap.append(el('p', { class: 'small muted' }, [document.createTextNode('Source: '), el('a', { href: w.source_url, target: '_blank', rel: 'noopener', text: w.source_title })]));
  return wrap;
}

export function renderClosing(plan) {
  const wrap = el('section', { class: 'closing' });
  if (plan.never_stop) {
    wrap.append(el('p', { class: 'never-stop' }, [el('strong', { text: plan.never_stop.text })]));
    wrap.append(sourceReveal(plan.never_stop.source, 'Why we say this'));
  }
  return wrap;
}

export function renderSources(extra = []) {
  const wrap = el('section', { class: 'sources small muted', 'aria-label': 'Sources' });
  wrap.append(el('h2', { text: 'Sources' }));
  const list = el('ul');
  const items = [
    ['CDC, Heat and Medications: Guidance for Clinicians (page dated Sept. 18, 2025)', 'https://www.cdc.gov/heat-health/hcp/clinical-guidance/heat-and-medications-guidance-for-clinicians.html'],
    ['National Weather Service HeatRisk (experimental)', 'https://www.wpc.ncep.noaa.gov/heatrisk/'],
    ['National Library of Medicine RxNorm and RxClass', 'https://rxnav.nlm.nih.gov/'],
    ...extra,
  ];
  for (const [label, href] of items) list.append(el('li', {}, [el('a', { href, target: '_blank', rel: 'noopener', text: label })]));
  wrap.append(list);
  wrap.append(el('p', { text: 'This product uses publicly available data from the U.S. National Library of Medicine (NLM), National Institutes of Health, Department of Health and Human Services; NLM is not responsible for the product and does not endorse or recommend this or any other product.' }));
  return wrap;
}

// The whole plan below the heat area, in the PRD's order.
export function renderPlanSections(plan) {
  const frag = document.createDocumentFragment();
  for (const node of [renderCards(plan), renderCombinations(plan), renderStorage(plan), renderNotListed(plan), renderWarningSigns(plan), renderClosing(plan), renderSources()]) {
    if (node) frag.append(node);
  }
  return frag;
}
