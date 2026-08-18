// The only IndexedDB code in the app. The archive is the single source of
// truth: every session (including the one being rated) is a record keyed by
// its id. The "which is open" pointer is a tiny localStorage value, kept out
// of the durable store on purpose.
import { sessionSummary } from './session-summary.js';
import { isV3Session } from './session.js';
import { skillSetRef, blobOf, isSlim, slimSession, fattenSession, BUNDLE_FORMAT } from './skillset.js';
import { learnerKey, LOCAL_LEARNER } from './top-tips.js';

const DB = 'aca-assessment';
const STORE = 'sessions';
const SKILLSETS = 'skillSets';
const TIPCHECKS = 'tipChecks';
const LEGACY_KEY = 'aca-assessment:session';
const LEGACY_PRACTICE_NAME = 'aca-assessment:practice-name';
const TIP_OWNER_MIGRATED = 'aca-assessment:tips-local';
const CURRENT_KEY = 'aca-assessment:current';

let dbPromise = null;
let dbInstance = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 3);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(SKILLSETS)) db.createObjectStore(SKILLSETS, { keyPath: 'ref' });
      // v3: per-learner Top Tips progress, keyed by normalized learner name.
      if (!db.objectStoreNames.contains(TIPCHECKS)) db.createObjectStore(TIPCHECKS, { keyPath: 'learnerKey' });
    };
    req.onsuccess = () => {
      const db = req.result;
      // If another tab opens a newer schema version, release this connection so
      // we never block its upgrade. Without this, an older tab left open wedges
      // the newer tab on "Loading…" forever (the boot-hang).
      db.onversionchange = () => { try { db.close(); } catch { /* already closed */ } resetStore(); };
      dbInstance = db;
      resolve(db);
    };
    req.onerror = () => { dbPromise = null; reject(req.error); };
    // A blocked upgrade (an older tab holding the DB open) would otherwise leave
    // this promise pending forever. Fail fast with a clear, actionable error so
    // the app can tell the user to close other tabs and reload — never hang.
    req.onblocked = () => {
      dbPromise = null;
      reject(new Error('Storage is open in another tab of this app. Close the other tab and reload.'));
    };
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

function readLocal(key) { try { return localStorage.getItem(key); } catch { return null; } }
function writeLocal(key, value) { try { localStorage.setItem(key, value); } catch { /* storage off */ } }
function removeLocal(key) { try { localStorage.removeItem(key); } catch { /* storage off */ } }

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
async function tipStore(mode) {
  const db = await openDb();
  return db.transaction(TIPCHECKS, mode).objectStore(TIPCHECKS);
}

// Top Tips progress for one learner: { learnerKey, checks: { [skillId]: [tipId] } }.
// Returns an empty record (never null) so callers can read straight away.
export async function getTipChecks(learnerKey) {
  const rec = await reqP((await tipStore('readonly')).get(learnerKey));
  return rec || { learnerKey, checks: {} };
}
export async function putTipChecks(record) {
  await reqP((await tipStore('readwrite')).put(record));
}

// Fold name-keyed tip progress into the local owner's record. Two things used
// to key mastery by a name: the "Practising as" field on Skills & Tips, and a
// self-assessment (keyed by its one paddler). Both now write to LOCAL_LEARNER,
// so without this their progress would be stranded under the old key. Runs
// once, unions per technique, and drops each source record.
export async function migrateTipOwners() {
  if (readLocal(TIP_OWNER_MIGRATED)) return;
  const legacy = new Set();
  const name = readLocal(LEGACY_PRACTICE_NAME);
  if (name && name.trim()) legacy.add(learnerKey(name));
  for (const s of await getAllSessions()) {
    if (s.selfAssessment && (s.paddlers || []).length === 1) legacy.add(learnerKey(s.paddlers[0].name));
  }
  legacy.delete(LOCAL_LEARNER);
  legacy.delete('');
  if (legacy.size) {
    const local = await getTipChecks(LOCAL_LEARNER);
    const checks = { ...(local.checks || {}) };
    for (const key of legacy) {
      const rec = await getTipChecks(key);
      for (const [technique, ids] of Object.entries(rec.checks || {})) {
        checks[technique] = [...new Set([...(checks[technique] || []), ...ids])];
      }
      await reqP((await tipStore('readwrite')).delete(key));
    }
    await putTipChecks({ learnerKey: LOCAL_LEARNER, checks });
  }
  removeLocal(LEGACY_PRACTICE_NAME);
  writeLocal(TIP_OWNER_MIGRATED, '1');
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
    if (isV3Session(s) && typeof s.id === 'string' && Array.isArray(s.results)
        && (Array.isArray(s.skills) || typeof s.skillSetRef === 'string')) {
      await putSession(s); n++;
    }
  }
  return n;
}

// A self-contained slim bundle for the given session ids (all when omitted):
// slim sessions plus exactly the skillSet blobs they reference. A legacy-fat
// stored record is slimmed in-memory here (no store write).
export async function exportBundle(ids) {
  const raw = (await reqP((await store('readonly')).getAll())) || [];
  const selected = ids ? raw.filter(s => ids.includes(s.id)) : raw;
  const skillSets = {};
  const sessions = [];
  for (const s of selected) {
    if (s.skills) {
      const blob = blobOf(s);
      const ref = skillSetRef(blob);
      skillSets[ref] = blob;
      sessions.push(slimSession(s, ref));
    } else {
      sessions.push(s);
      if (s.skillSetRef && !skillSets[s.skillSetRef]) {
        const blob = await getSkillSet(s.skillSetRef);
        if (blob) skillSets[s.skillSetRef] = blob;
      }
    }
  }
  return { format: BUNDLE_FORMAT, sessions, skillSets };
}

// Import a slim bundle: store its blobs first, then its (slim) sessions.
export async function importBundle(bundle) {
  for (const [ref, blob] of Object.entries((bundle && bundle.skillSets) || {})) {
    await putSkillSet(ref, blob);
  }
  return importSessions((bundle && bundle.sessions) || []);
}

export function getCurrentId() {
  try { return localStorage.getItem(CURRENT_KEY); } catch { return null; }
}
export function setCurrentId(id) {
  try { id == null ? localStorage.removeItem(CURRENT_KEY) : localStorage.setItem(CURRENT_KEY, id); }
  catch { /* storage unavailable */ }
}

// Drain a legacy single-session localStorage entry into the archive. This both
// migrates an existing user's session and lands the server-side "Resume" (which
// writes this same key before loading the app) into the archive.
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

// The tip-owner migration is best-effort: a single unreadable session must not
// keep the app on "Loading…".
export async function initStore() {
  await openDb();
  await migrateLegacy();
  await migrateTipOwners().catch(err => console.error('tip owner migration skipped', err));
}
