# Skill-Set Dedup (Increment 3: Pi Sync + Hydration) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The app syncs a one-session `aca-archive-v2` bundle; the Pi stores slim sessions + a shared `skillSets` store and hydrates on every read path (list, CSV, Resume). Existing fat Pi files keep working; the `/sessions` Import now accepts bundles.

**Architecture:** A pure `bundleOf()` in `skillset.js` (reused by sync); `sync.js` sends the bundle; `pi/sync-server.mjs` gains a `skillsets` store, a bundle-or-fat `/sync`, and `hydrate` on its read paths.

**Tech Stack:** Vite + Preact (app), plain Node ESM (Pi), Vitest (`environment: node`) + `fake-indexeddb`.

## Global Constraints

- **Node 22+**; test env **`node`**; no new dependencies.
- **Bundle format:** `{ format: 'aca-archive-v2', sessions: [slim…], skillSets: { ref: blob } }` (same as increments 2). `skillset.js` is pure JS so the Pi (Node) can import it.
- **Backward compatible both ways:** `/sync` still accepts a legacy fat single session; existing fat `pi/sessions/*.json` pass through `hydrate` untouched. No bulk migration.
- **Path safety on the Pi:** a skillSet `ref` is only used as a filename when it matches `^sk-[0-9a-f]{8}$`.
- **Scope:** `src/lib/skillset.js`, `src/lib/store.js` (one-line constant import), `src/lib/sync.js`, `pi/sync-server.mjs` (+ tests for the pure parts). Do NOT change the `/sessions` page HTML, the `SyncButton`, PDF/CSV logic, or the app's own store boundary.
- The Pi server has no unit-test harness; Task 3 is verified by `node --check` + a **local `curl` smoke test** and a **deploy-time `curl`** against the real Pi.
- Test style: `import { expect, test } from 'vitest'`.

---

### Task 1: `skillset.js` — `bundleOf` + shared `BUNDLE_FORMAT`

**Files:**
- Modify: `src/lib/skillset.js`
- Modify: `src/lib/store.js` (import the constant)
- Test: `tests/skillset.test.js` (extend)

**Interfaces:**
- Produces: `BUNDLE_FORMAT` (`'aca-archive-v2'`) and `bundleOf(sessions): { format, sessions, skillSets }` (slims each fat session in-memory; already-slim passes through; blobs deduped by ref).

- [ ] **Step 1: Write the failing tests (append to `tests/skillset.test.js`)**

```js
import { bundleOf, BUNDLE_FORMAT } from '../src/lib/skillset.js'; // add to existing import

test('bundleOf slims fat sessions and dedups shared blobs', () => {
  const s1 = { id: 'a', results: [], ...blob };   // `blob` fixture already defined at top of file
  const s2 = { id: 'b', results: [], ...blob };    // same config -> same ref
  const b = bundleOf([s1, s2]);
  expect(b.format).toBe(BUNDLE_FORMAT);
  expect(b.sessions.every(s => !s.skills && typeof s.skillSetRef === 'string')).toBe(true);
  expect(Object.keys(b.skillSets)).toHaveLength(1);            // dedup
  expect(b.skillSets[b.sessions[0].skillSetRef]).toEqual(blob);
});

test('bundleOf passes an already-slim session through unchanged', () => {
  const slim = { id: 'a', results: [], skillSetRef: 'sk-12345678' };
  const b = bundleOf([slim]);
  expect(b.sessions[0]).toBe(slim);
  expect(Object.keys(b.skillSets)).toHaveLength(0);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/skillset.test.js`
Expected: FAIL — `bundleOf`/`BUNDLE_FORMAT` not exported.

- [ ] **Step 3: Add `BUNDLE_FORMAT` + `bundleOf` to `src/lib/skillset.js`**

Append:

```js
export const BUNDLE_FORMAT = 'aca-archive-v2';

// Build a bundle from in-memory (fat) sessions: slim each and collect its blob,
// deduped by content ref. An already-slim session passes through as-is.
export function bundleOf(sessions) {
  const skillSets = {};
  const slim = sessions.map(s => {
    if (!s.skills) return s;
    const blob = blobOf(s);
    const ref = skillSetRef(blob);
    skillSets[ref] = blob;
    return slimSession(s, ref);
  });
  return { format: BUNDLE_FORMAT, sessions: slim, skillSets };
}
```

- [ ] **Step 4: Point `store.js` at the shared constant**

In `src/lib/store.js`, add `BUNDLE_FORMAT` to the existing skillset import and remove the local declaration. Change:

```js
import { skillSetRef, blobOf, isSlim, slimSession, fattenSession } from './skillset.js';
```
to:
```js
import { skillSetRef, blobOf, isSlim, slimSession, fattenSession, BUNDLE_FORMAT } from './skillset.js';
```
and delete the line `const BUNDLE_FORMAT = 'aca-archive-v2';`.

- [ ] **Step 5: Run to verify pass + full suite + commit**

Run: `npx vitest run tests/skillset.test.js` → PASS.
Run: `npx vitest run` → all green (store's `exportBundle` still emits `format: 'aca-archive-v2'` via the imported constant).

```bash
git add src/lib/skillset.js src/lib/store.js tests/skillset.test.js
git commit -m "feat(skillset): shared bundleOf + BUNDLE_FORMAT for in-memory bundling"
```

---

### Task 2: `sync.js` — sync a bundle

**Files:**
- Modify: `src/lib/sync.js`
- Test: `tests/sync.test.js` (create)

**Interfaces:**
- Consumes: `bundleOf` (Task 1).
- Produces: `syncSession(session, baseUrl?)` unchanged signature/return shape, but POSTs a one-session bundle body.

- [ ] **Step 1: Write the failing test**

```js
// tests/sync.test.js
import { afterEach, expect, test, vi } from 'vitest';
import { syncSession } from '../src/lib/sync.js';

const fat = {
  id: 'a', createdAt: 't', results: [{ skillId: 's1', rating: 'meets', feedback: '' }],
  skills: [{ id: 's1', level: 'L3', standard: 'x' }], scales: { L3: [{ value: 'meets' }] }, intro: null,
};

afterEach(() => { vi.unstubAllGlobals(); });

test('syncSession POSTs a one-session bundle and returns ok', async () => {
  let sent;
  vi.stubGlobal('fetch', async (url, opts) => {
    sent = { url, body: JSON.parse(opts.body) };
    return { ok: true, json: async () => ({ syncedAt: 'T' }) };
  });
  const r = await syncSession(fat, '');
  expect(r).toEqual({ ok: true, syncedAt: 'T' });
  expect(sent.url).toBe('/sync');
  expect(sent.body.format).toBe('aca-archive-v2');
  expect(sent.body.sessions[0].id).toBe('a');
  expect(sent.body.sessions[0].skills).toBeUndefined();       // slim on the wire
  const ref = sent.body.sessions[0].skillSetRef;
  expect(sent.body.skillSets[ref]).toEqual({ skills: fat.skills, scales: fat.scales, intro: null });
});

test('syncSession reports an error when the server rejects', async () => {
  vi.stubGlobal('fetch', async () => ({ ok: false, status: 400 }));
  expect((await syncSession(fat, '')).ok).toBe(false);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/sync.test.js`
Expected: FAIL — the POST body is the fat session, so `sent.body.format` is undefined.

- [ ] **Step 3: Send the bundle in `src/lib/sync.js`**

Add the import at the top:

```js
import { bundleOf } from './skillset.js';
```

Change the `body` of the fetch from `JSON.stringify(session)` to the bundle:

```js
      body: JSON.stringify(bundleOf([session])),
```

(Everything else in `syncSession` — URL, headers, error handling, return shape — is unchanged.)

- [ ] **Step 4: Run to verify pass + full suite + commit**

Run: `npx vitest run tests/sync.test.js` → PASS (2 tests).
Run: `npx vitest run` → all green.

```bash
git add src/lib/sync.js tests/sync.test.js
git commit -m "feat(sync): send a slim one-session bundle to the Pi"
```

---

### Task 3: `pi/sync-server.mjs` — skillSets store, bundle `/sync`, hydrate on read

No unit harness. Verified by `node --check`, a local `curl` smoke test, and (at deploy) `curl` against the real Pi.

**Files:**
- Modify: `pi/sync-server.mjs`

**Interfaces:**
- Consumes: `fattenSession` from `../src/lib/skillset.js`.
- Produces: `/sync` accepts a bundle or a fat session; a `pi/skillsets/` store; hydrated list/CSV/Resume.

- [ ] **Step 1: Import the helpers and add the skillSets store**

Add to the imports at the top of `pi/sync-server.mjs`:

```js
import { fattenSession } from '../src/lib/skillset.js';
```

After `const SESSIONS = …; await mkdir(SESSIONS, { recursive: true });`, add:

```js
const SKILLSETS = decodeURI(new URL('./skillsets/', import.meta.url).pathname);
await mkdir(SKILLSETS, { recursive: true });

function safeSkillSetPath(ref) {
  return /^sk-[0-9a-f]{8}$/.test(ref) ? join(SKILLSETS, ref + '.json') : null;
}
async function readSkillSet(ref) {
  const p = safeSkillSetPath(ref);
  if (!p) return null;
  try { return JSON.parse(await readFile(p, 'utf8')); } catch { return null; }
}
async function writeSkillSet(ref, blob) {
  const p = safeSkillSetPath(ref);
  if (p) await writeFile(p, JSON.stringify(blob, null, 2));
}

// Re-attach a slim session's shared blob; fat/legacy sessions pass through.
async function hydrate(session) {
  if (!session || session.skills || typeof session.skillSetRef !== 'string') return session;
  const blob = await readSkillSet(session.skillSetRef);
  return blob ? fattenSession(session, blob) : session;
}
```

- [ ] **Step 2: Hydrate `listSummaries`**

In `listSummaries`, change the push line from:

```js
    try { out.push(sessionSummary(JSON.parse(await readFile(join(SESSIONS, f), 'utf8')))); }
```
to:
```js
    try { out.push(sessionSummary(await hydrate(JSON.parse(await readFile(join(SESSIONS, f), 'utf8'))))); }
```

- [ ] **Step 3: Accept a bundle (or a fat session) at `POST /sync`**

Replace the `/sync` handler body:

```js
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
```

with:

```js
  if (req.method === 'POST' && url === '/sync') {
    try {
      const data = JSON.parse(await body(req));
      // A slim bundle: store each blob, then each slim session.
      if (data && Array.isArray(data.sessions) && data.skillSets && typeof data.skillSets === 'object') {
        for (const [ref, blob] of Object.entries(data.skillSets)) await writeSkillSet(ref, blob);
        let imported = 0;
        for (const s of data.sessions) {
          if (!s || typeof s.id !== 'string' || !Array.isArray(s.results)) continue;
          const p = safeSessionPath(SESSIONS, s.id);
          if (p) { await writeFile(p, JSON.stringify(s, null, 2)); imported++; }
        }
        return sendJson(res, 200, { syncedAt: new Date().toISOString(), imported });
      }
      // A legacy fat single session.
      if (!data || typeof data.id !== 'string' || !Array.isArray(data.results)) throw new Error('bad payload');
      const p = safeSessionPath(SESSIONS, data.id);
      if (!p) throw new Error('bad id');
      await writeFile(p, JSON.stringify(data, null, 2));
      return sendJson(res, 200, { syncedAt: new Date().toISOString() });
    } catch (e) { return sendJson(res, 400, { error: String(e.message || e) }); }
  }
```

- [ ] **Step 4: Hydrate the CSV and JSON (Resume) read paths**

In the `/api/sessions/<id>` GET handler, after `const session = await readSession(id);` and its not-found check, hydrate before use. Change the CSV branch:

```js
      return res.end(sessionToCsv(session));
```
to:
```js
      return res.end(sessionToCsv(await hydrate(session)));
```

and the JSON branch:

```js
    res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="${safeName}.json"` });
    return res.end(JSON.stringify(session, null, 2));
```
to:
```js
    res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="${safeName}.json"` });
    return res.end(JSON.stringify(await hydrate(session), null, 2));
```

(The Resume path serves the **fat** hydrated session so the app's resume→localStorage→migrate flow is unchanged.)

- [ ] **Step 5: Syntax check + local curl smoke test**

Run: `node --check pi/sync-server.mjs` → no errors (imports resolve, syntax valid).

Then a local end-to-end smoke test against a throwaway server instance:

```bash
# start on a temp port; the /sync + /api paths don't need dist/
PORT=8799 node pi/sync-server.mjs &
SRV=$!; sleep 1
# a one-session bundle (matches the app's sync payload shape)
BUNDLE='{"format":"aca-archive-v2","sessions":[{"id":"smoke-1","createdAt":"2026-01-01","paddlers":[{"id":"p","name":"A","target":"L3"}],"results":[{"paddlerId":"p","skillId":"s1","rating":"meets","feedback":""}],"selfAssessment":false,"actionPlans":{},"skillSetRef":"sk-abcdef12"}],"skillSets":{"sk-abcdef12":{"skills":[{"id":"s1","level":"L3","category":"C","standard":"x","optional":false}],"scales":{"L3":[{"value":"meets","label":"Meets","requiresFeedback":false}]},"intro":null}}}'
curl -s -XPOST localhost:8799/sync -H 'Content-Type: application/json' -d "$BUNDLE"; echo
echo "--- list (hydrated summary) ---"; curl -s localhost:8799/api/sessions
echo "--- json (should be FAT: has skills, no skillSetRef) ---"; curl -s localhost:8799/api/sessions/smoke-1.json
echo "--- csv ---"; curl -s localhost:8799/api/sessions/smoke-1.csv | head -3
echo "--- skillset file exists ---"; ls pi/skillsets/sk-abcdef12.json
kill $SRV 2>/dev/null
# cleanup the smoke artifacts
rm -f pi/sessions/smoke-1.json pi/skillsets/sk-abcdef12.json
```

Expected: `/sync` returns `{syncedAt, imported:1}`; the list shows one summary (hydrated — a valid `level`/counts, not a crash); the JSON is **fat** (`"skills":[…]`, no `skillSetRef`); the CSV has real rows; the skillset file exists. Confirm, then the cleanup removes the smoke files.

- [ ] **Step 6: Full app suite (Pi change must not break app tests) + commit**

Run: `npx vitest run` → all green (the Pi file isn't imported by the app tests, but `skillset.js` is and its new exports must resolve).

```bash
git add pi/sync-server.mjs
git commit -m "feat(pi): accept slim bundles on /sync; hydrate list, CSV, and resume"
```

---

## Self-Review (completed by plan author)

- **Spec coverage:** `bundleOf` + shared constant (Task 1); sync sends the bundle (Task 2); Pi skillSets store + bundle-or-fat `/sync` + hydrate on list/CSV/Resume, with ref path-safety and legacy passthrough (Task 3). Backward compat (fat `/sync` + fat stored files) covered. Results-compaction/GC excluded.
- **Placeholder scan:** every step has complete code; the local curl smoke test is a concrete, runnable script.
- **Type consistency:** `bundleOf(sessions)` returns `{format, sessions, skillSets}` — the same shape `sync.js` POSTs and the Pi `/sync` parses; the Pi's `hydrate` reuses `skillset.js`'s `fattenSession(session, blob)` with the blob shape `{skills, scales, intro}` that `writeSkillSet` stores; `BUNDLE_FORMAT` is one shared constant used by `bundleOf`, `store.js`'s `exportBundle`, and the test assertions.
