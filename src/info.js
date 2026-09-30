// Small "i" buttons that open a three-part note: what it is, why it matters, source.
// Plain HTML, keyboard reachable (button + dialog-like panel), hidden in print.

import { el } from './plan-render.js';

let glossary = null;

export async function loadGlossary() {
  if (glossary) return glossary;
  try {
    const res = await fetch('data/glossary.json', { cache: 'force-cache' });
    glossary = res.ok ? (await res.json()).entries : {};
  } catch {
    glossary = {};
  }
  return glossary;
}

let openPanel = null;

function closeOpen() {
  if (!openPanel) return;
  openPanel.panel.remove();
  openPanel.button.setAttribute('aria-expanded', 'false');
  openPanel = null;
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && openPanel) {
    const btn = openPanel.button;
    closeOpen();
    btn.focus();
  }
});

document.addEventListener('click', (e) => {
  if (openPanel && !openPanel.panel.contains(e.target) && e.target !== openPanel.button) closeOpen();
});

// Returns a button element. `entry` may be a glossary key or an inline { term, what, why, source_title, source_url }.
export function infoButton(entry) {
  const data = typeof entry === 'string' ? glossary?.[entry] : entry;
  if (!data) return document.createTextNode('');
  const btn = el('button', { type: 'button', class: 'info-btn no-print', 'aria-label': `About ${data.term}`, 'aria-expanded': 'false', text: 'i' });
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (openPanel && openPanel.button === btn) { closeOpen(); return; }
    closeOpen();
    const panel = el('div', { class: 'info-panel no-print', role: 'dialog', 'aria-label': data.term, tabindex: '-1' });
    panel.append(el('h4', { text: data.term }));
    panel.append(el('p', {}, [el('strong', { text: 'What it is. ' }), document.createTextNode(data.what)]));
    panel.append(el('p', {}, [el('strong', { text: 'Why it matters. ' }), document.createTextNode(data.why)]));
    if (data.quote) panel.append(el('p', { class: 'small' }, [el('strong', { text: 'CDC wording: ' }), el('q', { text: data.quote })]));
    panel.append(el('p', { class: 'small' }, [el('strong', { text: 'Source: ' }), el('a', { href: data.source_url, target: data.source_url.startsWith('http') ? '_blank' : null, rel: 'noopener', text: data.source_title }), data.checked_on ? document.createTextNode(` (checked ${data.checked_on})`) : null]));
    const close = el('button', { type: 'button', class: 'secondary info-close', text: 'Close' });
    close.addEventListener('click', () => { closeOpen(); btn.focus(); });
    panel.append(close);
    btn.insertAdjacentElement('afterend', panel);
    btn.setAttribute('aria-expanded', 'true');
    openPanel = { button: btn, panel };
    panel.focus();
  });
  return btn;
}

// Builds an inline entry from a card's CDC source, so the "i" on a card shows the exact quote.
export function sourceEntry(term, source, what, why) {
  return {
    term,
    what,
    why,
    quote: source?.quote ?? null,
    checked_on: source?.checked_on ?? null,
    source_title: 'CDC, Heat and Medications: Guidance for Clinicians',
    source_url: source?.url ?? 'https://www.cdc.gov/heat-health/hcp/clinical-guidance/heat-and-medications-guidance-for-clinicians.html',
  };
}
