# Past Assessments, Teaching Links & Progressive L2 — Design

**Date:** 2026-07-05
**Status:** Approved design → ready for implementation plan
**Repo:** kenbolton/aca-skills-assessment (indie project)

## Summary

Three independent enhancements to the ACA Skills Assessment PWA:

- **C — Progressive L2 order:** reorder L2 skills so dry boat-handling is assessed
  before rescues ("move the boat around before getting wet").
- **A — Past-assessments page + delete:** a Pi-only page listing synced sessions
  (date, level, participants) with per-row download and delete.
- **B — Teaching links per skill:** on the Pi build, each skill's rate screen
  links to the instructor's lesson (games/drills), converted from Org to HTML.

They are gated so the **public github.io site only receives Part C**. Parts A and
B are exclusive to the self-hosted Pi instance.

**Build order:** C (data-only) → A (self-contained server feature) → B (needs the
Org→HTML pipeline).

## Global Constraints

- No new runtime dependencies. Pandoc (already installed) is a build-time tool
  for Part B only.
- Parts A and B are **Pi-only**; the public build must not ship them. Gating:
  all private-build UI (the Sync button, Part A's Setup link, and Part B's
  teaching links) is shown only when `import.meta.env.VITE_PRIVATE === 'true'` —
  a single "private build" flag. Implementation **renames** the current
  `VITE_ENABLE_SYNC` to `VITE_PRIVATE` (update `Review.jsx`'s gating plus the Pi
  build command and `pi/README.md`). Part A's server routes exist only in
  `pi/sync-server.mjs`, which the public (GitHub Pages) deploy never runs.
- Instructor lesson content (`.org` sources and generated HTML) must **never** be
  committed to the public repo. Only the `skillId → slug` map (`lessons.json`,
  filenames only) is committed.
- Security boundary is the tailnet. All session/lesson file access on the server
  must sanitize identifiers and refuse paths that resolve outside their root.
- Teaching lessons are **bundled into the Pi build and precached** by the service
  worker, so they are available offline alongside the assessment (review drills on
  the water). They are kept out of the public build via a git-ignored
  `public/lessons/` that only the Pi build populates (see Part B).
- Node ≥ 22 (LTS), ES modules throughout (matches the existing app).

---

## Part C — Progressive L2 order

**Change:** reorder the `categories` array of the `L2` level in
`src/data/skills.json` to this sequence (following Foundations One → Two):

1. Core: Strokes
2. Core: Maneuvers
3. Core: Edging and Support
4. Core: Awareness and Seamanship
5. Core: Incident Prevention and Management
6. Core: Trip Planning and Navigation
7. **Core: Rescues and Towing**  ← moved from position 4 to after the dry skills
8. Venue (Developing): Currents
9. Venue (Developing): Wind and Waves
10. Venue (Developing): Rocky Shorelines

- Skills within each category and all other fields are unchanged.
- L1 is unchanged (per decision).
- No code changes. The rate screen already iterates `session.skills` in order, so
  the flat order simply follows the new category order.

**Testing:** the existing suite is order-tolerant; confirm 53 tests still pass and
the config still validates (43 L1 core; 36 L2 core + 19 optional; 98 unique ids).
Add one assertion that in an L2 session the first Rescues skill's flat index is
greater than the last Trip-Planning skill's index (locks the "wet last" order).

**Affects:** both the public site and the Pi (the reorder is a general
improvement).

---

## Part A — Past-assessments page + delete (Pi server)

All changes are in `pi/sync-server.mjs` plus one shared helper. No new deps.

### Server routes (added before the static/SPA fallback)

- `GET /api/sessions` → `200` JSON array of summaries, newest first:
  ```ts
  { id: string, createdAt: string, levelId: string, levelName: string,
    paddlers: string[], counts: { core: number, rated: number } }
  ```
  Built by reading every `pi/sessions/*.json`, parsing, and projecting the fields.
  A file that fails to parse is skipped (logged), not fatal.
- `GET /api/sessions/:id.json` → the raw session file (`200` / `404`).
- `GET /api/sessions/:id.csv` → `text/csv` via the app's existing
  `sessionToCsv` (imported from `../src/lib/csv.js` — it is pure and has no
  browser dependency), `Content-Disposition: attachment`.
- `DELETE /api/sessions/:id` → deletes `pi/sessions/<id>.json`, `200 {deleted:true}`
  or `404`. The `:id` is sanitized to `[a-z0-9_-]` and the resolved path must
  stay within the sessions dir (else `400`).
- `GET /sessions` → a self-contained HTML page (inline CSS/JS, teal theme) that
  `fetch`es `/api/sessions` and renders a table: **Date · Level · Participants**,
  with per-row **Download CSV**, **Download JSON**, and **Delete**. Delete calls
  the DELETE endpoint after a `confirm()` and removes the row on success.

### Identifier safety (shared helper)

`safeSessionPath(id)`: sanitize `id` (`replace(/[^a-z0-9_-]/gi,'_')`), `join`
with the sessions dir, and verify `resolved.startsWith(SESSIONS)`; return null if
not. Used by the `:id` read/csv/delete routes. Mirrors the existing static-handler
guard.

### App wiring (gated)

`src/screens/Setup.jsx`: when `import.meta.env.VITE_PRIVATE === 'true'`, show a
small "Past assessments →" link to `/sessions` (a normal anchor; opens the page).
Hidden on the public build.

### Error handling

- Corrupt/partial session file → skipped from the list (never 500 the page).
- Unknown id → 404. Bad/escaping id → 400.
- Empty sessions dir → `[]` and an empty-state message on the page.

### Testing

- Unit-test the summary projection (`sessionSummary(session)` pure function:
  session → `{id, createdAt, levelId, levelName, paddlers, counts}`) and
  `safeSessionPath` (accepts a clean id; rejects `../`, absolute, and
  encoded-traversal ids).
- Manual on the Pi: sync 2 sessions, load `/sessions`, verify rows show date/
  level/names, download CSV/JSON, delete one (confirm), verify the file is gone
  and the row disappears; confirm a traversal id (`..%2f..%2fetc`) is rejected.

---

## Part B — Teaching links per skill (Pi only)

> **REVISED at implementation:** lessons are shown **inline** on the Rate screen as a
> collapsible section (fragments bundled via `import.meta.glob` from a git-ignored
> `lessons-content/`, rendered with `dangerouslySetInnerHTML`), not as an
> iframe/external link. Still bundled + precached (offline) and private-only; the
> public build simply has no fragments to bundle.

### Conversion pipeline — `tools/build-lessons.mjs` (run on the Mac)

- Input: a lessons source dir (default `~/Documents/ACA/2024/Lessons`, overridable
  via `LESSONS_SRC`).
- For each mapped lesson `.org`, run `pandoc -f org -t html5 --standalone
  --metadata title=<name>` and wrap/inject a small shared CSS (teal header,
  readable body, back-link) → `<outdir>/<slug>.html` (default outdir
  `public/lessons/`, so Vite bundles + precaches it in the Pi build).
- Emit/refresh `src/data/lessons.json`: `{ "<skillId>": "<slug>", ... }`.
- Mapping is an explicit table in the script (extensible), seeded with:
  | Org file | skillId | slug |
  |---|---|---|
  | Forward Paddling.org | l2-forward | forward-paddling |
  | Reverse Paddling.org | l2-reverse | reverse-paddling |
  | Stopping.org | l2-stopping | stopping |
  | Forward and Reverse Sweep.org | l2-sweep | forward-reverse-sweep |
  | Capsize and Wet Exit.org | l2-wet-exit | capsize-wet-exit |
  | Assisted Rescues and Deep-Water Re-Entry.org | l2-assisted-rescue | assisted-rescues |
- Skips mappings whose `.org` is missing (warns). Adding a lesson = add a row +
  the `.org`, re-run.

### Committed vs private (git-ignored)

- **Committed to the repo:** `tools/build-lessons.mjs` and `src/data/lessons.json`
  (a `skillId → slug` map — filenames only, not sensitive).
- **Git-ignored, private build only:** `public/lessons/*.html` (the actual lesson
  content). Add `public/lessons/` to `.gitignore`. Generated on the Mac and synced
  to the Pi; they never touch GitHub, so the public site cannot serve them.

### Bundling & precache (no server route)

Because the lessons live under `public/`, the **Pi build** (`VITE_PRIVATE=true`,
with `public/lessons/` populated) copies them into `dist/lessons/`, and the
existing workbox `globPatterns` (which include `html`) precache them — so teaching
pages work **offline**, served by the app/PWA itself. The **public CI build** has
an empty (git-ignored) `public/lessons/`, so its `dist` contains no lessons. No
dedicated server route is needed: the Pi's existing static handler serves
`dist/lessons/<slug>.html`.

### App wiring (gated)

`src/screens/Rate.jsx`: import `lessons.json`. On the current skill, when
`import.meta.env.VITE_PRIVATE === 'true'` **and** `lessons[skill.id]` exists,
render a "📖 Teaching notes & drills" link pointing at
`${import.meta.env.BASE_URL}lessons/${lessons[skill.id]}.html`
(`target="_blank" rel="noopener"`) in the skill header. Public build: flag off →
never rendered.

### Deploy changes

- Pi build command becomes `BASE_PATH=/ VITE_PRIVATE=true npm run build`.
- Regenerate + sync lessons before building on the Pi:
  1. On the Mac: `node tools/build-lessons.mjs` (writes `public/lessons/*.html`,
     refreshes `src/data/lessons.json`).
  2. rsync `public/lessons/` → the Pi's `~/aca-skills-assessment/public/lessons/`.
  3. On the Pi: rebuild (command above) and `sudo systemctl restart aca-assessment`.
  Documented step-by-step in `pi/README.md`. Commit the refreshed
  `src/data/lessons.json`; the HTML stays rsync-only.

### Testing

- Unit-test that `lessons.json` parses and every value is a non-empty slug string.
- Build check: a `VITE_PRIVATE=true` build with a populated `public/lessons/`
  emits `dist/lessons/<slug>.html` (in the precache manifest); a default (public)
  build with an empty `public/lessons/` emits none.
- Manual on the Pi: open a mapped skill (Forward Paddling) → the teaching link
  appears and opens the lesson **offline**; an unmapped skill shows no link; the
  public site shows no teaching links.

---

## Files touched (summary)

- **Flag rename (prereq):** `src/screens/Review.jsx` (`VITE_ENABLE_SYNC` →
  `VITE_PRIVATE`); Pi build command + `pi/README.md`.
- **C:** `src/data/skills.json` (reorder), `tests/skills.test.js` (+order assert).
- **A:** `pi/sync-server.mjs` (session routes + `/sessions` page + `safeSessionPath`
  helper), `src/lib/session-summary.js` (+ `sessionSummary`, pure, tested),
  `tests/session-summary.test.js`, `src/screens/Setup.jsx` (gated link).
- **B:** `tools/build-lessons.mjs` (new), `src/data/lessons.json` (new),
  `src/screens/Rate.jsx` (gated link), `.gitignore` (+`public/lessons/`),
  `pi/README.md` (deploy steps). No new server route (static handler serves
  `dist/lessons/`).

## Open items for Ken

- Confirm the 6 skill→lesson mappings and slugs above.
- The lesson `.org` Assessment sections are richer than the current
  `skills.json` standards; optionally sync that wording later (out of scope here).
