# On-Device Assessment Archive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-session localStorage model with a local IndexedDB archive of many assessments, plus an in-app Archive screen (list · resume · delete · per-session export · export-all · import). Universal (both builds).

**Architecture:** A new async `store.js` is the only IndexedDB code (sessions object store keyed by `id`; `currentId` in localStorage). `app.jsx` boots async through it; a new `Archive.jsx` screen manages the library; a boot migration drains the legacy localStorage key (also preserving the Pi "Resume"). The archive is the single source of truth; autosave upserts the open record.

**Tech Stack:** Vite + Preact, IndexedDB, Vitest (`environment: node`) + `fake-indexeddb` (dev-only, new).

## Global Constraints

- **Node 22+**; test env **`node`** (no DOM). Pure/store logic is unit-tested; screens and async boot are thin and verified by store tests + build + manual.
- **`fake-indexeddb`** is the ONLY new dependency, and dev-only (must not ship in the bundle).
- **Preact**; import from `preact`/`preact/hooks`.
- **Backward-compatible:** existing users' single `localStorage['aca-assessment:session']` session migrates on boot; the Pi "Resume" (which writes that same key) still works via the same migration.
- **Archive is the single source of truth**, keyed by session `id`; `currentId` lives in `localStorage['aca-assessment:current']`. Autosave = upsert. "Start over" is destructive (deletes the open record). Import accepts a single session OR a bundle array, upserting by `id`.
- **Scope:** the store module, async boot, and the Archive screen. Do NOT change PDF/CSV formats, the Pi server, or the pure session logic beyond extracting the shared v3 check.
- Test style: `import { expect, test } from 'vitest'` with inline/`createSession` fixtures.

---

### Task 1: Extract `isV3Session` shared validator

**Files:**
- Modify: `src/lib/session.js`
- Test: `tests/session.test.js` (extend)

**Interfaces:**
- Produces: `isV3Session(s): boolean` — true iff `s` is a v3 session (an object with a `paddlers` array whose first paddler, if any, has a `target`). Reused by `loadSession` and (Task 2) `store.js`/`importSessions`/`migrateLegacy`.

- [ ] **Step 1: Write the failing test (append to `tests/session.test.js`)**

```js
test('isV3Session accepts v3 shape and rejects v2/garbage', () => {
  expect(isV3Session({ paddlers: [{ target: 'L3' }] })).toBe(true);
  expect(isV3Session({ paddlers: [] })).toBe(true);          // empty group is valid
  expect(isV3Session({ paddlers: [{ name: 'A' }] })).toBe(false); // v2 (no target)
  expect(isV3Session(null)).toBe(false);
  expect(isV3Session({})).toBe(false);
});
```

Add `isV3Session` to the existing import from `'../src/lib/session.js'` at the top of the test file.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/session.test.js`
Expected: FAIL — `isV3Session` is not exported.

- [ ] **Step 3: Add the helper and use it in `loadSession`**

In `src/lib/session.js`, add near `loadSession`:

```js
// A v3 session has per-paddler `target`; v2 sessions and non-objects are rejected.
export function isV3Session(s) {
  return !!s && Array.isArray(s.paddlers) && (s.paddlers.length === 0 || 'target' in s.paddlers[0]);
}
```

Then simplify `loadSession`'s check to reuse it:

```js
export function loadSession() {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw);
    if (!isV3Session(s)) { clearSession(); return null; }
    return s;
  } catch { clearSession(); return null; }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/session.test.js` → PASS (existing + new).

- [ ] **Step 5: Full suite + commit**

Run: `npx vitest run` → all green.

```bash
git add src/lib/session.js tests/session.test.js
git commit -m "refactor(session): extract shared isV3Session validator"
```

---

### Task 2: `store.js` IndexedDB archive module + tests

**Files:**
- Create: `src/lib/store.js`
- Test: `tests/store.test.js`
- Modify: `package.json` (add `fake-indexeddb` devDependency)

**Interfaces:**
- Consumes: `sessionSummary` (`session-summary.js`), `isV3Session` (Task 1).
- Produces (all async unless noted):
  - `initStore()` — open DB + `migrateLegacy()`.
  - `putSession(session)`, `getSession(id)→session|null`, `deleteSession(id)`.
  - `getAllSessions()→session[]`, `exportAll()→session[]` (alias), `listSummaries()→Summary[]` (newest-first).
  - `importSessions(input)→number` — accepts a session or an array; upserts valid v3 sessions with a string `id`; returns count.
  - `migrateLegacy()` — drains `localStorage['aca-assessment:session']` into the store and sets it current.
  - `getCurrentId()→string|null`, `setCurrentId(id|null)` (sync, localStorage).
  - `resetStore()` — drops the cached DB handle (for test isolation; prod-harmless).

- [ ] **Step 1: Add the dev dependency**

Run: `npm install --save-dev fake-indexeddb`
Expected: added to `devDependencies`; `package-lock.json` updated.

- [ ] **Step 2: Write the failing tests**

```js
// tests/store.test.js
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
```

- [ ] **Step 3: Run to verify they fail**

Run: `npx vitest run tests/store.test.js`
Expected: FAIL — cannot resolve `../src/lib/store.js`.

- [ ] **Step 4: Create the module**

```js
// src/lib/store.js
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

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

// Drops the cached handle so tests can reopen a freshly-deleted database.
export function resetStore() { dbPromise = null; }

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
```

- [ ] **Step 5: Run to verify they pass**

Run: `npx vitest run tests/store.test.js`
Expected: PASS (6 tests).

- [ ] **Step 6: Full suite + confirm fake-indexeddb is dev-only + commit**

Run: `npx vitest run` → all green.
Run: `npm run build` → succeeds. Then confirm the dep is dev-only and absent from the bundle:
Run: `node -e "const p=require('./package.json'); if(p.dependencies['fake-indexeddb']) throw new Error('must be devDependency'); console.log('dev-only OK')"`
Run: `grep -rc "fake-indexeddb" dist/assets/*.js | grep -v ':0' && echo "LEAKED INTO BUNDLE" || echo "not in bundle OK"`

```bash
git add src/lib/store.js tests/store.test.js package.json package-lock.json
git commit -m "feat(store): IndexedDB assessment archive (crud, list, import/export, migrate)"
```

---

### Task 3: Async boot + archive-aware app actions

Rewrite `app.jsx` to boot through the store and operate on the archive. No new unit test (thin view); verified by the store tests, `npm run build`, the suite staying green, and a manual check.

**Files:**
- Modify: `src/app.jsx`

**Interfaces:**
- Consumes: `initStore`, `getSession`, `putSession`, `deleteSession`, `getCurrentId`, `setCurrentId` from `src/lib/store.js`.
- Produces: an `App` that loads the current session from the archive on boot and threads a new `onArchive`/`resume` path (the Archive screen mounts in Task 4).

- [ ] **Step 1: Rewrite `src/app.jsx`**

Replace the file with:

```jsx
import { useState, useEffect } from 'preact/hooks';
import { Setup } from './screens/Setup.jsx';
import { Rate } from './screens/Rate.jsx';
import { Review } from './screens/Review.jsx';
import { Archive } from './screens/Archive.jsx';
import { initStore, getSession, putSession, deleteSession, getCurrentId, setCurrentId } from './lib/store.js';
import { SyncButton } from './components/SyncButton.jsx';

export function App() {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState(null);
  const [screen, setScreen] = useState('setup');
  const [focusSkillId, setFocusSkillId] = useState(null);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        await initStore();
        const id = getCurrentId();
        const s = id ? await getSession(id) : null;
        if (!live) return;
        if (s) { setSession(s); setScreen('rate'); }
      } finally {
        if (live) setReady(true);
      }
    })();
    return () => { live = false; };
  }, []);

  function begin(s) {
    setFocusSkillId(null);
    putSession(s);            // fire-and-forget upsert
    setCurrentId(s.id);
    setSession(s);
    setScreen('rate');
  }

  function update(s) {
    putSession(s);            // autosave; never blocks the tap
    setSession(s);
  }

  function reset() {
    if (typeof window !== 'undefined' &&
        !window.confirm('Start over? This clears the current assessment and cannot be undone.')) {
      return;
    }
    const id = getCurrentId();
    if (id) deleteSession(id);
    setCurrentId(null);
    setSession(null);
    setScreen('setup');
  }

  async function resume(id) {
    const s = await getSession(id);
    if (!s) return;
    setFocusSkillId(null);
    setCurrentId(id);
    setSession(s);
    setScreen('review');
  }

  if (!ready) {
    return <main className="screen"><p className="hint">Loading…</p></main>;
  }

  if (screen === 'archive') {
    return <Archive onResume={resume} onBack={() => setScreen('setup')} />;
  }

  if (screen === 'setup' || !session) {
    return <Setup onStart={begin} onArchive={() => setScreen('archive')} />;
  }

  if (screen === 'rate') {
    return (
      <div className="rate-shell">
        <div className="rate-shell-bar">
          <button type="button" className="start-over-button" onClick={reset}>Start over</button>
          <SyncButton session={session} />
        </div>
        <Rate
          session={session}
          focusSkillId={focusSkillId}
          onChange={update}
          onDone={() => setScreen('review')}
        />
      </div>
    );
  }

  return (
    <Review
      session={session}
      onChange={update}
      onBack={() => { setFocusSkillId(null); setScreen('rate'); }}
      onReset={reset}
      onEditSkill={(skillId) => { setFocusSkillId(skillId); setScreen('rate'); }}
    />
  );
}
```

(Note: this imports `Archive` from `./screens/Archive.jsx`, created in Task 4. If you run `npm run build` before Task 4, it will fail on the missing import — that's expected; build/verify at the end of Task 4. The full test suite does not import `app.jsx`, so `npx vitest run` still passes here.)

- [ ] **Step 2: Run the full suite**

Run: `npx vitest run`
Expected: PASS — no test imports `app.jsx`; store/session tests unaffected.

- [ ] **Step 3: Commit**

```bash
git add src/app.jsx
git commit -m "feat(app): async boot through the archive; resume/reset on the store"
```

---

### Task 4: `Archive` screen + Setup entry + styles

**Files:**
- Create: `src/screens/Archive.jsx`
- Modify: `src/screens/Setup.jsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `listSummaries`, `getSession`, `deleteSession`, `exportAll`, `importSessions` (`store.js`); `sessionToCsv` (`csv.js`).
- Produces: `Archive({ onResume, onBack })` named export; `Setup` gains an `onArchive` prop.

- [ ] **Step 1: Create the Archive screen**

```jsx
// src/screens/Archive.jsx
// On-device management of the assessment archive: list, resume, delete,
// per-session export, whole-archive export, and import (single or bundle).
import { useEffect, useState } from 'preact/hooks';
import { listSummaries, getSession, deleteSession, exportAll, importSessions } from '../lib/store.js';
import { sessionToCsv } from '../lib/csv.js';

function download(name, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

export function Archive({ onResume, onBack }) {
  const [rows, setRows] = useState(null);
  const [msg, setMsg] = useState('');

  async function refresh() { setRows(await listSummaries()); }
  useEffect(() => { refresh(); }, []);

  async function exportJson(id) {
    const s = await getSession(id);
    if (s) download(`aca-assessment-${id}.json`, JSON.stringify(s, null, 2), 'application/json');
  }
  async function exportCsv(id) {
    const s = await getSession(id);
    if (s) download(`aca-assessment-${id}.csv`, sessionToCsv(s), 'text/csv');
  }
  async function remove(id, names) {
    if (!window.confirm(`Delete this assessment (${names})? This cannot be undone.`)) return;
    await deleteSession(id); refresh();
  }
  async function exportEverything() {
    const all = await exportAll();
    const date = (all[0] && String(all[0].createdAt).slice(0, 10)) || 'export';
    download(`aca-archive-${date}.json`, JSON.stringify(all, null, 2), 'application/json');
  }
  async function importFile(e) {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      const n = await importSessions(data);
      setMsg(`Imported ${n} assessment${n === 1 ? '' : 's'}.`);
      refresh();
    } catch { setMsg('That file is not a valid assessment JSON.'); }
    e.target.value = '';
  }

  return (
    <main className="screen archive-screen">
      <div className="archive-bar">
        <button type="button" onClick={onBack}>◀ Back</button>
        <button type="button" onClick={exportEverything} disabled={!rows || !rows.length}>Export all</button>
        <label className="archive-import">Import
          <input type="file" accept="application/json,.json" onChange={importFile} />
        </label>
      </div>
      <h2>Past assessments</h2>
      {msg ? <p className="hint">{msg}</p> : null}
      {rows === null ? <p className="hint">Loading…</p>
        : rows.length === 0 ? <p className="hint">No saved assessments yet.</p>
        : (
        <ul className="archive-list">
          {rows.map(r => {
            const names = (r.participants || []).join(', ');
            const level = r.level || (r.targets && r.targets.length ? 'L1/L2' : '');
            return (
              <li className="archive-row" key={r.id}>
                <div className="archive-meta">
                  <strong>{new Date(r.createdAt).toLocaleString()}</strong>
                  <span>{level}{r.selfAssessment ? ' · self' : ''} · {names}</span>
                  <span className="archive-progress">{r.counts.rated}/{r.counts.core} rated</span>
                </div>
                <div className="archive-actions">
                  <button type="button" onClick={() => onResume(r.id)}>Resume</button>
                  <button type="button" onClick={() => exportJson(r.id)}>JSON</button>
                  <button type="button" onClick={() => exportCsv(r.id)}>CSV</button>
                  <button type="button" className="archive-del" onClick={() => remove(r.id, names)}>Delete</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Add the Setup entry point**

In `src/screens/Setup.jsx`, change the component signature to accept `onArchive`:

```jsx
export function Setup({ onStart, onArchive }) {
```

Replace the private-only Pi link:

```jsx
      {PRIVATE ? <p><a href="/sessions">Past assessments &rarr;</a></p> : null}
```

with a public in-app link:

```jsx
      <p><button type="button" className="linklike" onClick={onArchive}>Past assessments &rarr;</button></p>
```

- [ ] **Step 3: Add styles to `src/styles.css`**

```css
.archive-bar { display: flex; flex-wrap: wrap; gap: .5rem; align-items: center; margin-bottom: .5rem; }
.archive-import { margin-left: auto; font-size: .9rem; }
.archive-import input { display: block; }
.archive-list { list-style: none; margin: 0; padding: 0; }
.archive-row { border-bottom: 1px solid #ddd; padding: .6rem 0; }
.archive-meta { display: flex; flex-direction: column; gap: .1rem; }
.archive-meta span { font-size: .85rem; color: #4a5a5d; }
.archive-actions { display: flex; flex-wrap: wrap; gap: .4rem; margin-top: .4rem; }
.archive-del { background: #c0392b; color: #fff; border: 0; border-radius: 6px; }
.linklike { background: none; border: 0; color: #005f6b; text-decoration: underline; cursor: pointer; padding: 0; font: inherit; }
```

- [ ] **Step 4: Full suite + build**

Run: `npx vitest run` → all green (91+ from prior + the new store/session tests).
Run: `npm run build` → succeeds (now that `Archive.jsx` exists, `app.jsx`'s import resolves).

- [ ] **Step 5: Manual end-to-end verification**

Run: `npm run dev`. Verify:
1. Start an assessment, rate a bit — reload the page → it resumes where you left off (loaded from IndexedDB).
2. "Past assessments" from Setup opens the Archive; the in-progress assessment is listed.
3. Start a second assessment; both appear in the list. Resume the first → it opens in Review.
4. Export JSON and CSV for a row download; Export all downloads a bundle.
5. Delete a row (confirm) removes it. Import the bundle back → the deleted one returns (and re-import doesn't duplicate).
6. "Start over" deletes the open assessment (confirm) and returns to Setup.

- [ ] **Step 6: Commit**

```bash
git add src/screens/Archive.jsx src/screens/Setup.jsx src/styles.css
git commit -m "feat(archive): in-app Past assessments screen (list/resume/delete/export/import)"
```

---

## Self-Review (completed by plan author)

- **Spec coverage:** shared v3 validator (Task 1); IndexedDB store with CRUD, list, import/export-all, migration, current pointer + fake-indexeddb tests (Task 2); async boot + archive-aware begin/update/reset/resume (Task 3); Archive screen + public Setup entry + styles (Task 4). Migration/Pi-bridge, destructive reset, single-or-bundle import, universal scope all covered. Out-of-scope items (profiles, session-slimming, PDF/CSV/Pi changes, search/rename) excluded.
- **Placeholder scan:** every step has complete code. Task 3 intentionally references `Archive.jsx` before Task 4 creates it, with a build-timing note — no test imports `app.jsx`, so the suite stays green until the Task 4 build.
- **Type consistency:** store API names (`initStore`/`putSession`/`getSession`/`deleteSession`/`listSummaries`/`exportAll`/`importSessions`/`getCurrentId`/`setCurrentId`/`migrateLegacy`/`resetStore`) are defined in Task 2 and consumed identically in Tasks 3–4; `isV3Session` (Task 1) is used by `store.js` (Task 2); `Archive({onResume,onBack})` and `Setup({onStart,onArchive})` props match their call sites in `app.jsx`; summary row fields (`participants`, `level`, `targets`, `selfAssessment`, `counts.rated/core`, `createdAt`) match `sessionSummary`'s output.
