# On-Device Assessment Archive — Design Spec

**Date:** 2026-07-07
**Status:** Approved, ready for implementation plan
**Scope:** Replace the single-session localStorage model with a local
**IndexedDB archive** of many assessments, plus an in-app **Archive** management
screen (list · resume · delete · export · import). Universal (both builds).

## Goal

Let users keep a whole library of assessments on their own device and manage
them — list, resume, delete, export (per-session and whole-archive), import —
including moving the entire archive to a new device. This is also the local
history substrate the future paddler-profiles feature will build on.

## Context (current state)

- **Storage today:** one session under `localStorage['aca-assessment:session']`.
  `saveSession`/`loadSession`/`clearSession` (`src/lib/session.js`) are
  synchronous; `app.jsx` boots via `useState(() => loadSession())`.
- A full L4 5-paddler session is ~132 KB (embeds the skills array + per-paddler
  results), so localStorage (~5 MB) holds only ~38 — inadequate for "lots".
- **The Pi "Past assessments" page** (`pi/sync-server.mjs`, private build only)
  is the reference management UI: list, Resume (writes the session to
  `localStorage['aca-assessment:session']` then loads the app), Delete, Import
  (POST `/sync`), per-session CSV/JSON export.
- `sessionSummary(session)` → `{ id, createdAt, participants, selfAssessment,
  counts:{core,rated}, targets, landings, level }` (list rows). `sessionToCsv`
  exists. Pure session logic (`createSession`, `setRating`, …) stays unchanged.

## Decisions (locked)

| Decision | Choice |
| --- | --- |
| Storage | **IndexedDB** (thousands of sessions; async) |
| Reach | **Universal** — both builds use it as the working store; Pi sync stays a private-build extra |
| Model | **Archive is the single source of truth** — every session (incl. in-progress) is a record keyed by `id`; a `currentId` pointer marks the open one; autosave-per-tap upserts it |
| Migration | On boot, drain legacy `localStorage['aca-assessment:session']` into the archive (migrates existing users **and** preserves the Pi "Resume") |
| "Start over" | **Destructive** — deletes the open assessment's record (existing confirm) |
| Import/Export | Per-session Export JSON/CSV; **Export all** (whole archive as one JSON bundle); **Import** accepts a single session *or* a bundle, upserting by `id` (idempotent merge) — the device-migration path |
| Store tests | Add **`fake-indexeddb`** as a **dev-only** dependency to unit-test the store |

## Architecture

### 1. `src/lib/store.js` (new) — the only IndexedDB code

Async wrapper over one IndexedDB database (`aca-assessment`, v1) with a single
object store `sessions` (keyPath `id`). The `currentId` pointer lives in
`localStorage['aca-assessment:current']` (tiny, ephemeral UI state; kept out of
the object store deliberately). API:

- `initStore(): Promise<void>` — opens the DB and runs `migrateLegacy()` once.
- `putSession(session): Promise<void>` — upsert by `id` (autosave calls this).
- `getSession(id): Promise<session|null>`.
- `deleteSession(id): Promise<void>`.
- `listSummaries(): Promise<Summary[]>` — all sessions mapped through
  `sessionSummary`, sorted by `createdAt` descending.
- `getCurrentId(): string|null` / `setCurrentId(id|null): void` — localStorage.
- `exportAll(): Promise<session[]>` — every stored session (for the bundle).
- `importSessions(input): Promise<number>` — accepts one session object **or**
  an array; validates each is a v3 session (`paddlers[0].target` present) and
  upserts by `id`; returns the count imported. Invalid entries are skipped.
- `migrateLegacy(): Promise<void>` — if `localStorage['aca-assessment:session']`
  holds a valid v3 session, upsert it, set it as `currentId`, and remove the
  legacy key. (This is also how the Pi "Resume" — which writes that key — lands
  a session into the archive.)

Reuses `sessionSummary` and the v3 validation already in `session.js`
(`loadSession`'s shape check) — factor that check into a shared
`isV3Session(s)` helper if convenient.

### 2. `src/app.jsx` — async boot + archive-aware actions

- Boot: `const [ready, setReady] = useState(false)` + an effect that
  `await initStore()`, then loads `getCurrentId()`'s session via `getSession`
  (missing/absent → none), setting `session`/`screen` and `ready`. Render a
  minimal "Loading…" state until `ready`.
- `begin(s)` — `putSession(s)`, `setCurrentId(s.id)`, open rate.
- `update(s)` — `putSession(s)` (autosave; fire-and-forget, never blocks a tap).
- `reset()` — confirm, then `deleteSession(currentId)`, `setCurrentId(null)`,
  go to Setup (destructive, per decision).
- `resume(id)` — `setCurrentId(id)`, `getSession(id)` → open review (or rate).
- New nav target `screen === 'archive'` → the Archive screen; Setup and the
  Archive screen link to each other.

### 3. `src/screens/Archive.jsx` (new) — management UI

Loads `listSummaries()`. Renders a list; each row shows date · level ·
participants · `rated/core` progress · a "self" tag, with actions: **Resume**
(→ `resume(id)`), **Delete** (confirm → `deleteSession`, refresh),
**Export JSON** and **Export CSV** (per session, via a Blob download reusing
`sessionToCsv`). Screen-level actions: **Export all** (download
`exportAll()` as one `aca-archive-<date>.json`) and **Import** (file input →
parse JSON → `importSessions` → refresh; reject non-JSON). Empty state when the
archive is empty. Reuses the existing Blob-download helper pattern from
`Review.jsx`.

### 4. Setup entry point

`Setup.jsx`'s "Past assessments" link becomes **public** (currently
private-only) and navigates to the Archive screen. The private build
additionally keeps the Pi page + Sync button as-is.

## Data flow

Boot → `initStore` (+ legacy migration) → open `currentId`'s session or Setup.
Rate/Review → `update` → `putSession` (autosave). Setup → `begin` → new record +
current. Archive → Resume/Delete/Export/Import operate directly on the store.
Device change → **Export all** (bundle) on device A → **Import** on device B
(upsert by id). Nothing except an explicit Delete / "Start over" removes a
record.

## Error handling / edge cases

- **IndexedDB unavailable / open fails** (private-mode quirks): `initStore`
  surfaces a clear error state ("couldn't open local storage") rather than a
  blank app; the app still runs for a fresh in-memory session (no persistence).
- **`currentId` points to a deleted/missing session** → treated as none → Setup.
- **Import** of malformed JSON → error message, archive untouched; a bundle with
  some invalid entries imports the valid ones and reports the count.
- **Autosave failure** (quota, transaction error) → logged, never throws into
  the tap handler (assessment continues; consistent with offline-first).
- **Legacy migration** runs once; the legacy key is removed after a successful
  upsert so it can't re-migrate a stale copy over a newer archived version.
- **Quota** — IndexedDB is large but not infinite; a write failure is surfaced,
  not silent.

## Testing

- **Unit — `store.js`** (with `fake-indexeddb/auto` registering `indexedDB` in
  the node env; each test resets via `indexedDB.deleteDatabase` or a fresh DB
  name): `putSession`/`getSession` round-trip; `listSummaries` returns summaries
  newest-first; `deleteSession` removes; `getCurrentId`/`setCurrentId`;
  `exportAll` returns all; `importSessions` accepts a single session and a
  bundle, upserts by id (re-import is idempotent), and skips invalid entries;
  `migrateLegacy` moves a legacy localStorage session into the store, sets
  current, and clears the key.
- **Unit — `isV3Session`** helper: accepts a v3 session, rejects v2/garbage.
- **Thin views** (`app.jsx` async boot, `Archive.jsx`) — not unit-tested by
  rendering (node env, no DOM); verified by the store tests plus a manual check:
  create several assessments, see them listed, resume one, delete one, export
  all → re-import into a cleared archive → everything returns.

## Out of scope (YAGNI)

- Paddler identity / profiles (a later feature this archive enables).
- The **session-slimming** optimization (rehydrate skills from bundled data) —
  explicitly queued as the **next** feature.
- Cloud/multi-device sync beyond the existing Pi and the manual export/import.
- Search, filter, rename, or tagging of archive entries.
- Any change to the PDF/CSV formats or the Pi server.
