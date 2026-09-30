// Turns data into DOM. Slice 1: the heat week and notes. Later slices add the plan sections.

import { levelInfo, weekdayLabel, shortDateLabel } from './heatrisk.js';

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (v !== null && v !== undefined) node.setAttribute(k, v);
  }
  for (const c of children) node.append(c);
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
