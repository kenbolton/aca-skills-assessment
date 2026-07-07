# Skill-Set Dedup (Increment 2: Export/Import Bundle) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Export the archive (per-session and export-all) as a self-contained slim `{ format, sessions, skillSets }` bundle, and teach the in-app import to accept it — while still accepting legacy fat exports.

**Architecture:** `store.js` gains `exportBundle(ids?)` (raw slim sessions + referenced blobs, slimming any legacy-fat record in-memory) and `importBundle(bundle)` (blobs first, then `importSessions`), and its import gate is relaxed to accept slim sessions. `Archive.jsx` uses `exportBundle` for both export buttons and detects a bundle vs legacy-fat on import.

**Tech Stack:** Vite + Preact, IndexedDB, Vitest (`environment: node`) + `fake-indexeddb`.

## Global Constraints

- **Node 22+**; test env **`node`**; no new dependencies.
- **Bundle format:** `{ format: 'aca-archive-v2', sessions: [slim…], skillSets: { ref: blob } }`.
- **Backward compatible:** legacy fat exports (single session or array) must still import; the Pi server, `sync.js`, PDF, and CSV are UNCHANGED this increment.
- **No store side effects during export:** a legacy-fat stored record is slimmed *in-memory* for the bundle; it is NOT rewritten to the store.
- **Scope:** `src/lib/store.js` + `src/screens/Archive.jsx` only (+ their tests). Do not touch the hydrate/dehydrate boundary from increment 1, `createSession`, the screens other than Archive, or the Pi.
- Reuses increment-1's `skillset.js` helpers (`skillSetRef`, `blobOf`, `slimSession`) — already imported in `store.js`.
- Test style: `import { expect, test } from 'vitest'`; store tests use the existing `fake-indexeddb/auto` + `resetStore`/`deleteDatabase`/localStorage-shim `beforeEach` in `tests/store.test.js`.

---

### Task 1: `store.js` — `exportBundle` / `importBundle` + relaxed import gate

**Files:**
- Modify: `src/lib/store.js`
- Test: `tests/store.test.js` (extend)

**Interfaces:**
- Produces:
  - `exportBundle(ids?: string[]): Promise<{ format, sessions, skillSets }>` — slim, self-contained bundle for `ids` (all when omitted); no store writes.
  - `importBundle(bundle): Promise<number>` — upserts `bundle.skillSets` then `importSessions(bundle.sessions)`; returns imported count.
  - `importSessions` gate now accepts a slim session (`skillSetRef` string) as well as fat (`skills` array).

- [ ] **Step 1: Write the failing tests (append to `tests/store.test.js`)**

```js
import { exportBundle, importBundle, putSkillSet } from '../src/lib/store.js'; // add to the existing import

// Raw session put/get that bypass dehydrate/hydrate, to simulate a legacy fat
// record and to inspect what is actually stored.
function rawSessionOp(mode, fn) {
  return new Promise((res, rej) => {
    const open = indexedDB.open('aca-assessment', 2);
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
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/store.test.js`
Expected: FAIL — `exportBundle`/`importBundle` are not exported (and the slim-import test fails on the current fat-only gate).

- [ ] **Step 3: Add the bundle functions and relax the gate in `store.js`**

Add a format constant near the top (beside `const SKILLSETS = 'skillSets';`):

```js
const BUNDLE_FORMAT = 'aca-archive-v2';
```

Relax the `importSessions` gate — change its condition from:

```js
    if (isV3Session(s) && typeof s.id === 'string' && Array.isArray(s.results) && Array.isArray(s.skills)) {
```

to:

```js
    if (isV3Session(s) && typeof s.id === 'string' && Array.isArray(s.results)
        && (Array.isArray(s.skills) || typeof s.skillSetRef === 'string')) {
```

Add the bundle export/import (place after `importSessions`):

```js
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
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run tests/store.test.js`
Expected: PASS (existing store tests + the 5 new ones).

- [ ] **Step 5: Full suite + build + commit**

Run: `npx vitest run` → all green.
Run: `npm run build` → succeeds.

```bash
git add src/lib/store.js tests/store.test.js
git commit -m "feat(store): slim export/import bundle (exportBundle/importBundle, slim gate)"
```

---

### Task 2: `Archive.jsx` — use the bundle + detect on import

Thin-view change. Verified by the suite staying green, `npm run build`, and a manual check.

**Files:**
- Modify: `src/screens/Archive.jsx`

**Interfaces:**
- Consumes: `exportBundle`, `importBundle` (Task 1) in addition to `getSession`, `deleteSession`, `listSummaries`, `importSessions`.

- [ ] **Step 1: Update the store import**

In `src/screens/Archive.jsx`, change the store import line to:

```jsx
import { listSummaries, getSession, deleteSession, exportBundle, importBundle, importSessions } from '../lib/store.js';
```

- [ ] **Step 2: Per-session JSON export → a one-session bundle**

Replace `exportJson`:

```jsx
  async function exportJson(id) {
    const s = await getSession(id);
    if (s) download(`aca-assessment-${id}.json`, JSON.stringify(s, null, 2), 'application/json');
  }
```

with:

```jsx
  async function exportJson(id) {
    const b = await exportBundle([id]);
    if (b.sessions.length) download(`aca-assessment-${id}.json`, JSON.stringify(b, null, 2), 'application/json');
  }
```

- [ ] **Step 3: Export all → the bundle**

Replace `exportEverything`:

```jsx
  async function exportEverything() {
    const all = await exportAll();
    const date = (all[0] && String(all[0].createdAt).slice(0, 10)) || 'export';
    download(`aca-archive-${date}.json`, JSON.stringify(all, null, 2), 'application/json');
  }
```

with:

```jsx
  async function exportEverything() {
    const b = await exportBundle();
    const date = (b.sessions[0] && String(b.sessions[0].createdAt).slice(0, 10)) || 'export';
    download(`aca-archive-${date}.json`, JSON.stringify(b, null, 2), 'application/json');
  }
```

- [ ] **Step 4: Import → detect bundle vs legacy fat**

Replace the parse+import lines inside `importFile` (the `try` block):

```jsx
      const data = JSON.parse(await f.text());
      const n = await importSessions(data);
      setMsg(n === 0 ? 'No valid assessments found in that file.' : `Imported ${n} assessment${n === 1 ? '' : 's'}.`);
```

with:

```jsx
      const data = JSON.parse(await f.text());
      const isBundle = data && Array.isArray(data.sessions) && data.skillSets && typeof data.skillSets === 'object';
      const n = isBundle ? await importBundle(data) : await importSessions(data);
      setMsg(n === 0 ? 'No valid assessments found in that file.' : `Imported ${n} assessment${n === 1 ? '' : 's'}.`);
```

- [ ] **Step 5: Full suite + build**

Run: `npx vitest run` → all green (Archive is untested; lib tests unaffected).
Run: `npm run build` → succeeds.

- [ ] **Step 6: Manual verification**

Run: `npm run dev`. Create two assessments, then in **Past assessments**:
1. **Export all** downloads `aca-archive-*.json`; open it — it is `{ format: 'aca-archive-v2', sessions: [...slim...], skillSets: {...} }` (sessions have `skillSetRef`, no `skills`).
2. A per-session **JSON** export downloads a one-session bundle of the same shape.
3. Delete both, then **Import** the export-all bundle → both assessments return and open correctly (Resume shows a full assessment).
4. **Import** a *legacy fat* file (e.g. a session JSON exported from the Pi, or hand-make `{id, paddlers:[{target}], results:[], skills:[...]}`) → still imports.
5. Re-importing the same bundle does not duplicate.

- [ ] **Step 7: Commit**

```bash
git add src/screens/Archive.jsx
git commit -m "feat(archive): export/import the slim skill-set bundle format"
```

---

## Self-Review (completed by plan author)

- **Spec coverage:** `exportBundle`/`importBundle` + relaxed gate (Task 1); per-session + export-all use the bundle, import detects bundle-vs-fat (Task 2). In-memory slimming with no store mutation, dedup, round-trip, legacy-fat backward compat all covered by tests/manual steps. Pi sync/page (increment 3), CSV, results-compaction, and GC excluded.
- **Placeholder scan:** every step has complete code; no TBDs.
- **Type consistency:** `exportBundle(ids?)` returns `{format, sessions, skillSets}` consumed identically by `importBundle` and by `Archive.jsx`'s download/detect; the relaxed gate matches slim sessions produced by `exportBundle`/`slimSession`; `importBundle` calls `putSkillSet`/`importSessions` with matching shapes; `BUNDLE_FORMAT` string is consistent between producer and the manual-check expectation.
