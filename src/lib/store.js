// The only IndexedDB code in the app. The archive is the single source of
// truth: every session (including the one being rated) is a record keyed by
// its id. The "which is open" pointer is a tiny localStorage value, kept out
// of the durable store on purpose.
import { sessionSummary } from './session-summary.js';
import { isV3Session } from './session.js';
import { skillSetRef, blobOf, isSlim, slimSession, fattenSession } from './skillset.js';

const DB = 'aca-assessment';
const STORE = 'sessions';
const SKILLSETS = 'skillSets';
const LEGACY_KEY = 'aca-assessment:session';
const CURRENT_KEY = 'aca-assessment:current';

let dbPromise = null;
let dbInstance = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(SKILLSETS)) db.createObjectStore(SKILLSETS, { keyPath: 'ref' });
    };
    req.onsuccess = () => { dbInstance = req.result; resolve(req.result); };
    req.onerror = () => { dbPromise = null; reject(req.error); };
  });
  return dbPromise;
}

// Drops the cached handle so tests can reopen a freshly-deleted database.
// Closing the live connection (when one is open) matters for test isolation:
// a stale open connection makes `indexedDB.deleteDatabase()` block forever
// waiting for it to close, rather than resolving.
export function resetStore() {
  if (dbInstance) { try { dbInstance.close(); } catch { /* already closed */ } }
  dbPromise = null;
  dbInstance = null;
}

function reqP(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function store(mode) {
  const db = await openDb();
  return db.transaction(STORE, mode).objectStore(STORE);
}
async function skillStore(mode) {
  const db = await openDb();
  return db.transaction(SKILLSETS, mode).objectStore(SKILLSETS);
}

export async function putSkillSet(ref, blob) {
  await reqP((await skillStore('readwrite')).put({ ref, blob }));
}
export async function getSkillSet(ref) {
  const rec = await reqP((await skillStore('readonly')).get(ref));
  return rec ? rec.blob : null;
}

// Persist boundary: strip the shared blob out to the skillSets store.
export async function dehydrate(session) {
  if (isSlim(session) || !session.skills) return session;
  const blob = blobOf(session);
  const ref = skillSetRef(blob);
  await putSkillSet(ref, blob);
  return slimSession(session, ref);
}
// Read boundary: re-attach the blob so callers see a fat session.
export async function hydrate(session) {
  if (!session || session.skills || !session.skillSetRef) return session;
  const blob = await getSkillSet(session.skillSetRef);
  if (!blob) { console.warn('skillSet missing for session', session.id); return session; }
  return fattenSession(session, blob);
}

export async function putSession(session) {
  const rec = await dehydrate(session); // resolve before opening the write transaction: IndexedDB
  await reqP((await store('readwrite')).put(rec)); // auto-commits it if a prior await yields first
}
export async function getSession(id) {
  const rec = (await reqP((await store('readonly')).get(id))) || null;
  return rec ? hydrate(rec) : null;
}
export async function deleteSession(id) { await reqP((await store('readwrite')).delete(id)); }
export async function getAllSessions() {
  const all = (await reqP((await store('readonly')).getAll())) || [];
  return Promise.all(all.map(hydrate));
}
export const exportAll = getAllSessions;

export async function listSummaries() {
  const all = await getAllSessions();
  return all
    .map(s => { try { return sessionSummary(s); } catch { return null; } })
    .filter(Boolean)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export async function importSessions(input) {
  const arr = Array.isArray(input) ? input : [input];
  let n = 0;
  for (const s of arr) {
    if (isV3Session(s) && typeof s.id === 'string' && Array.isArray(s.results) && Array.isArray(s.skills)) {
      await putSession(s); n++;
    }
  }
  return n;
}

export function getCurrentId() {
  try { return localStorage.getItem(CURRENT_KEY); } catch { return null; }
}
export function setCurrentId(id) {
  try { id == null ? localStorage.removeItem(CURRENT_KEY) : localStorage.setItem(CURRENT_KEY, id); }
  catch { /* storage unavailable */ }
}

// Drain a legacy single-session localStorage entry into the archive. This both
// migrates an existing user's session and lands the Pi "Resume" (which writes
// this same key before loading the app) into the archive.
export async function migrateLegacy() {
  let raw = null;
  try { raw = localStorage.getItem(LEGACY_KEY); } catch { return; }
  if (!raw) return;
  try {
    const s = JSON.parse(raw);
    if (isV3Session(s) && typeof s.id === 'string') { await putSession(s); setCurrentId(s.id); }
  } catch { /* malformed — drop it */ }
  try { localStorage.removeItem(LEGACY_KEY); } catch { /* ignore */ }
}

export async function initStore() { await openDb(); await migrateLegacy(); }
