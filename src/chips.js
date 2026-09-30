// Medicine entry and chips: checking, resolved, did-you-mean, suggestions, not recognized.
// See spec.md > Components > Medicine entry and chips. Only resolved chips are saved.

import { resolveMedicine, acceptCandidate } from './rxnorm.js';
import { classifyMedicine } from './rxclass.js';
import { getList, setList } from './storage.js';
import { el } from './plan-render.js';

let savedLookups = null;
async function loadSaved() {
  if (savedLookups) return savedLookups;
  try {
    const res = await fetch('data/saved-lookups.json', { cache: 'force-cache' });
    savedLookups = res.ok ? await res.json() : { lookups: {} };
  } catch {
    savedLookups = { lookups: {} };
  }
  return savedLookups;
}

function ingredientLabel(med) {
  return (med.ingredients ?? []).map((i) => i.base_name && i.base_name !== i.name ? i.name : i.name).join(' + ');
}

function chipLabel(med) {
  const ings = ingredientLabel(med);
  const typed = med.input ?? '';
  if (!ings) return typed;
  if (typed.toLowerCase() === ings.toLowerCase()) return ings;
  return `${typed} → ${ings}`;
}

export function initChips({ listId = 'chips', inputId = 'medicine', addId = 'addMedicine', submitId = 'seePlan', statusId = 'chipStatus' } = {}) {
  const listEl = document.getElementById(listId);
  const input = document.getElementById(inputId);
  const addBtn = document.getElementById(addId);
  const submitBtn = document.getElementById(submitId);
  const statusEl = document.getElementById(statusId);

  // chips: [{ id, med }] where med is a resolveMedicine result (any status)
  let chips = getList().map((med, i) => ({ id: `saved-${i}`, med }));
  let nextId = chips.length;

  function persist() {
    setList(chips.filter((c) => c.med.status === 'resolved').map((c) => c.med));
    const resolved = chips.filter((c) => c.med.status === 'resolved').length;
    if (submitBtn) submitBtn.disabled = resolved === 0;
    if (statusEl) {
      statusEl.textContent = resolved === 0
        ? 'Add at least one medicine to see a plan.'
        : `${resolved} medicine${resolved === 1 ? '' : 's'} ready.`;
    }
  }

  function remove(id) {
    chips = chips.filter((c) => c.id !== id);
    render();
  }

  async function finishResolve(chip, med) {
    if (med.status === 'resolved') await classifyMedicine(med);
    chip.med = med;
    render();
  }

  function renderChip(chip) {
    const med = chip.med;
    const li = el('li', { class: `chip chip-${med.status}` });
    const removeBtn = el('button', { type: 'button', class: 'chip-remove', 'aria-label': `Remove ${med.input}`, text: 'Remove' });
    removeBtn.addEventListener('click', () => remove(chip.id));

    if (med.status === 'checking') {
      li.append(el('span', { class: 'chip-text', text: `${med.input}: checking` }));
    } else if (med.status === 'resolved') {
      li.append(el('span', { class: 'chip-text', text: chipLabel(med) }));
      if (med.saved) li.append(el('span', { class: 'chip-note', text: 'saved lookup' }));
      if ((med.ingredients ?? []).length > 1) li.append(el('span', { class: 'chip-note', text: 'one pill, two ingredients' }));
    } else if (med.status === 'did_you_mean') {
      li.append(el('span', { class: 'chip-text', text: `${med.input}: did you mean ${med.candidate.label}?` }));
      const yes = el('button', { type: 'button', class: 'chip-yes', text: 'Yes' });
      yes.addEventListener('click', async () => {
        chip.med = { ...med, status: 'checking' };
        render();
        await finishResolve(chip, acceptCandidate(med));
      });
      li.append(yes);
    } else if (med.status === 'suggestions') {
      li.append(el('span', { class: 'chip-text', text: `${med.input}: not found. Did you mean:` }));
      for (const s of med.suggestions) {
        const b = el('button', { type: 'button', class: 'chip-yes', text: s });
        b.addEventListener('click', async () => {
          chip.med = { ...med, status: 'checking', input: s };
          render();
          await finishResolve(chip, await resolveMedicine(s, { savedLookups: await loadSaved() }));
        });
        li.append(b);
      }
    } else if (med.status === 'error') {
      li.append(el('span', { class: 'chip-text', text: `${med.input}: could not check right now. Try again in a minute.` }));
    } else {
      li.append(el('span', { class: 'chip-text', text: `${med.input}: not recognized` }));
    }
    li.append(removeBtn);
    return li;
  }

  function render() {
    listEl.replaceChildren(...chips.map(renderChip));
    persist();
  }

  async function add(text) {
    const value = String(text ?? '').trim();
    if (!value) return;
    const chip = { id: `c${nextId++}`, med: { input: value, status: 'checking', ingredients: [], suggestions: [] } };
    chips.push(chip);
    render();
    input.value = '';
    input.focus();
    const med = await resolveMedicine(value, { savedLookups: await loadSaved() });
    await finishResolve(chip, med);
  }

  addBtn.addEventListener('click', () => add(input.value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      add(input.value);
    }
  });

  render();
  return { add, getChips: () => chips };
}
