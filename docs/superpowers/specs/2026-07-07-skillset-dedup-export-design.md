# Skill-Set Dedup (Increment 2: Export/Import Bundle) — Design Spec

**Date:** 2026-07-07
**Status:** Approved, ready for implementation plan
**Scope:** Increment 2 of 3. Change the archive's export (per-session and
export-all) to a self-contained **slim `{sessions, skillSets}` bundle**, and
teach the in-app import to accept it — while still accepting legacy fat exports.

## Goal

Shrink exported files (and make export-all much smaller for a multi-session
archive) by carrying slim sessions plus the shared skill-set blobs they
reference, instead of a fat copy of the ~71 KB skills per session. One
consistent bundle format for both per-session and export-all.

Builds on increment 1's `skillSets` store + `skillset.js` helpers. Increment 3
(slim Pi sync + Pi-page import) is out of scope.

## Context (current state)

- `src/screens/Archive.jsx`: per-session **JSON** = `getSession(id)` (hydrated
  fat) → download; **Export all** = `exportAll()` (= `getAllSessions`, hydrated
  fat) → download array; **Import** = `JSON.parse(file)` → `importSessions(data)`
  (accepts a single fat session or an array; gate requires `Array.isArray(s.skills)`).
- `src/lib/store.js` (increment 1): `dehydrate`/`hydrate` boundary; `skillSets`
  store; `putSkillSet`/`getSkillSet`; `store(mode)`/`reqP` helpers; `importSessions`
  upserts via `putSession` (which dehydrates).
- `src/lib/skillset.js`: `skillSetRef`, `blobOf`, `isSlim`, `slimSession`,
  `fattenSession`.

## Decisions (locked)

| Decision | Choice |
| --- | --- |
| Format | `{ format: 'aca-archive-v2', sessions: [slim…], skillSets: { ref: blob } }` — self-contained |
| Per-session export | A one-session bundle (`exportBundle([id])`), same format as export-all |
| Import | Detect a `{sessions, skillSets}` bundle → `importBundle`; else legacy fat (single or array) → `importSessions` |
| Import gate | Relaxed to accept a slim session (`skillSetRef` string) as well as fat (`skills` array) |
| Backward compat | Old fat exports (single session / array) still import; the Pi page/sync are UNCHANGED this increment |
| CSV export | Unchanged |

## Architecture

### 1. `src/lib/store.js` — bundle export/import + relaxed gate

- **`exportBundle(ids)` (new, async):** builds a slim, self-contained bundle for
  the given session ids (`undefined`/absent → all).
  - Read the raw stored records (`getAll` on `sessions`, *not* hydrated), filtered
    to `ids` when provided.
  - For each record: if it is legacy **fat** (`s.skills`), slim it **in-memory**
    via `blobOf`/`skillSetRef`/`slimSession` and add its blob to `skillSets`
    (no store write); if already **slim**, keep it and `getSkillSet(ref)` its blob
    into `skillSets` (skip if the blob is unexpectedly missing).
  - Return `{ format: 'aca-archive-v2', sessions, skillSets }`.
- **`importBundle(bundle)` (new, async):** `await putSkillSet(ref, blob)` for each
  entry in `bundle.skillSets`, then `return importSessions(bundle.sessions || [])`.
- **`importSessions` gate relaxed:** accept `s` when `isV3Session(s) &&
  typeof s.id === 'string' && Array.isArray(s.results) && (Array.isArray(s.skills)
  || typeof s.skillSetRef === 'string')`. A slim session's `putSession` dehydrates
  to a no-op (already slim) and stores it; its blob was imported first by
  `importBundle`.
- `exportAll` (legacy alias) may remain for internal callers but is no longer used
  by the screen; the screen uses `exportBundle`.

### 2. `src/screens/Archive.jsx` — use the bundle + detect on import

- Per-session **JSON**: `const b = await exportBundle([id])` → download
  `aca-assessment-<id>.json` = `JSON.stringify(b, null, 2)`.
- **Export all**: `const b = await exportBundle()` → download
  `aca-archive-<date>.json` (date from the newest session's `createdAt`, as now).
- Per-session **CSV**: unchanged (`getSession` → `sessionToCsv`).
- **Import** (`importFile`): parse JSON; if the parsed value is a bundle
  (`data && Array.isArray(data.sessions) && data.skillSets`), call
  `importBundle(data)`; otherwise `importSessions(data)` (legacy fat single/array).
  Report the imported count; the "0 valid" message and error handling stay as-is.

### 3. Everything else — no change

`getSession`/`getAllSessions`/`listSummaries` and all readers are untouched
(exports go through the new `exportBundle`, imports land via `putSession`'s
existing dehydrate). The Pi server, `sync.js`, and PDF/CSV are unchanged.

## Data flow

Export: Archive → `exportBundle(ids?)` → raw slim sessions + referenced blobs →
one JSON file. Import: Archive → parse → bundle? `importBundle` (blobs first, then
slim sessions) : `importSessions` (fat) → `putSession` per session. Device
migration: Export all on device A → Import the bundle on device B → every session
returns, hydrated fat on read.

## Error handling / edge cases

- **Legacy-fat stored record in `exportBundle`** → slimmed in-memory into the
  bundle (no store mutation); its blob is added under its content hash.
- **Slim record whose blob is missing** at export (shouldn't happen) → include the
  slim session but skip the absent blob; on re-import it stores slim and hydrate
  later returns it unchanged (the increment-1 defensive path). Rare/defensive.
- **Import of a bundle with some invalid sessions** → `importSessions`'s per-entry
  gate skips them and imports the rest (returns the valid count).
- **Import of malformed JSON** → caught, archive untouched, error message (as now).
- **Legacy fat file** (single session or array) → detected as non-bundle →
  `importSessions` handles it exactly as today.
- **A bundle re-imported** → idempotent: `putSkillSet` is a content-keyed upsert;
  `putSession` upserts by id.

## Testing

- **Unit — `store.js` (fake-indexeddb):**
  - `exportBundle()` over a mix of slim and legacy-fat stored records returns
    `{format, sessions, skillSets}` where every session is slim (has `skillSetRef`,
    no `skills`) and every referenced ref is present in `skillSets`; no store
    mutation occurs (a legacy-fat record stays fat in the store after export).
  - `exportBundle([id])` returns just that one session + its one blob.
  - `importBundle(exportBundle(...))` round-trips: after clearing the DB and
    importing, `getSession(id)` returns a fat session deep-equal to the original.
  - `importSessions` accepts a slim session when its blob is already stored, and
    still accepts a fat session; a slim session whose gate fails (no results) is
    skipped.
  - Dedup: an export-all bundle of two same-config sessions has exactly one
    `skillSets` entry.
- **`Archive.jsx` is a thin view** — not render-tested; verified by the store
  tests + a manual check: export all → clear/reimport → all sessions return;
  per-session JSON export is a one-session bundle; a legacy fat file still imports.

## Out of scope (this increment)

- **Increment 3:** slim Pi sync + a Pi `skillSets` store + updating the Pi
  `/sessions` page import to accept bundles. (Until then, a bundle file cannot be
  imported through the Pi page; the in-app Archive import handles it.)
- CSV changes, results-array compaction, and orphaned-`skillSet` garbage
  collection.
