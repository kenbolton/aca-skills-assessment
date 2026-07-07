// The only IndexedDB code in the app. The archive is the single source of
// truth: every session (including the one being rated) is a record keyed by
// its id. The "which is open" pointer is a tiny localStorage value, kept out
// of the durable store on purpose.
import { sessionSummary } from './session-summary.js';
import { isV3Session } from './session.js';

const DB = 'aca-assessment';
const STORE = 'sessions';
const LEGACY_KEY = 'aca-assessment:session';
const CURRENT_KEY = 'aca-assessment:current';

let dbPromise = null;
let dbInstance = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => { dbInstance = req.result; resolve(req.result); };
    req.onerror = () => reject(req.error);
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

export async function putSession(session) { await reqP((await store('readwrite')).put(session)); }
export async function getSession(id) { return (await reqP((await store('readonly')).get(id))) || null; }
export async function deleteSession(id) { await reqP((await store('readwrite')).delete(id)); }
export async function getAllSessions() { return (await reqP((await store('readonly')).getAll())) || []; }
export const exportAll = getAllSessions;

export async function listSummaries() {
  const all = await getAllSessions();
  return all.map(sessionSummary)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export async function importSessions(input) {
  const arr = Array.isArray(input) ? input : [input];
  let n = 0;
  for (const s of arr) {
    if (isV3Session(s) && typeof s.id === 'string') { await putSession(s); n++; }
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
