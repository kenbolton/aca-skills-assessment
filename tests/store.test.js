import 'fake-indexeddb/auto';
import { beforeEach, expect, test } from 'vitest';
import {
  initStore, putSession, getSession, deleteSession, listSummaries, exportAll,
  importSessions, getCurrentId, setCurrentId, migrateLegacy, resetStore,
} from '../src/lib/store.js';
import { createSession } from '../src/lib/session.js';

const config = { scales: { L3: [{ value: 'meets', label: 'Meets' }] },
  skills: [{ id: 's1', level: 'L3', category: 'C', standard: 'x', optional: false }] };
const sess = (id, createdAt) => createSession({ id, createdAt, config, paddlers: [{ name: 'A', target: 'L3' }] });

// The vitest `node` environment (unlike jsdom) has no global `localStorage`;
// Node's own experimental one needs a `--localstorage-file` flag we don't set.
// Match the shim pattern already used in tests/session.test.js so the brief's
// `localStorage.clear()`/`setItem`/`getItem` calls have something to talk to.
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

test('put/get round-trip and delete', async () => {
  await putSession(sess('a', '2026-01-01'));
  expect((await getSession('a')).id).toBe('a');
  await deleteSession('a');
  expect(await getSession('a')).toBe(null);
});

test('listSummaries returns all, newest createdAt first', async () => {
  await putSession(sess('a', '2026-01-01'));
  await putSession(sess('b', '2026-03-01'));
  await putSession(sess('c', '2026-02-01'));
  expect((await listSummaries()).map(s => s.id)).toEqual(['b', 'c', 'a']);
});

test('importSessions accepts one or a bundle, upserts by id (idempotent), skips invalid', async () => {
  expect(await importSessions(sess('a', '2026-01-01'))).toBe(1);
  expect(await importSessions([sess('a', '2026-01-01'), sess('b', '2026-01-02'), { junk: true }])).toBe(2);
  const ids = (await exportAll()).map(s => s.id).sort();
  expect(ids).toEqual(['a', 'b']); // 'a' upserted, not duplicated
});

test('current pointer is a simple localStorage value', () => {
  expect(getCurrentId()).toBe(null);
  setCurrentId('x'); expect(getCurrentId()).toBe('x');
  setCurrentId(null); expect(getCurrentId()).toBe(null);
});

test('migrateLegacy moves a legacy session into the store, sets current, clears the key', async () => {
  localStorage.setItem('aca-assessment:session', JSON.stringify(sess('leg', '2026-01-01')));
  await migrateLegacy();
  expect((await getSession('leg')).id).toBe('leg');
  expect(getCurrentId()).toBe('leg');
  expect(localStorage.getItem('aca-assessment:session')).toBe(null);
});

test('initStore runs migration', async () => {
  localStorage.setItem('aca-assessment:session', JSON.stringify(sess('leg', '2026-01-01')));
  await initStore();
  expect((await getSession('leg')).id).toBe('leg');
});

test('importSessions rejects a v3-shaped session missing results/skills', async () => {
  const bad = { id: 'x', paddlers: [{ target: 'L3' }] };
  expect(await importSessions(bad)).toBe(0);
  expect(await getSession('x')).toBe(null);
});

test('listSummaries skips a malformed record instead of throwing', async () => {
  await putSession({ id: 'bad', paddlers: [{ target: 'L3' }] });
  await putSession(sess('good', '2026-01-01'));
  const rows = await listSummaries();
  expect(rows.map(r => r.id)).toEqual(['good']);
});
