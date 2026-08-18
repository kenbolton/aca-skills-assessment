import 'fake-indexeddb/auto';
import { beforeEach, expect, test } from 'vitest';
import { initStore, resetStore } from '../src/lib/store.js';

if (typeof globalThis.localStorage === 'undefined') {
  const map = new Map();
  globalThis.localStorage = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
  };
}

beforeEach(async () => {
  resetStore();
  await new Promise((res) => { const r = indexedDB.deleteDatabase('aca-assessment'); r.onsuccess = r.onerror = () => res(); });
  try { localStorage.clear(); } catch { /* node */ }
});

// The boot-hang: an open connection at an older schema version blocks a newer
// tab's upgrade, and (without an onblocked handler) the open promise never
// settles — "Loading…" forever. The fix releases this tab's connection on
// versionchange, so a newer-version open proceeds instead of blocking.
test('an open store connection releases for a newer-version open (no block)', async () => {
  await initStore(); // holds a v3 connection with an onversionchange handler

  const result = await new Promise((resolve) => {
    const req = indexedDB.open('aca-assessment', 4); // "another tab" upgrading
    req.onupgradeneeded = () => { /* v4 schema no-op */ };
    req.onsuccess = () => { req.result.close(); resolve('success'); };
    req.onblocked = () => resolve('blocked');
    req.onerror = () => resolve('error');
  });

  expect(result).toBe('success'); // not 'blocked'
});
