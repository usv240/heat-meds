// Evidence page: renders data/evidence.json. Nothing here is typed by hand.
// Slice 5 ships the "not yet" state; slice 7 adds the full rendering once the runner exists.

import { initTheme } from './theme.js';
import { el } from './plan-render.js';
import { loadGlossary, infoButton } from './info.js';

initTheme();

const area = document.getElementById('evidenceArea');

async function run() {
  await loadGlossary();
  const res = await fetch('data/evidence.json', { cache: 'no-cache' }).catch(() => null);
  if (!res || !res.ok) {
    area.replaceChildren(el('p', { class: 'note' }, [
      document.createTextNode('No evidence run has been published yet. The test set is the 300 most-prescribed US medicines'),
      infoButton('top300'),
      document.createTextNode(', scored against the UK and Canadian guidance as answer keys'),
      infoButton('answer_keys'),
      document.createTextNode('.'),
    ]));
    return;
  }
  const data = await res.json();
  const { renderEvidence } = await import('./evidence-render.js');
  area.replaceChildren(renderEvidence(data));
}

run().catch((err) => {
  console.error(err);
  area.replaceChildren(el('p', { class: 'note', text: 'The evidence file could not be read.' }));
});
