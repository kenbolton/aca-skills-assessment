# Past Assessments, Teaching Links & Progressive L2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Pi-only past-assessments page (with delete), Pi-only per-skill teaching links (offline-precached lessons), and a progressive L2 skill order — all gated so the public site gets only the reorder.

**Architecture:** Reuse the existing pure lib modules; add two small pure modules (`session-summary`, `safe-session-path`) that both the app and the Pi server import. The Pi server (`pi/sync-server.mjs`) gains a session API + an HTML page. Teaching lessons are generated from Org to HTML into a git-ignored `public/lessons/` that only the private build bundles and precaches. One build flag `VITE_PRIVATE` gates every private-only UI element.

**Tech Stack:** Vite + Preact, Node built-in `http` server, Vitest, pandoc (build-time only, Part B).

## Global Constraints

- No new runtime dependencies. Node ≥ 22, ES modules throughout.
- Private-only UI (Sync button, past-assessments link, teaching links) renders only when `import.meta.env.VITE_PRIVATE === 'true'`. This flag **replaces** `VITE_ENABLE_SYNC`.
- Instructor lesson HTML lives only in git-ignored `public/lessons/`; never commit it. Only `src/data/lessons.json` (a `skillId → slug` map) is committed.
- All server file access by id must sanitize the id and reject paths resolving outside their root.
- The public GitHub Pages build must ship only Part C (the reorder).
- Work in the repo root of `kenbolton/aca-skills-assessment`. Run tests with `npm test` (currently 53 passing). Run builds with `npm run build`.

---

## File Structure

- `src/screens/Review.jsx` — rename flag (Task 1).
- `src/data/skills.json` — L2 category reorder (Task 2).
- `tests/skills.test.js` — order assertion (Task 2).
- `src/lib/session-summary.js` + `tests/session-summary.test.js` — new pure summary (Task 3).
- `src/lib/safe-session-path.js` + `tests/safe-session-path.test.js` — new pure path guard (Task 4).
- `pi/sync-server.mjs` — session API + `/sessions` page (Task 5).
- `src/screens/Setup.jsx` — gated past-assessments link (Task 6).
- `tools/build-lessons.mjs` + `src/data/lessons.json` + `.gitignore` — lesson pipeline (Task 7).
- `tests/lessons.test.js` — lessons.json validation (Task 7).
- `src/screens/Rate.jsx` — gated teaching link (Task 8).
- `pi/README.md` — deploy docs (Tasks 1 & 7).

---

### Task 1: Rename `VITE_ENABLE_SYNC` → `VITE_PRIVATE`

**Files:**
- Modify: `src/screens/Review.jsx:10`
- Modify: `pi/README.md` (build command)

**Interfaces:**
- Produces: the `VITE_PRIVATE` build flag convention used by Tasks 6 and 8.

- [ ] **Step 1: Change the flag in `src/screens/Review.jsx`**

Replace line 10:
```js
const SYNC_ENABLED = import.meta.env.VITE_ENABLE_SYNC === 'true';
```
with:
```js
const SYNC_ENABLED = import.meta.env.VITE_PRIVATE === 'true';
```

- [ ] **Step 2: Update the Pi build command in `pi/README.md`**

Find the build command line containing `VITE_ENABLE_SYNC=true` and replace it with:
```bash
BASE_PATH=/ VITE_PRIVATE=true npm run build
```
Also update the surrounding prose that explains the flag (replace `VITE_ENABLE_SYNC` with `VITE_PRIVATE`; it now enables all private-instance features: the Sync button, the past-assessments page link, and teaching links).

- [ ] **Step 3: Verify public build hides sync, private build shows it**

Run:
```bash
npm run build && grep -c "Sync to Pi" dist/assets/*.js | grep -v ':0' || echo "public: sync absent (correct)"
VITE_PRIVATE=true npm run build && grep -rl "Sync to Pi" dist/assets/*.js >/dev/null && echo "private: sync present (correct)"
```
Expected: "public: sync absent (correct)" then "private: sync present (correct)".

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: 53 passed.

- [ ] **Step 5: Commit**

```bash
git add src/screens/Review.jsx pi/README.md
git commit -m "refactor: rename VITE_ENABLE_SYNC to VITE_PRIVATE (single private-build flag)"
```

---

### Task 2: Progressive L2 order (Rescues after dry skills)

**Files:**
- Modify: `src/data/skills.json` (L2 `categories` order)
- Test: `tests/skills.test.js`

**Interfaces:**
- Consumes: `loadConfig`, `skillsForLevel` from `src/lib/skills.js`.

- [ ] **Step 1: Write the failing test** — append to `tests/skills.test.js`

```js
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

test('L2 assesses dry boat-handling before rescues (progressive order)', () => {
  const raw = JSON.parse(readFileSync(
    fileURLToPath(new URL('../src/data/skills.json', import.meta.url)), 'utf8'));
  const cfg = loadConfig(raw);
  const flat = skillsForLevel(cfg, 'L2');
  const lastTripPlanning = flat.map(s => s.category).lastIndexOf('Core: Trip Planning and Navigation');
  const firstRescue = flat.findIndex(s => s.category === 'Core: Rescues and Towing');
  expect(lastTripPlanning).toBeGreaterThanOrEqual(0);
  expect(firstRescue).toBeGreaterThan(lastTripPlanning);
});
```
(Ensure `loadConfig` and `skillsForLevel` are imported at the top of the test file; they already are.)

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/skills.test.js`
Expected: FAIL — `firstRescue` (currently category index 3) is less than `lastTripPlanning`.

- [ ] **Step 3: Reorder the L2 categories in `src/data/skills.json`**

In the `L2` level object, move the entire `"Core: Rescues and Towing"` category object so it sits **immediately after** `"Core: Trip Planning and Navigation"` and **before** the three `"Venue (Developing): ..."` categories. Resulting L2 `categories` order (by `name`):
1. Core: Strokes
2. Core: Maneuvers
3. Core: Edging and Support
4. Core: Awareness and Seamanship
5. Core: Incident Prevention and Management
6. Core: Trip Planning and Navigation
7. Core: Rescues and Towing
8. Venue (Developing): Currents
9. Venue (Developing): Wind and Waves
10. Venue (Developing): Rocky Shorelines

Do not change any skill fields, ids, or the L1 level. Move the whole category block verbatim.

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test`
Expected: 54 passed (53 + the new order test). The config-validity tests still pass (43 L1 core; 36 L2 core + 19 optional; 98 unique ids).

- [ ] **Step 5: Commit**

```bash
git add src/data/skills.json tests/skills.test.js
git commit -m "feat: order L2 dry boat-handling before rescues (progressive assessment)"
```

---

### Task 3: `sessionSummary` pure module

**Files:**
- Create: `src/lib/session-summary.js`
- Test: `tests/session-summary.test.js`

**Interfaces:**
- Produces: `sessionSummary(session): { id, createdAt, levelId, levelName, paddlers: string[], counts: { core: number, rated: number } }`
  - `paddlers` = the paddler names in order.
  - `counts.core` = number of non-optional skills.
  - `counts.rated` = number of non-optional skills where every paddler has a non-null rating.
- Consumed by the Pi server (Task 5).

- [ ] **Step 1: Write the failing test** — `tests/session-summary.test.js`

```js
import { expect, test } from 'vitest';
import { sessionSummary } from '../src/lib/session-summary.js';

const session = {
  id: 'sess-1', createdAt: '2026-07-09T12:00:00Z', levelId: 'L2', levelName: 'Level 2',
  paddlers: [{ id: 'p1', name: 'Alex' }, { id: 'p2', name: 'Sam' }],
  skills: [
    { id: 'a', optional: false }, { id: 'b', optional: false }, { id: 'c', optional: true },
  ],
  results: [
    { paddlerId: 'p1', skillId: 'a', rating: 'meets' }, { paddlerId: 'p2', skillId: 'a', rating: 'meets' },
    { paddlerId: 'p1', skillId: 'b', rating: 'below' }, { paddlerId: 'p2', skillId: 'b', rating: null },
    { paddlerId: 'p1', skillId: 'c', rating: null }, { paddlerId: 'p2', skillId: 'c', rating: null },
  ],
};

test('sessionSummary projects id/date/level/paddlers and core counts', () => {
  const s = sessionSummary(session);
  expect(s).toMatchObject({ id: 'sess-1', createdAt: '2026-07-09T12:00:00Z', levelId: 'L2', levelName: 'Level 2' });
  expect(s.paddlers).toEqual(['Alex', 'Sam']);
  expect(s.counts).toEqual({ core: 2, rated: 1 }); // 'a' fully rated; 'b' not; 'c' optional excluded
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/session-summary.test.js`
Expected: FAIL — cannot resolve `../src/lib/session-summary.js`.

- [ ] **Step 3: Implement `src/lib/session-summary.js`**

```js
export function sessionSummary(session) {
  const core = session.skills.filter(s => !s.optional);
  let rated = 0;
  for (const skill of core) {
    const allRated = session.paddlers.every(p => {
      const r = session.results.find(x => x.paddlerId === p.id && x.skillId === skill.id);
      return r && r.rating !== null;
    });
    if (allRated) rated += 1;
  }
  return {
    id: session.id,
    createdAt: session.createdAt,
    levelId: session.levelId,
    levelName: session.levelName,
    paddlers: session.paddlers.map(p => p.name),
    counts: { core: core.length, rated },
  };
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test`
Expected: all pass including the new test.

- [ ] **Step 5: Commit**

```bash
git add src/lib/session-summary.js tests/session-summary.test.js
git commit -m "feat: add sessionSummary projection for the past-assessments list"
```

---

### Task 4: `safeSessionPath` pure module

**Files:**
- Create: `src/lib/safe-session-path.js`
- Test: `tests/safe-session-path.test.js`

**Interfaces:**
- Produces: `safeSessionPath(sessionsDir: string, id: string): string | null` — sanitizes `id` to `[a-z0-9_-]`, joins `<sessionsDir>/<id>.json`, and returns the absolute path only if it stays within `sessionsDir`; otherwise `null`.
- Consumed by the Pi server (Task 5).

- [ ] **Step 1: Write the failing test** — `tests/safe-session-path.test.js`

```js
import { expect, test } from 'vitest';
import { safeSessionPath } from '../src/lib/safe-session-path.js';

const DIR = '/srv/app/pi/sessions';

test('accepts a clean id and returns a path inside the dir', () => {
  const p = safeSessionPath(DIR, 'sess-123');
  expect(p).toBe('/srv/app/pi/sessions/sess-123.json');
});

test('sanitizes disallowed characters (no traversal escape)', () => {
  // slashes/dots become underscores -> stays inside DIR
  expect(safeSessionPath(DIR, '../../etc/passwd')).toBe('/srv/app/pi/sessions/______etc_passwd.json');
});

test('returns null for an id that sanitizes to empty', () => {
  expect(safeSessionPath(DIR, '')).toBeNull();
  expect(safeSessionPath(DIR, '///')).toBeNull();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/safe-session-path.test.js`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Implement `src/lib/safe-session-path.js`**

```js
import { join, resolve } from 'node:path';

export function safeSessionPath(sessionsDir, id) {
  const safe = String(id).replace(/[^a-z0-9_-]/gi, '_');
  if (!safe || /^_+$/.test(safe)) return null;
  const root = resolve(sessionsDir);
  const full = resolve(join(root, `${safe}.json`));
  if (full !== join(root, `${safe}.json`)) return null; // no normalization surprises
  if (!full.startsWith(root + '/')) return null;
  return full;
}
```
Note: the `'../../etc/passwd'` test expects each disallowed char (`.` `.` `/` `.` `.` `/`) to become `_`, yielding `______etc_passwd` — six leading underscores. `/^_+$/` only rejects all-underscore ids, so this is accepted and stays inside DIR.

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run tests/safe-session-path.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/safe-session-path.js tests/safe-session-path.test.js
git commit -m "feat: add safeSessionPath guard for session file access"
```

---

### Task 5: Pi server — session API + `/sessions` page

**Files:**
- Modify: `pi/sync-server.mjs` (full rewrite of the request handler; add imports + routes)

**Interfaces:**
- Consumes: `sessionSummary` (Task 3), `safeSessionPath` (Task 4), `sessionToCsv` from `../src/lib/csv.js`.
- Produces: routes `GET /api/sessions`, `GET /api/sessions/:id.json`, `GET /api/sessions/:id.csv`, `DELETE /api/sessions/:id`, `GET /sessions` (HTML).

- [ ] **Step 1: Replace `pi/sync-server.mjs` with the version below**

```js
import { createServer } from 'node:http';
import { readFile, writeFile, readdir, unlink, mkdir } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { sessionSummary } from '../src/lib/session-summary.js';
import { safeSessionPath } from '../src/lib/safe-session-path.js';
import { sessionToCsv } from '../src/lib/csv.js';

const PORT = process.env.PORT || 8787;
const DIST = decodeURI(new URL('../dist/', import.meta.url).pathname);
const SESSIONS = decodeURI(new URL('./sessions/', import.meta.url).pathname);
await mkdir(SESSIONS, { recursive: true });

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };

function body(req) {
  return new Promise((res, rej) => { let d = ''; req.on('data', c => (d += c)); req.on('end', () => res(d)); req.on('error', rej); });
}
function sendJson(res, code, obj) { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); }

async function readSession(id) {
  const p = safeSessionPath(SESSIONS, id);
  if (!p) return null;
  try { return JSON.parse(await readFile(p, 'utf8')); } catch { return null; }
}

async function listSummaries() {
  const files = (await readdir(SESSIONS)).filter(f => f.endsWith('.json'));
  const out = [];
  for (const f of files) {
    try { out.push(sessionSummary(JSON.parse(await readFile(join(SESSIONS, f), 'utf8')))); }
    catch (e) { console.error('skip bad session file', f, e.message); }
  }
  out.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return out;
}

function sessionsPage() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Past Assessments</title>
<style>
 body{font-family:system-ui,sans-serif;margin:0;color:#14323a}
 header{background:#005f6b;color:#fff;padding:1rem}
 header a{color:#bdeae2}
 main{padding:1rem;max-width:900px;margin:0 auto}
 table{width:100%;border-collapse:collapse}
 th,td{text-align:left;padding:.5rem;border-bottom:1px solid #ddd;vertical-align:top}
 button{min-height:40px}
 .del{background:#c0392b;color:#fff;border:0;border-radius:6px;padding:.25rem .6rem}
 .empty{color:#666}
</style></head><body>
<header><strong>Past Assessments</strong> &nbsp; <a href="/">&larr; Back to app</a></header>
<main><p class="empty" id="status">Loading…</p><table id="t" hidden><thead>
<tr><th>Date</th><th>Level</th><th>Participants</th><th>Rated</th><th>Export</th><th></th></tr>
</thead><tbody></tbody></table></main>
<script>
async function load(){
 const r=await fetch('/api/sessions'); const rows=await r.json();
 const t=document.getElementById('t'), s=document.getElementById('status');
 if(!rows.length){s.textContent='No saved assessments yet.';return;}
 s.hidden=true;t.hidden=false;const tb=t.querySelector('tbody');tb.innerHTML='';
 for(const x of rows){
  const tr=document.createElement('tr');
  const date=new Date(x.createdAt).toLocaleString();
  tr.innerHTML='<td>'+date+'</td><td>'+x.levelName+'</td><td>'+x.paddlers.join(', ')+
   '</td><td>'+x.counts.rated+'/'+x.counts.core+'</td>'+
   '<td><a href="/api/sessions/'+x.id+'.csv">CSV</a> &middot; <a href="/api/sessions/'+x.id+'.json">JSON</a></td>'+
   '<td><button class="del">Delete</button></td>';
  tr.querySelector('.del').onclick=async()=>{
   if(!confirm('Delete this assessment ('+x.paddlers.join(', ')+')? This cannot be undone.'))return;
   const d=await fetch('/api/sessions/'+x.id,{method:'DELETE'});
   if(d.ok){tr.remove(); if(!tb.children.length){t.hidden=true;s.hidden=false;s.textContent='No saved assessments yet.';}}
   else alert('Delete failed.');
  };
  tb.appendChild(tr);
 }
}
load();
</script></body></html>`;
}

const server = createServer(async (req, res) => {
  const url = req.url.split('?')[0];

  if (req.method === 'POST' && url === '/sync') {
    try {
      const session = JSON.parse(await body(req));
      if (!session || typeof session.id !== 'string' || !Array.isArray(session.results)) throw new Error('bad payload');
      const p = safeSessionPath(SESSIONS, session.id);
      if (!p) throw new Error('bad id');
      await writeFile(p, JSON.stringify(session, null, 2));
      return sendJson(res, 200, { syncedAt: new Date().toISOString() });
    } catch (e) { return sendJson(res, 400, { error: String(e.message || e) }); }
  }

  if (req.method === 'GET' && url === '/api/sessions') {
    return sendJson(res, 200, await listSummaries());
  }

  const m = url.match(/^\/api\/sessions\/(.+?)(\.json|\.csv)?$/);
  if (m && (req.method === 'GET' || req.method === 'DELETE')) {
    const id = decodeURIComponent(m[1]);
    if (req.method === 'DELETE') {
      const p = safeSessionPath(SESSIONS, id);
      if (!p) return sendJson(res, 400, { error: 'bad id' });
      try { await unlink(p); return sendJson(res, 200, { deleted: true }); }
      catch { return sendJson(res, 404, { error: 'not found' }); }
    }
    const session = await readSession(id);
    if (!session) return sendJson(res, 404, { error: 'not found' });
    if (m[2] === '.csv') {
      res.writeHead(200, { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="${id}.csv"` });
      return res.end(sessionToCsv(session));
    }
    res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="${id}.json"` });
    return res.end(JSON.stringify(session, null, 2));
  }

  if (req.method === 'GET' && url === '/sessions') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(sessionsPage());
  }

  // static files from dist/ with SPA fallback
  const rel = normalize(decodeURIComponent(url)).replace(/^(\.\.[/\\])+/, '');
  let file = join(DIST, rel === '/' ? 'index.html' : rel);
  if (!file.startsWith(DIST)) { res.writeHead(404); res.end('Not found'); return; }
  try {
    let data;
    try { data = await readFile(file); }
    catch { data = await readFile(join(DIST, 'index.html')); file = 'index.html'; }
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end('Not found'); }
});

server.listen(PORT, () => console.log(`ACA assessment server on :${PORT}`));
```

- [ ] **Step 2: Build the app so `dist/` exists, then start the server**

Run:
```bash
npm run build
node pi/sync-server.mjs &
sleep 1
```

- [ ] **Step 3: Seed two sessions and exercise the API**

Run:
```bash
curl -s -X POST localhost:8787/sync -H 'Content-Type: application/json' -d '{"id":"sess-aaa","createdAt":"2026-07-09T10:00:00Z","levelId":"L2","levelName":"Level 2","paddlers":[{"id":"p1","name":"Alex"}],"skills":[{"id":"x","optional":false}],"results":[{"paddlerId":"p1","skillId":"x","rating":"meets","feedback":""}],"scale":[{"value":"meets","label":"Meets","requiresFeedback":false}]}' >/dev/null
curl -s -X POST localhost:8787/sync -H 'Content-Type: application/json' -d '{"id":"sess-bbb","createdAt":"2026-07-09T11:00:00Z","levelId":"L1","levelName":"Level 1","paddlers":[{"id":"p1","name":"Sam"},{"id":"p2","name":"Jo"}],"skills":[],"results":[],"scale":[]}' >/dev/null
echo "list:";   curl -s localhost:8787/api/sessions
echo "csv:";    curl -s -o /dev/null -w '%{http_code} %{content_type}\n' localhost:8787/api/sessions/sess-aaa.csv
echo "json:";   curl -s -o /dev/null -w '%{http_code}\n' localhost:8787/api/sessions/sess-aaa.json
echo "page:";   curl -s -o /dev/null -w '%{http_code}\n' localhost:8787/sessions
echo "delete:"; curl -s -X DELETE localhost:8787/api/sessions/sess-bbb; echo
echo "traversal delete (expect 400):"; curl -s -o /dev/null -w '%{http_code}\n' -X DELETE 'localhost:8787/api/sessions/..%2f..%2fpackage'
echo "unknown (expect 404):"; curl -s -o /dev/null -w '%{http_code}\n' localhost:8787/api/sessions/nope.json
echo "app still served:"; curl -s -o /dev/null -w '%{http_code}\n' localhost:8787/
```
Expected: list shows both sessions newest-first (sess-bbb then sess-aaa) with names/level; csv `200 text/csv`; json `200`; page `200`; delete `{"deleted":true}`; traversal `400`; unknown `404`; app `200`.

- [ ] **Step 4: Stop the server and clean the seed files**

Run:
```bash
pkill -f sync-server.mjs
rm -f pi/sessions/sess-aaa.json pi/sessions/sess-bbb.json
```

- [ ] **Step 5: Run unit tests (unchanged server has no vitest; confirm suite still green)**

Run: `npm test`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add pi/sync-server.mjs
git commit -m "feat: Pi session API (list/download/delete) and /sessions page"
```

---

### Task 6: Setup screen — gated "Past assessments" link

**Files:**
- Modify: `src/screens/Setup.jsx`

**Interfaces:**
- Consumes: `VITE_PRIVATE` flag (Task 1).

- [ ] **Step 1: Add the gated link to `src/screens/Setup.jsx`**

Below the imports (after line 8, `const PADDLER_COUNT = 5;`), add:
```js
const PRIVATE = import.meta.env.VITE_PRIVATE === 'true';
```
Then, inside the returned `<main>`, immediately after `<h1>New Assessment</h1>` (line 45), add:
```jsx
      {PRIVATE ? <p><a href="/sessions">Past assessments &rarr;</a></p> : null}
```

- [ ] **Step 2: Verify gating via build**

Run:
```bash
npm run build && grep -c "Past assessments" dist/assets/*.js | grep -v ':0' || echo "public: link absent (correct)"
VITE_PRIVATE=true npm run build && grep -rl "Past assessments" dist/assets/*.js >/dev/null && echo "private: link present (correct)"
```
Expected: "public: link absent (correct)" then "private: link present (correct)".

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/screens/Setup.jsx
git commit -m "feat: link to past-assessments page from Setup (private build only)"
```

---

### Task 7: Lesson pipeline — `build-lessons.mjs`, `lessons.json`, gitignore

> **REVISED at implementation:** lessons are emitted as HTML **fragments** into a
> git-ignored `lessons-content/` dir (with a committed `lessons-content/.gitkeep`),
> not standalone pages under `public/lessons/`. The fragments are bundled inline by
> Task 8; there is no separate served page and no `/lessons/` server route.

**Files:**
- Create: `tools/build-lessons.mjs`
- Create: `src/data/lessons.json` (generated, then committed)
- Modify: `.gitignore`
- Test: `tests/lessons.test.js`
- Modify: `pi/README.md` (deploy steps)

**Interfaces:**
- Produces: `src/data/lessons.json` — `{ [skillId: string]: slug: string }`. Consumed by Task 8.

- [ ] **Step 1: Add `public/lessons/` to `.gitignore`**

Append to `.gitignore`:
```
# private teaching content (generated; served only from the Pi build)
public/lessons/
```

- [ ] **Step 2: Create `tools/build-lessons.mjs`**

```js
// Converts instructor Org lessons to standalone HTML in public/lessons/ and
// refreshes src/data/lessons.json (skillId -> slug). Run on the Mac where the
// .org sources live. Requires pandoc. HTML output is git-ignored.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
const run = promisify(execFile);

const SRC = process.env.LESSONS_SRC ||
  join(process.env.HOME, 'Documents/ACA/2024/Lessons');
const OUT = new URL('../public/lessons/', import.meta.url).pathname;
const MAP = new URL('../src/data/lessons.json', import.meta.url).pathname;

// org filename (without .org) -> { skillId, slug, title }
const LESSONS = [
  { file: 'Forward Paddling', skillId: 'l2-forward', slug: 'forward-paddling', title: 'Forward Paddling' },
  { file: 'Reverse Paddling', skillId: 'l2-reverse', slug: 'reverse-paddling', title: 'Reverse Paddling' },
  { file: 'Stopping', skillId: 'l2-stopping', slug: 'stopping', title: 'Stopping' },
  { file: 'Forward and Reverse Sweep', skillId: 'l2-sweep', slug: 'forward-reverse-sweep', title: 'Forward & Reverse Sweep' },
  { file: 'Capsize and Wet Exit', skillId: 'l2-wet-exit', slug: 'capsize-wet-exit', title: 'Capsize & Wet Exit' },
  { file: 'Assisted Rescues and Deep-Water Re-Entry', skillId: 'l2-assisted-rescue', slug: 'assisted-rescues', title: 'Assisted Rescues & Deep-Water Re-Entry' },
];

const CSS = `body{font-family:system-ui,sans-serif;max-width:720px;margin:0 auto;padding:1rem;color:#14323a;line-height:1.5}
h1{color:#005f6b}h2{color:#00707e;border-bottom:2px solid #4fd1c5;padding-bottom:.2rem}
code{background:#eef5f6;padding:.1em .3em;border-radius:4px}a.back{color:#00707e}`;

const map = {};
await mkdir(OUT, { recursive: true });
for (const L of LESSONS) {
  const src = join(SRC, `${L.file}.org`);
  try { await access(src); } catch { console.warn('SKIP (missing):', src); continue; }
  const { stdout } = await run('pandoc', ['-f', 'org', '-t', 'html5', src]);
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>${L.title}</title>
<style>${CSS}</style></head><body><p><a class="back" href="javascript:history.back()">&larr; Back</a></p>
<h1>${L.title}</h1>${stdout}</body></html>`;
  await writeFile(join(OUT, `${L.slug}.html`), html);
  map[L.skillId] = L.slug;
  console.log('built', L.slug);
}
await writeFile(MAP, JSON.stringify(map, null, 2) + '\n');
console.log(`wrote ${Object.keys(map).length} lessons -> src/data/lessons.json`);
```

- [ ] **Step 3: Run the generator**

Run: `node tools/build-lessons.mjs`
Expected: prints `built forward-paddling` … and `wrote 6 lessons -> src/data/lessons.json`. Creates `public/lessons/*.html` (git-ignored) and `src/data/lessons.json`.

- [ ] **Step 4: Write the lessons.json validation test** — `tests/lessons.test.js`

```js
import { expect, test } from 'vitest';
import lessons from '../src/data/lessons.json';

test('lessons.json maps skill ids to non-empty slugs', () => {
  const entries = Object.entries(lessons);
  expect(entries.length).toBeGreaterThan(0);
  for (const [skillId, slug] of entries) {
    expect(skillId).toMatch(/^l[12]-/);
    expect(typeof slug).toBe('string');
    expect(slug).toMatch(/^[a-z0-9-]+$/);
  }
});
```

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: all pass, including the lessons test (6 mapped).

- [ ] **Step 6: Add the deploy steps to `pi/README.md`**

Add a "## Teaching lessons (private)" section documenting:
```bash
# On the Mac (where ~/Documents/ACA/2024/Lessons lives):
node tools/build-lessons.mjs                          # -> public/lessons/*.html + src/data/lessons.json
git add src/data/lessons.json && git commit -m "chore: refresh lessons map" && git push
rsync -a public/lessons/ ken@100.85.235.11:~/aca-skills-assessment/public/lessons/

# On the Pi:
cd ~/aca-skills-assessment && git pull
BASE_PATH=/ VITE_PRIVATE=true npm run build
sudo systemctl restart aca-assessment
```
Note that `public/lessons/` is git-ignored (private) and only reaches the Pi via rsync; the public GitHub Pages build never contains lessons.

- [ ] **Step 7: Commit (map + tool + docs; NOT the html)**

```bash
git add tools/build-lessons.mjs src/data/lessons.json tests/lessons.test.js .gitignore pi/README.md
git status --porcelain public/lessons/ | grep . && echo "ERROR: public/lessons tracked" || echo "ok: public/lessons ignored"
git commit -m "feat: Org->HTML lesson pipeline, lessons map, and deploy docs"
```
Expected: the `git status` check prints "ok: public/lessons ignored".

---

### Task 8: Rate screen — gated teaching link

> **REVISED at implementation:** the teaching lesson is shown **inline as a
> collapsible section** — the fragment is bundled at build time via
> `import.meta.glob('/lessons-content/*.html', {eager, query:'?raw'})` and rendered
> with `dangerouslySetInnerHTML` — NOT an iframe or an external link. The standard's
> Hide/Show toggle was also removed (the standard is always shown). The `/sessions`
> list renders rows via `textContent` (no innerHTML of user data).

**Files:**
- Modify: `src/screens/Rate.jsx`

**Interfaces:**
- Consumes: `src/data/lessons.json` (Task 7), `VITE_PRIVATE` flag (Task 1).

- [ ] **Step 1: Import lessons and add the gate in `src/screens/Rate.jsx`**

After the existing imports (top of file), add:
```js
import lessons from '../data/lessons.json';

const PRIVATE = import.meta.env.VITE_PRIVATE === 'true';
```

- [ ] **Step 1b: Always show the standard — remove the Hide/Show toggle**

In `src/screens/Rate.jsx`, remove the `showStandard` state and the toggle so the standard is always visible.
1. Delete the line `const [showStandard, setShowStandard] = useState(true);` from the component body. Keep the `useState` import (still used for `const [i, setI] = useState(0);`).
2. Replace the standard box block:
```jsx
        <div className="standard-box">
          <div className="standard-box-header">
            <span>{session.levelId} standard</span>
            <button
              type="button"
              className="link-button"
              onClick={() => setShowStandard(s => !s)}
            >
              {showStandard ? 'Hide' : 'Show'}
            </button>
          </div>
          {showStandard ? <p className="standard-box-text">{skill.standard}</p> : null}
        </div>
```
with:
```jsx
        <div className="standard-box">
          <div className="standard-box-header">
            <span>{session.levelId} standard</span>
          </div>
          <p className="standard-box-text">{skill.standard}</p>
        </div>
```

- [ ] **Step 2: Render the teaching link in the skill header**

Inside the `<div className="rate-header">`, immediately after the `</div>` that closes `standard-box` (and before the closing `</div>` of `rate-header`), add:
```jsx
        {PRIVATE && lessons[skill.id] ? (
          <p className="teaching-link">
            <a href={`${import.meta.env.BASE_URL}lessons/${lessons[skill.id]}.html`} target="_blank" rel="noopener">
              📖 Teaching notes &amp; drills
            </a>
          </p>
        ) : null}
```

- [ ] **Step 3: Verify gating + offline bundling via build**

Run:
```bash
# public build: no teaching link, no lessons in dist
npm run build
grep -c "Teaching notes" dist/assets/*.js | grep -v ':0' || echo "public: link absent (correct)"
ls dist/lessons 2>/dev/null && echo "UNEXPECTED lessons in public build" || echo "public: no dist/lessons (correct)"
# private build (lessons present in public/lessons from Task 7): link + precached lessons
VITE_PRIVATE=true npm run build
grep -rl "Teaching notes" dist/assets/*.js >/dev/null && echo "private: link present (correct)"
ls dist/lessons/*.html >/dev/null 2>&1 && echo "private: lessons bundled (correct)"
grep -c "lessons/forward-paddling.html" dist/sw.js && echo "private: lesson precached (correct)"
```
Expected: public → link absent, no dist/lessons; private → link present, lessons bundled, lesson listed in `dist/sw.js` precache.

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/screens/Rate.jsx
git commit -m "feat: per-skill teaching link on the Rate screen (private build only)"
```

---

## Self-Review

**Spec coverage:**
- Flag consolidation to `VITE_PRIVATE` (renames `VITE_ENABLE_SYNC`) → Task 1.
- Part C L2 reorder (Rescues after dry skills) + order test → Task 2.
- Part A: `sessionSummary` → Task 3; `safeSessionPath` → Task 4; server API (`/api/sessions`, `:id.json`, `:id.csv`, DELETE) + `/sessions` page + CSV reuse → Task 5; gated Setup link → Task 6.
- Part B: pipeline + `lessons.json` + gitignore → Task 7; gated Rate link + offline precache + public-build exclusion → Task 8; deploy docs → Task 7 Step 6.
- Global constraints (no new deps, `VITE_PRIVATE` gating, private lessons never committed, path-safety, public build gets only Part C) → enforced across Tasks 1/4/5/7/8 with explicit build/curl checks.

**Placeholder scan:** No TBD/TODO. Every code and command step is concrete.

**Type consistency:** `sessionSummary(session)` shape (Task 3) matches what the server list/page consume (Task 5). `safeSessionPath(sessionsDir, id)` signature (Task 4) matches its call sites (Task 5). `sessionToCsv(session)` is imported from the existing pure `src/lib/csv.js`. `lessons.json` is `{skillId: slug}` in Task 7 and read as `lessons[skill.id]` in Task 8. `VITE_PRIVATE` is defined/used identically in Tasks 1/6/8 and Review.jsx.
