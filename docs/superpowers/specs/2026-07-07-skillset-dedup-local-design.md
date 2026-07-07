# Skill-Set Dedup (Increment 1: Local) — Design Spec

**Date:** 2026-07-07
**Status:** Approved, ready for implementation plan
**Scope:** Increment 1 of 3. Normalize the per-session `{skills, scales, intro}`
blob into a shared, content-addressed IndexedDB store — **inside the local store
boundary only**. Frozen records preserved. Export, sync, PDF/CSV, and the Pi are
untouched this increment.

## Goal

Stop storing an identical ~71 KB copy of a level's skill definitions in every
session. Store each distinct `{skills, scales, intro}` blob **once**, keyed by a
content hash; sessions reference it. A session drops from ~132 KB to ~62 KB
(results only) while every reader still sees a fat session, and each blob is
retained forever under its hash so old assessments stay **frozen** against the
exact standards they were assessed under.

Increments 2 (slim export bundle) and 3 (slim Pi sync) build on this increment's
hydrate/dehydrate boundary and are **out of scope here**.

## Context (current state)

- `createSession` embeds `scales`, `intro`, `skills` (from the level config) into
  every session; `results` reference `skillId`. A full L4 5-paddler session is
  ~132 KB (~71 KB skills + ~62 KB results).
- The archive lives in IndexedDB (`src/lib/store.js`, DB `aca-assessment` v1,
  object store `sessions` keyPath `id`). `putSession`/`getSession`/
  `getAllSessions`/`listSummaries` are the CRUD; `openDb` runs `onupgradeneeded`.
- `session.skills`/`.scales`/`.intro` are read in ~10 places (lib + both screens
  + the Pi server). None of them should change — they must keep receiving a fat
  session.

## Decisions (locked)

| Decision | Choice |
| --- | --- |
| Dedup key | **Content hash** of `{skills, scales, intro}` — automatic dedup + automatic frozen (any change → new key; old sessions keep their blob) |
| Boundary | Dehydrate on **write**, hydrate on **read**, inside `store.js` only. In-memory / export / sync / PDF / CSV / Pi all see fat sessions this increment |
| Storage | New IndexedDB object store `skillSets` (keyPath `ref`); DB version **1 → 2** |
| Migration | Legacy fat sessions hydrate as-is and are slimmed on next write (their exact blob is stored under its hash — frozen preserved). No bulk migration pass |
| Reach | **Local only.** Export, sync, Pi, and the import gate are unchanged |

## Architecture

### 1. `src/lib/skillset.js` (new) — pure content-addressing helpers

No IndexedDB; fully unit-testable.

```js
// A small, stable content hash (FNV-1a, 32-bit) of the skill-set blob's JSON.
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

// Remove the embedded blob, reference it instead.
export function slimSession(session, ref) {
  const { skills, scales, intro, ...rest } = session;
  return { ...rest, skillSetRef: ref };
}

// Re-attach a blob to a slim session (drops the ref).
export function fattenSession(session, blob) {
  const { skillSetRef, ...rest } = session;
  return { ...rest, skills: blob.skills, scales: blob.scales, intro: blob.intro ?? null };
}
```

The hash is a non-cryptographic FNV-1a: distinct-content collisions are
astronomically unlikely across the handful of level-version blobs an install
ever sees, and a collision would at worst mis-attach an identical-looking blob —
acceptable. `skills` array order is preserved by `loadConfig`, so `JSON.stringify`
of a given config is deterministic.

### 2. `src/lib/store.js` — the hydrate/dehydrate boundary + `skillSets` store

- **Open at version 2**, creating both stores idempotently:
  ```js
  const req = indexedDB.open(DB, 2);
  req.onupgradeneeded = () => {
    const db = req.result;
    if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    if (!db.objectStoreNames.contains(SKILLSETS)) db.createObjectStore(SKILLSETS, { keyPath: 'ref' });
  };
  ```
  (A v1 user upgrades in place: the `sessions` store is untouched; `skillSets` is
  added.)
- **Skill-set CRUD:** `putSkillSet(ref, blob)` (idempotent upsert of
  `{ ref, blob }`), `getSkillSet(ref)` → `blob | null`.
- **`dehydrate(session)`** (async): if `isSlim(session)` or `!session.skills`,
  return as-is; else compute `blob = blobOf(session)`, `ref = skillSetRef(blob)`,
  `await putSkillSet(ref, blob)`, return `slimSession(session, ref)`.
- **`hydrate(session)`** (async): if `session.skills` (fat/legacy) or no
  `skillSetRef`, return as-is; else `blob = await getSkillSet(ref)` — if missing,
  log a warning and return the session unchanged (defensive; can't happen because
  dehydrate always stores the blob first); else return `fattenSession(session,
  blob)`.
- **Wire the boundary:**
  - `putSession(session)` → `await put(await dehydrate(session))`.
  - `getSession(id)` → `hydrate` the loaded record (or `null`).
  - `getAllSessions()` → `await Promise.all(records.map(hydrate))`.
  - `listSummaries()` — reads through `getAllSessions()` (now hydrated), so it is
    unchanged and its per-row `try/catch` still applies.
- **Unchanged:** `importSessions` (still receives fat sessions this increment; its
  `Array.isArray(s.skills)` gate stays), `exportAll` (= `getAllSessions`, now
  hydrated → fat), `migrateLegacy`, `getCurrentId`/`setCurrentId`, `resetStore`.

### 3. Everything else — no change

`app.jsx`, both screens, `pdf.js`, `csv.js`, `summary.js`, `session-summary.js`,
`rate-pages.js`, `competency.js`, `sync.js`, and the Pi server all read a session
that has been hydrated at the store boundary, so they keep seeing fat sessions.
`createSession` still builds a fat in-memory session; the slimming happens when
it is persisted.

## Data flow

`begin`/`update` → `putSession(fat)` → `dehydrate` (ensure blob stored once) →
store slim. `getSession`/boot/list/`exportAll` → load slim → `hydrate` (re-attach
blob) → fat to the app / export / sync. A second session of the same level hashes
to the same `ref`, so its blob write is a no-op upsert — one stored copy.

## Error handling / edge cases

- **Legacy fat session** (local or imported): `hydrate` returns it unchanged
  (it has `skills`); on its next `putSession`, `dehydrate` stores its exact
  embedded blob under its hash and slims it — frozen preserved, no bulk pass.
- **Missing `skillSetRef` blob** on hydrate → warn + return slim (never throws;
  the resilient `listSummaries` already tolerates a summary failure). Not
  reachable normally because dehydrate stores the blob before referencing it.
- **`intro` is `null`** for some levels → `blobOf`/`fattenSession` normalize
  `intro ?? null`, so hash and round-trip are stable.
- **DB v1 → v2 upgrade** adds only the `skillSets` store; existing `sessions`
  records are untouched and slim lazily.
- **Content-hash collision** across genuinely different blobs → astronomically
  unlikely for the few blobs an install sees; worst case attaches an
  identical-content blob. Accepted.

## Testing

- **Unit — `skillset.js`:** `skillSetRef` is deterministic (same blob → same ref)
  and discriminating (a changed `standard`/`scale`/`intro` → different ref);
  `slimSession` drops `skills`/`scales`/`intro` and adds `skillSetRef`;
  `fattenSession(slim, blob)` reproduces the original fat shape; `isSlim`/`blobOf`.
- **Unit — `store.js` (fake-indexeddb):** `putSession(fat)` then `getSession`
  returns a fat session deep-equal to the original; the stored record is slim
  (has `skillSetRef`, no `skills`); two sessions built from the **same** config
  leave exactly **one** entry in `skillSets` (dedup); a **legacy fat** session put
  then get round-trips and is stored slim; `getAllSessions`/`listSummaries` return
  hydrated results over slim records; `hydrate` of a record whose `skillSetRef` is
  absent returns it unchanged without throwing.
- **Storage sanity (optional, in a test or note):** a dehydrated session's JSON is
  materially smaller than the fat one for a real L-level config.

## Out of scope (this increment)

- **Increment 2:** slim export/import bundle (`{sessions, skillSets}`).
- **Increment 3:** slim Pi sync + a Pi `skillSets` store + Pi-side hydration.
- Results-array compaction; orphaned-`skillSet` garbage collection; any change to
  `createSession`'s in-memory shape, the screens, PDF/CSV, `sync.js`, the import
  gate, or the Pi server.
