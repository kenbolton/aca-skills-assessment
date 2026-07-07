import 'fake-indexeddb/auto';
import { beforeEach, expect, test } from 'vitest';
import {
  initStore, putSession, getSession, deleteSession, listSummaries, exportAll,
  importSessions, getCurrentId, setCurrentId, migrateLegacy, resetStore,
  dehydrate, hydrate, getSkillSet,
  exportBundle, importBundle, putSkillSet,
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

test('putSession stores a slim session; getSession returns the fat original', async () => {
  const s = sess('a', '2026-01-01');       // sess(...) builds a fat session via createSession
  await putSession(s);
  expect(await getSession('a')).toEqual(s); // fat round-trip, deep-equal
});

test('dehydrate strips the blob into skillSets; hydrate restores it', async () => {
  const s = sess('a', '2026-01-01');
  const slim = await dehydrate(s);
  expect(slim.skills).toBeUndefined();
  expect(typeof slim.skillSetRef).toBe('string');
  expect(await getSkillSet(slim.skillSetRef)).toEqual({ skills: s.skills, scales: s.scales, intro: s.intro ?? null });
  expect(await hydrate(slim)).toEqual(s);
});

test('two sessions of the same config dedup to one skillSet ref', async () => {
  const a = await dehydrate(sess('a', '2026-01-01'));
  const b = await dehydrate(sess('b', '2026-01-02'));
  expect(a.skillSetRef).toBe(b.skillSetRef); // same config -> same content hash -> one stored blob
});

test('hydrate leaves a fat/legacy session unchanged and does not throw on a missing ref', async () => {
  const fat = sess('a', '2026-01-01');
  expect(await hydrate(fat)).toBe(fat);                       // already fat -> identity
  expect(await hydrate({ id: 'x', skillSetRef: 'sk-deadbeef' })).toEqual({ id: 'x', skillSetRef: 'sk-deadbeef' }); // missing blob -> unchanged
});

// Raw session put/get that bypass dehydrate/hydrate, to simulate a legacy fat
// record and to inspect what is actually stored.
function rawSessionOp(mode, fn) {
  return new Promise((res, rej) => {
    const open = indexedDB.open('aca-assessment', 2);
    // Mirror store.js's openDb schema: a raw open with no upgrade handler
    // would otherwise create an empty, store-less database when this runs
    // before store.js has opened one (e.g. rawPut before any putSession).
    open.onupgradeneeded = () => {
      const db = open.result;
      if (!db.objectStoreNames.contains('sessions')) db.createObjectStore('sessions', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('skillSets')) db.createObjectStore('skillSets', { keyPath: 'ref' });
    };
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction('sessions', mode);
      const out = fn(tx.objectStore('sessions'));
      tx.oncomplete = () => { db.close(); res(out && out.result !== undefined ? out.result : undefined); };
      tx.onerror = () => { db.close(); rej(tx.error); };
    };
    open.onerror = () => rej(open.error);
  });
}
const rawPut = (rec) => rawSessionOp('readwrite', (s) => s.put(rec));
const rawGet = (id) => rawSessionOp('readonly', (s) => s.get(id));

test('exportBundle returns a slim, self-contained bundle; dedups shared blobs', async () => {
  await putSession(sess('a', '2026-01-01'));
  await putSession(sess('b', '2026-01-02')); // same config -> same skillSet
  const b = await exportBundle();
  expect(b.format).toBe('aca-archive-v2');
  expect(b.sessions.map(s => s.id).sort()).toEqual(['a', 'b']);
  expect(b.sessions.every(s => !s.skills && typeof s.skillSetRef === 'string')).toBe(true);
  expect(Object.keys(b.skillSets)).toHaveLength(1); // dedup: one shared blob
  expect(b.skillSets[b.sessions[0].skillSetRef]).toBeTruthy();
});

test('exportBundle([id]) returns just that session and its blob', async () => {
  await putSession(sess('a', '2026-01-01'));
  await putSession(sess('b', '2026-01-02'));
  const b = await exportBundle(['a']);
  expect(b.sessions.map(s => s.id)).toEqual(['a']);
  expect(Object.keys(b.skillSets)).toHaveLength(1);
});

test('exportBundle slims a legacy-fat record in-memory without mutating the store', async () => {
  const fat = sess('a', '2026-01-01');           // fat (built by createSession)
  await rawPut(fat);                              // stored fat, bypassing dehydrate
  const b = await exportBundle();
  expect(b.sessions[0].skills).toBeUndefined();   // slim in the bundle
  expect(typeof b.sessions[0].skillSetRef).toBe('string');
  expect((await rawGet('a')).skills).toBeTruthy(); // still fat in the store
});

test('importBundle round-trips: export -> clear -> import -> fat again', async () => {
  await putSession(sess('a', '2026-01-01'));
  const original = await getSession('a');
  const b = await exportBundle();
  // clear the DB
  resetStore();
  await new Promise((r) => { const d = indexedDB.deleteDatabase('aca-assessment'); d.onsuccess = d.onerror = () => r(); });
  expect(await importBundle(b)).toBe(1);
  expect(await getSession('a')).toEqual(original);
});

test('importSessions accepts a slim session when its blob is present, and still accepts fat', async () => {
  // fat import stores session 'a' (as slim internally, via dehydrate)
  expect(await importSessions(sess('a', '2026-01-01'))).toBe(1);
  // slim import: take 'a' as a slim session + its blob, ensure the blob is stored, re-import
  const bundle = await exportBundle(['a']);
  const slim = bundle.sessions[0];
  const blobRef = slim.skillSetRef;
  await putSkillSet(blobRef, bundle.skillSets[blobRef]);
  expect(await importSessions({ ...slim })).toBe(1);
  // a slim session missing results is skipped by the gate
  expect(await importSessions({ id: 'z', paddlers: [{ target: 'L3' }], skillSetRef: blobRef })).toBe(0);
});
