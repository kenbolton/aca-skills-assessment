# Skill-Set Dedup (Increment 1: Local) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Normalize the per-session `{skills, scales, intro}` blob into a shared, content-addressed IndexedDB `skillSets` store — inside `store.js`'s read/write boundary only. Frozen records preserved; every reader still gets a fat session. Export, sync, PDF/CSV, and the Pi are untouched this increment.

**Architecture:** A pure `skillset.js` (content hash + slim/fatten transforms) + a hydrate/dehydrate boundary in `store.js` (DB v2 adds a `skillSets` store; `putSession` dehydrates, `getSession`/`getAllSessions` hydrate). Nothing else changes.

**Tech Stack:** Vite + Preact, IndexedDB, Vitest (`environment: node`) + `fake-indexeddb` (already a devDependency).

## Global Constraints

- **Node 22+**; test env **`node`**; no new dependencies (`fake-indexeddb` already present).
- **Frozen-preserving:** each distinct blob is stored once under its content hash and retained; a changed blob → a new hash → old sessions keep their blob. No manual version field.
- **Boundary only in `store.js`:** in-memory sessions, export, sync, PDF/CSV, the import gate, and the Pi server are UNCHANGED — they read through the hydrating boundary and keep seeing fat sessions. Do NOT touch `app.jsx`, screens, `pdf.js`, `csv.js`, `sync.js`, `createSession`, or the Pi server.
- **Backward-compatible:** legacy fat sessions hydrate as-is and slim on next write; DB v1→v2 adds only the `skillSets` store.
- Test style: `import { expect, test } from 'vitest'`; store tests use the existing `fake-indexeddb/auto` + `resetStore`/`deleteDatabase`/localStorage-shim `beforeEach` pattern in `tests/store.test.js`.

---

### Task 1: `skillset.js` — pure content-addressing helpers

**Files:**
- Create: `src/lib/skillset.js`
- Test: `tests/skillset.test.js`

**Interfaces:**
- Produces:
  - `skillSetRef(blob): string` — a stable FNV-1a content hash (`sk-xxxxxxxx`).
  - `blobOf(session): { skills, scales, intro }`.
  - `isSlim(session): boolean` — no `skills` and a string `skillSetRef`.
  - `slimSession(session, ref): session` — drops `skills`/`scales`/`intro`, adds `skillSetRef`.
  - `fattenSession(session, blob): session` — drops `skillSetRef`, re-attaches `skills`/`scales`/`intro`.

- [ ] **Step 1: Write the failing tests**

```js
// tests/skillset.test.js
import { expect, test } from 'vitest';
import { skillSetRef, blobOf, isSlim, slimSession, fattenSession } from '../src/lib/skillset.js';

const blob = { skills: [{ id: 's1', level: 'L3', standard: 'x' }], scales: { L3: [{ value: 'meets' }] }, intro: null };
const fat = { id: 'a', createdAt: 't', results: [{ skillId: 's1', rating: 'meets' }], ...blob };

test('skillSetRef is deterministic and discriminating', () => {
  expect(skillSetRef(blob)).toBe(skillSetRef(blob));
  expect(skillSetRef(blob)).toMatch(/^sk-[0-9a-f]{8}$/);
  const changed = { ...blob, skills: [{ id: 's1', level: 'L3', standard: 'CHANGED' }] };
  expect(skillSetRef(changed)).not.toBe(skillSetRef(blob));
});

test('blobOf extracts the three fields, normalizing intro', () => {
  expect(blobOf(fat)).toEqual(blob);
  expect(blobOf({ skills: [], scales: {} }).intro).toBe(null);
});

test('slimSession drops the blob and adds the ref; isSlim detects it', () => {
  const ref = skillSetRef(blob);
  const slim = slimSession(fat, ref);
  expect(slim.skills).toBeUndefined();
  expect(slim.scales).toBeUndefined();
  expect(slim.intro).toBeUndefined();
  expect(slim.skillSetRef).toBe(ref);
  expect(slim.id).toBe('a');
  expect(isSlim(slim)).toBe(true);
  expect(isSlim(fat)).toBe(false);
});

test('fattenSession is the inverse of slimSession given the blob', () => {
  const ref = skillSetRef(blob);
  const back = fattenSession(slimSession(fat, ref), blob);
  expect(back).toEqual(fat);
  expect(back.skillSetRef).toBeUndefined();
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/skillset.test.js`
Expected: FAIL — cannot resolve `../src/lib/skillset.js`.

- [ ] **Step 3: Create the module**

```js
// src/lib/skillset.js
// Pure content-addressing helpers for skill-set dedup. A session's large
// {skills, scales, intro} blob is identical across all sessions of a level, so
// it is stored once (keyed by a content hash) and referenced. Any change to the
// blob yields a new hash, so older sessions keep their exact blob (frozen).

// FNV-1a 32-bit hash of the blob's JSON. Non-cryptographic; collisions across
// the few distinct level-version blobs an install sees are negligible.
export function skillSetRef(blob) {
  const json = JSON.stringify(blob);
  let h = 0x811c9dc5;
  for (let i = 0; i < json.length; i++) {
    h ^= json.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return 'sk-' + (h >>> 0).toString(16).padStart(8, '0');
}

export function blobOf(session) {
  return { skills: session.skills, scales: session.scales, intro: session.intro ?? null };
}

export function isSlim(session) {
  return !!session && !session.skills && typeof session.skillSetRef === 'string';
}

export function slimSession(session, ref) {
  const { skills, scales, intro, ...rest } = session;
  return { ...rest, skillSetRef: ref };
}

export function fattenSession(session, blob) {
  const { skillSetRef, ...rest } = session;
  return { ...rest, skills: blob.skills, scales: blob.scales, intro: blob.intro ?? null };
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run tests/skillset.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Full suite + commit**

Run: `npx vitest run` → all green.

```bash
git add src/lib/skillset.js tests/skillset.test.js
git commit -m "feat(skillset): pure content-addressing helpers (hash, slim, fatten)"
```

---

### Task 2: `store.js` — hydrate/dehydrate boundary + `skillSets` store (DB v2)

**Files:**
- Modify: `src/lib/store.js`
- Test: `tests/store.test.js` (extend)

**Interfaces:**
- Consumes: `skillSetRef`, `blobOf`, `isSlim`, `slimSession`, `fattenSession` (Task 1).
- Produces (new exports): `dehydrate(session)→Promise<session>`, `hydrate(session)→Promise<session>`, `putSkillSet(ref, blob)`, `getSkillSet(ref)→Promise<blob|null>`. `putSession`/`getSession`/`getAllSessions` now slim on write / fatten on read; their signatures are unchanged.

- [ ] **Step 1: Write the failing tests (append to `tests/store.test.js`)**

```js
import { dehydrate, hydrate, getSkillSet } from '../src/lib/store.js'; // add to the existing import

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
```

(The existing `sess(id, createdAt)` helper in this file already builds a fat session via `createSession` with the minimal inline config — reuse it. Ensure the inline config includes `intro` or leave it absent; `blobOf` normalizes `intro ?? null`, and `createSession` sets `intro: config.intro || null`, so the round-trip is stable either way.)

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/store.test.js`
Expected: FAIL — `dehydrate`/`hydrate`/`getSkillSet` are not exported yet (and the round-trip test fails because `putSession` doesn't slim).

- [ ] **Step 3: Add the `skillSets` store, CRUD, and hydrate/dehydrate to `store.js`**

Add the import near the top:

```js
import { skillSetRef, blobOf, isSlim, slimSession, fattenSession } from './skillset.js';
```

Add the store-name constant beside `const STORE = 'sessions';`:

```js
const SKILLSETS = 'skillSets';
```

Bump the DB version to 2 and create both stores in `openDb`'s `onupgradeneeded` (replace the `indexedDB.open(DB, 1)` line and its `onupgradeneeded`):

```js
    const req = indexedDB.open(DB, 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(SKILLSETS)) db.createObjectStore(SKILLSETS, { keyPath: 'ref' });
    };
```

Add a `skillSets`-store accessor next to the existing `store(mode)` helper, then the CRUD + hydrate/dehydrate (place after `store(mode)`):

```js
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
```

Wire the boundary into the three functions (replace their current one-liners):

```js
export async function putSession(session) { await reqP((await store('readwrite')).put(await dehydrate(session))); }
export async function getSession(id) {
  const rec = (await reqP((await store('readonly')).get(id))) || null;
  return rec ? hydrate(rec) : null;
}
export async function getAllSessions() {
  const all = (await reqP((await store('readonly')).getAll())) || [];
  return Promise.all(all.map(hydrate));
}
```

Leave `listSummaries`, `exportAll`, `importSessions`, `migrateLegacy`, `getCurrentId`/`setCurrentId`, `resetStore`, and `initStore` unchanged (they read through the functions above).

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run tests/store.test.js`
Expected: PASS (existing store tests + the 4 new ones). The existing tests still pass because the fat round-trip is transparent and `listSummaries`/`importSessions` read through the hydrating getters.

- [ ] **Step 5: Full suite + build + commit**

Run: `npx vitest run` → all green.
Run: `npm run build` → succeeds.

```bash
git add src/lib/store.js tests/store.test.js
git commit -m "feat(store): dedup skill-set blobs behind a hydrate/dehydrate boundary (DB v2)"
```

---

## Self-Review (completed by plan author)

- **Spec coverage:** pure content-hash + slim/fatten helpers (Task 1); `skillSets` store + DB v2 upgrade + `putSkillSet`/`getSkillSet` + `dehydrate`/`hydrate` + wiring `putSession`/`getSession`/`getAllSessions` (Task 2). Dedup, frozen-preservation (content hash retained), legacy-fat passthrough + slim-on-write, and "nothing else changes" all covered. Increments 2/3 and results-compaction/GC excluded.
- **Placeholder scan:** every step has complete code; no TBDs.
- **Type consistency:** `skillSetRef(blob)`, `blobOf(session)`, `isSlim`, `slimSession(session, ref)`, `fattenSession(session, blob)` (Task 1) are consumed with matching signatures in `store.js` (Task 2); `dehydrate`/`hydrate` return the same session shape the existing callers expect (fat on read); `getSkillSet` returns the blob (`{skills,scales,intro}`) that `fattenSession` consumes. The DB version (2) and store names (`sessions`, `skillSets`) are consistent across `openDb` and the accessors.
