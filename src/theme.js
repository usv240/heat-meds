// Light and dark mode: follows the system, with a visible toggle that is remembered.

const KEY = 'heatmeds.theme';

export function initTheme(buttonId = 'themeToggle') {
  const root = document.documentElement;
  let saved = null;
  try { saved = localStorage.getItem(KEY); } catch { /* ignore */ }
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const apply = (t) => {
    root.setAttribute('data-theme', t);
    const btn = document.getElementById(buttonId);
    if (btn) btn.textContent = t === 'dark' ? 'Light mode' : 'Dark mode';
  };
  apply(saved || (prefersDark ? 'dark' : 'light'));
  const btn = document.getElementById(buttonId);
  if (btn) {
    btn.addEventListener('click', () => {
      const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      apply(next);
      try { localStorage.setItem(KEY, next); } catch { /* ignore */ }
    });
  }
}
