// Renders data/evidence.json in the PRD's order. Every value comes from the JSON.

import { el } from './plan-render.js';
import { infoButton } from './info.js';

const pct = (rate) => (rate === null || rate === undefined ? 'n/a' : `${(rate * 100).toFixed(1)}%`);
const n = (v) => Number(v).toLocaleString('en-US');

function tile(value, label, infoKey, cls = '') {
  return el('div', { class: `tile ${cls}` }, [
    el('div', { class: 'tile-num', text: String(value) }),
    el('div', { class: 'tile-label' }, [document.createTextNode(label), infoKey ? infoButton(infoKey) : null]),
  ]);
}

// Every table sits in a horizontally scrollable box so a wide table never widens the page on a phone.
function table(headers, rows) {
  const t = el('table', { class: 'evidence-table' });
  t.append(el('thead', {}, [el('tr', {}, headers.map((h) => el('th', { text: h })))]));
  const body = el('tbody');
  for (const r of rows) body.append(el('tr', {}, r.map((c) => (c instanceof Node ? el('td', {}, [c]) : el('td', { text: String(c) })))));
  t.append(body);
  return el('div', { class: 'table-wrap', tabindex: '0' }, [t]);
}

// A plain-language summary at the top: the headline numbers and two agreement bars, all from the run.
function renderSummaryBlock(e) {
  const stat = (value, label, ok = false) => el('li', {}, [
    el('span', { class: `stat-num${ok ? ' ok' : ''}`, text: n(value) }),
    el('span', { text: label }),
  ]);
  const bar = (name, a) => el('div', { class: 'bar-row' }, [
    el('div', { class: 'bar-text' }, [el('span', { text: `Agrees with ${name}` }), el('strong', { text: `${pct(a.rate)}, ${n(a.agree)} of ${n(a.total)}` })]),
    el('div', { class: 'bar', 'aria-hidden': 'true' }, [el('div', { class: 'bar-fill', style: `width: ${(a.rate * 100).toFixed(2)}%` })]),
  ]);
  const zeroQuote = e.must_be_zero.flags_without_cdc_quote;
  const zeroStop = e.must_be_zero.stop_instructions;
  const box = el('section', { class: 'card evidence-summary', 'aria-labelledby': 'summaryHeading' });
  box.append(el('h2', { id: 'summaryHeading', text: 'In short' }));
  box.append(el('ul', { class: 'summary-stats' }, [
    stat(e.test_set.count, ' medicines tested'),
    stat(zeroQuote, ' cards without a CDC quote', zeroQuote === 0),
    stat(zeroStop, ' plans that say stop', zeroStop === 0),
  ]));
  box.append(el('div', { class: 'bars' }, [
    bar('the UK (UKHSA)', e.agreement.ukhsa),
    bar('Canada (Health Canada)', e.agreement.health_canada),
  ]));
  box.append(el('p', { class: 'small' }, [el('a', { href: '#disHeading', text: 'Every disagreement is listed below.' })]));
  return box;
}

export function renderEvidence(e) {
  const frag = document.createDocumentFragment();
  frag.append(renderSummaryBlock(e));
  const runDate = new Date(e.run_on).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const version = e.commit ? `, code version ${e.commit}${e.commit_clean === false ? ' plus uncommitted changes' : ''}` : '';
  frag.append(el('p', { class: 'muted small', text: `Run on ${runDate}${version}, rules file ${e.rules_version}. ${n(e.counts.resolved)} of ${n(e.test_set.count)} medicines resolved.` }));

  // 1. The two must-be-zero numbers.
  const must = el('section', { 'aria-labelledby': 'mustHeading' });
  must.append(el('h2', { id: 'mustHeading', text: 'Must be zero' }));
  must.append(el('div', { class: 'tiles' }, [
    tile(e.must_be_zero.flags_without_cdc_quote, 'medicine cards produced without an exact CDC quote', 'evidence_quote_zero', e.must_be_zero.flags_without_cdc_quote === 0 ? 'ok' : 'bad'),
    tile(e.must_be_zero.stop_instructions, 'plans that tell someone to stop, skip, or change a dose', 'evidence_stop_zero', e.must_be_zero.stop_instructions === 0 ? 'ok' : 'bad'),
  ]));
  must.append(el('p', { class: 'small muted', text: 'The first is enforced in code: the rules engine refuses to load an entry without a CDC quote. The second scans every line of every generated plan.' }));
  if (e.must_be_zero.stop_examples?.length) {
    must.append(table(['Medicine', 'Line'], e.must_be_zero.stop_examples.flatMap((x) => x.lines.map((l) => [x.ingredient, l]))));
  }
  frag.append(must);

  // 2. Flags among medicines neither UK nor Canada lists, each with its CDC quote.
  const outside = el('section', { 'aria-labelledby': 'outsideHeading' });
  outside.append(el('h2', { id: 'outsideHeading' }, [document.createTextNode(`Flagged by this site but listed by neither the UK nor Canada: ${e.flags_outside_uk_and_canada.count}`), infoButton('answer_keys')]));
  outside.append(el('p', { class: 'small muted', text: 'Reported, not zero-targeted. Each one comes from the CDC table or page text, quoted here.' }));
  outside.append(table(['Rank', 'Medicine', 'CDC class', 'CDC wording'], e.flags_outside_uk_and_canada.medicines.map((m) => [m.rank, m.ingredient, m.cdc.map((c) => c.label).join('; '), m.cdc.map((c) => c.quote).join(' | ')])));
  frag.append(outside);

  // 3. Agreement with each answer key.
  const agree = el('section', { 'aria-labelledby': 'agreeHeading' });
  agree.append(el('h2', { id: 'agreeHeading' }, [document.createTextNode('Agreement with the UK and Canada'), infoButton('evidence_agreement')]));
  agree.append(el('div', { class: 'tiles' }, [
    tile(pct(e.agreement.ukhsa.rate), `agree with UKHSA (${n(e.agreement.ukhsa.agree)} of ${n(e.agreement.ukhsa.total)})`, 'badge_ukhsa'),
    tile(pct(e.agreement.health_canada.rate), `agree with Health Canada (${n(e.agreement.health_canada.agree)} of ${n(e.agreement.health_canada.total)})`, 'badge_health_canada'),
  ]));
  agree.append(el('p', { class: 'small muted', text: `This site flagged ${n(e.counts.app_flagged)} of ${n(e.counts.resolved)}; UKHSA's list covers ${n(e.counts.ukhsa_listed)}; Health Canada's covers ${n(e.counts.health_canada_listed)}. "Agree" means both flag it or both do not.` }));
  if (e.counts.resolved_without_atc) {
    agree.append(el('details', { class: 'small' }, [
      el('summary', { text: `${n(e.counts.resolved_without_atc)} medicines resolved with no drug-class code from RxClass, so only name rules could apply` }),
      el('p', { text: (e.counts.resolved_without_atc_names ?? []).join(', ') }),
    ]));
  }
  frag.append(agree);

  // 4. Every disagreement, both directions, with a reason.
  const dis = el('section', { 'aria-labelledby': 'disHeading' });
  dis.append(el('h2', { id: 'disHeading', text: `Every disagreement: ${n(e.disagreements.length)}` }));
  dis.append(el('p', { class: 'small muted', text: 'Failures are shown, not hidden. Each row names the medicine, the direction, and the one-line reason from the mapping.' }));
  const keyName = (k) => (k === 'ukhsa' ? 'UKHSA' : 'Health Canada');
  dis.append(table(['Rank', 'Medicine', 'Guidance', 'Direction', 'Reason'], e.disagreements.map((d) => [d.rank, d.ingredient, keyName(d.key), d.direction, d.reason])));
  frag.append(dis);

  // 5. The mapping tables, so anyone can disagree with them.
  const map = el('section', { 'aria-labelledby': 'mapHeading' });
  map.append(el('h2', { id: 'mapHeading', text: 'How each guidance phrase was mapped' }));
  map.append(el('p', { class: 'small muted', text: 'These mappings decide the numbers above. They were committed before the first run so they could not be tuned to the results. Ambiguous phrases take the narrower reading.' }));
  for (const [k, key] of Object.entries(e.answer_keys)) {
    if (!key.phrases?.length) continue;
    const d = el('details');
    d.append(el('summary', {}, [document.createTextNode(`${key.title} `), el('a', { href: key.url, target: '_blank', rel: 'noopener', class: 'small', text: '(source)' })]));
    d.append(table(['Guidance phrase', 'Mapped to', 'Reason'], key.phrases.map((p) => [p.phrase, [...(p.atc_prefixes ?? []), ...((p.ingredients ?? []).length ? [`by name: ${p.ingredients.join(', ')}`] : [])].join(', '), p.reason])));
    map.append(d);
  }
  if (e.answer_keys.ansm) {
    map.append(el('p', { class: 'small' }, [el('strong', { text: 'France (ANSM), context only. ' }), document.createTextNode(e.answer_keys.ansm.why_not_scored), infoButton('ansm')]));
  }
  frag.append(map);

  // 6. Limitation, test set, and sources.
  const lim = el('section', { class: 'card' });
  lim.append(el('p', {}, [el('strong', { text: e.limitation })]));
  lim.append(el('p', { class: 'small' }, [el('strong', { text: 'Test set: ' }), document.createTextNode(`${e.test_set.title}, derived ${e.test_set.derived_on} from `), el('a', { href: e.test_set.source.url, target: '_blank', rel: 'noopener', text: e.test_set.source.title }), infoButton('top300')]));
  lim.append(el('ul', { class: 'small muted' }, e.test_set.method.map((m) => el('li', { text: m }))));
  frag.append(lim);

  // 7. Every row, for anyone who wants to check a specific medicine.
  const all = el('details', { class: 'all-rows' });
  all.append(el('summary', { text: `All ${n(e.rows.length)} medicines, with what each list says` }));
  all.append(table(['Rank', 'Medicine', 'ATC', 'This site', 'UKHSA', 'Health Canada', 'CDC class'], e.rows.map((r) => [
    r.rank, r.ingredient, (r.atc ?? []).join(' '),
    r.status !== 'resolved' ? 'not resolved' : r.app_flags ? 'flags' : r.storage_only ? 'storage note' : r.sun_only ? 'sun note' : 'not listed',
    r.ukhsa === null ? '' : r.ukhsa ? 'lists' : 'no', r.health_canada === null ? '' : r.health_canada ? 'lists' : 'no',
    (r.cdc_classes ?? []).map((c) => c.label).join('; '),
  ])));
  frag.append(all);

  return frag;
}
