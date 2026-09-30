// The only place anything is stored: this browser's localStorage.
// See spec.md > Components > Local storage. Nothing is sent to a server of ours.

const KEYS = {
  zip: 'heatmeds.zip',
  list: 'heatmeds.list',
};

function safeGet(key) {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function safeSet(key, value) {
  try {
    if (value === null || value === undefined) globalThis.localStorage?.removeItem(key);
    else globalThis.localStorage?.setItem(key, value);
  } catch {
    // Storage may be disabled; the app still works for this visit.
  }
}

export function getZip() {
  return safeGet(KEYS.zip) ?? '';
}

export function setZip(zip) {
  safeSet(KEYS.zip, zip ? String(zip).trim() : null);
}

export function getList() {
  const raw = safeGet(KEYS.list);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function setList(list) {
  safeSet(KEYS.list, Array.isArray(list) && list.length ? JSON.stringify(list) : null);
}

export function clearAll() {
  safeSet(KEYS.zip, null);
  safeSet(KEYS.list, null);
}
