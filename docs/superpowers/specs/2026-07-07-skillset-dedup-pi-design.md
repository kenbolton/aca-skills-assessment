# Skill-Set Dedup (Increment 3: Pi Sync + Hydration) — Design Spec

**Date:** 2026-07-07
**Status:** Approved, ready for implementation plan
**Scope:** Increment 3 of 3 (final). Slim the Pi sync payload and store: the app
syncs a one-session **bundle**; the Pi stores slim sessions + a shared
`skillSets` store and **hydrates on every read path**. Completes the dedup arc.

## Goal

Shrink what crosses the wire to the Pi (and what the Pi stores per session) by
sending/storing slim sessions + shared skill-set blobs, while keeping the Pi's
list, CSV, and Resume working exactly as before — and, as a bonus, making the
Pi's `/sessions` **Import** accept the increment-2 bundle files.

Builds on increments 1–2 (`skillset.js` helpers, the `aca-archive-v2` bundle
format).

## Context (current state)

- `src/lib/sync.js`: `syncSession(session)` POSTs `JSON.stringify(session)` (the
  in-memory **fat** session) to `/sync`. Called by the `SyncButton`.
- `pi/sync-server.mjs` (imports `sessionSummary`, `sessionToCsv`,
  `safeSessionPath` from `../src/lib/`):
  - `POST /sync` — validates (`session.id` string, `session.results` array),
    writes `pi/sessions/<id>.json` (fat).
  - `GET /api/sessions` — `listSummaries()` maps each stored file through
    `sessionSummary` (needs `skills`/`scales`).
  - `GET /api/sessions/<id>.json` — the **Resume** payload (client writes it to
    `localStorage['aca-assessment:session']`, then loads the app).
  - `GET /api/sessions/<id>.csv` — `sessionToCsv` (needs `skills`/`scales`).
  - `DELETE /api/sessions/<id>` — deletes the file (no skills needed).
  - `/sessions` page **Import** — POSTs the chosen file to `/sync`.
- `src/lib/skillset.js` is pure JS (no browser APIs), so the Node Pi server can
  import it.

## Decisions (locked)

| Decision | Choice |
| --- | --- |
| Sync payload | A one-session **`aca-archive-v2` bundle** (`{format, sessions:[slim], skillSets:{ref:blob}}`), built in-memory from the fat session |
| `/sync` accepts | A **bundle** (write blobs + slim sessions) OR a legacy **fat** session (backward compat). This unifies app-sync and the `/sessions` Import |
| Pi storage | Slim `pi/sessions/<id>.json` + shared `pi/skillsets/<ref>.json`; `ref` validated `^sk-[0-9a-f]{8}$` (no path traversal) |
| Pi reads | **Hydrate on read** in `listSummaries`, CSV, and the Resume JSON (which serves **fat**, so the app's resume flow is unchanged) |
| Backward compat | Existing fat `pi/sessions/*.json` pass through hydrate untouched; no bulk migration |
| Verification | Pi HTTP paths verified with live `curl` against the deployed Pi (no Pi test harness); the pure bundle/hydrate logic is unit-tested |

## Architecture

### 1. `src/lib/skillset.js` — a pure `bundleOf` + shared format constant

```js
export const BUNDLE_FORMAT = 'aca-archive-v2';

// Build a bundle from in-memory (fat) sessions: slim each and collect its blob.
export function bundleOf(sessions) {
  const skillSets = {};
  const slim = sessions.map(s => {
    if (!s.skills) return s;               // already slim
    const blob = blobOf(s);
    const ref = skillSetRef(blob);
    skillSets[ref] = blob;
    return slimSession(s, ref);
  });
  return { format: BUNDLE_FORMAT, sessions: slim, skillSets };
}
```

`src/lib/store.js` replaces its local `const BUNDLE_FORMAT = 'aca-archive-v2'`
with an import of this constant (keep one source of truth).

### 2. `src/lib/sync.js` — send a bundle

`syncSession(session, baseUrl)` builds `bundleOf([session])` and POSTs
`JSON.stringify(bundle)` to `/sync` (everything else — error handling, return
shape — unchanged). The `SyncButton` is untouched (still calls
`syncSession(session)` with the fat in-memory session).

### 3. `pi/sync-server.mjs` — skillSets store, bundle `/sync`, hydrate on read

- Import `isSlim`, `fattenSession` from `../src/lib/skillset.js`.
- New `pi/skillsets/` dir (created at startup like `pi/sessions/`);
  `safeSkillSetPath(ref)` = `join(SKILLSETS, ref + '.json')` only when
  `^sk-[0-9a-f]{8}$` matches, else `null`; `readSkillSet(ref)` / `writeSkillSet(ref, blob)`.
- **`hydrate(session)`** (Pi-side): `if (!session || session.skills ||
  typeof session.skillSetRef !== 'string') return session;` else read the blob
  via `readSkillSet` — if missing, return the session unchanged; else
  `fattenSession(session, blob)`.
- **`POST /sync`:** parse JSON; if it is a bundle (`Array.isArray(data.sessions)
  && data.skillSets`): `writeSkillSet` each valid-ref blob, then write each slim
  session (validate `id` string + `results` array, via `safeSessionPath`);
  return `{ syncedAt, imported: n }`. Otherwise treat it as a legacy fat session
  exactly as today.
- **Hydrate the read paths:** `listSummaries` maps each file through
  `sessionSummary(await hydrate(parsed))`; `/api/sessions/<id>.json` serves
  `JSON.stringify(await hydrate(session), null, 2)`; `/api/sessions/<id>.csv`
  serves `sessionToCsv(await hydrate(session))`. `DELETE` and the static/`/sessions`
  paths are unchanged.

## Data flow

Sync: `SyncButton` → `syncSession(fat)` → `bundleOf([fat])` → POST bundle →
Pi writes the blob(s) + slim session(s). Pi list/CSV/Resume: read slim file →
`hydrate` (join the blob) → fat → `sessionSummary`/`sessionToCsv`/served. Resume:
Pi serves fat → client writes to `localStorage` → app `migrateLegacy` → the app
re-slims into its own IndexedDB. A `/sessions` **Import** of a bundle file →
POST to `/sync` → same bundle path.

## Error handling / edge cases

- **Legacy fat `pi/sessions/*.json`** → `hydrate` returns them unchanged (they
  have `skills`); still listed/exported/resumed correctly.
- **Slim session whose blob file is missing** → `hydrate` returns it slim;
  `sessionSummary`/`sessionToCsv` then see no skills. Shouldn't happen because
  `/sync` writes blobs before sessions; defensive.
- **Malformed `ref`** (path-traversal attempt) → `safeSkillSetPath` returns
  `null`; the blob is skipped on write and read.
- **Bundle with an invalid session** (no `results`/`id`) → skipped; valid ones
  written; `imported` count reflects the valid ones.
- **Legacy fat single-session POST** (old app version still syncing, or an old
  fat export imported via the page) → handled by the unchanged fat path.
- **Blob dedup on the Pi** → `writeSkillSet` overwrites the same `ref` file
  idempotently; many sessions share one blob file.

## Testing

- **Unit — `skillset.js` `bundleOf`:** fat sessions → `{format, sessions:[slim],
  skillSets}` with slim sessions (no `skills`, has `skillSetRef`) and the blob
  present; an already-slim input passes through; two same-config sessions dedup
  to one skillSet.
- **Unit — `sync.js`:** with a mocked `fetch`, `syncSession(fatSession)` POSTs a
  body that parses to a bundle (`format` + `sessions[0].skillSetRef` + the blob),
  and returns the existing `{ok, syncedAt}` / error shapes.
- **Pi server** (no unit harness): verified by **live `curl` against the deployed
  Pi** — POST a bundle to `/sync`; `GET /api/sessions` lists it (hydrated
  summary); `GET /api/sessions/<id>.json` returns a **fat** session;
  `GET /api/sessions/<id>.csv` produces correct CSV; confirm a
  `pi/skillsets/<ref>.json` file exists and is shared; and a legacy fat
  `pi/sessions/*.json` still lists/exports. This is part of the deploy step.

## Out of scope

- Results-array compaction; orphaned-`skillSet` garbage collection (app or Pi);
  any change to the `/sessions` page HTML beyond it already POSTing files to
  `/sync` (which now accepts bundles).
