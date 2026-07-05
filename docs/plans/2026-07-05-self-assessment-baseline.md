# Self-Assessment Mode + Baseline Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a single paddler self-assess (notes never required) and let the instructor import those self-assessments onto the Pi as read-only baselines.

**Architecture:** Add a `selfAssessment` boolean to the session. One validation seam (`resultNeedsFeedback`) waives required notes when set. Setup grows a checkbox that collapses to a single paddler. Review gains a JSON export (the portable session). The Pi `/sessions` page gains a file-import control that reuses the existing `/sync` endpoint, plus a "self" tag driven by the session summary.

**Tech Stack:** Vite 6 + Preact + Vitest; Node `http` sync-server on the Pi; ES modules.

## Global Constraints

- The flag is named exactly `selfAssessment` (boolean) on the session object; absent/falsy = instructor multi-paddler mode. No migration of existing sessions.
- `resultNeedsFeedback` is the ONLY behavioral seam for self-assessment; do not add `selfAssessment` checks anywhere else in the rating/validation path.
- Baseline import reuses the existing `POST /sync` endpoint — do NOT add a new server route.
- Self-assessment default name is `"Me"` when the single name field is left blank.
- JSON export filename: `aca-assessment-${session.id}.json`.
- Private-only UI (Import control, "self" tag, the `/sessions` link) stays gated behind `VITE_PRIVATE`/the Pi server, matching existing patterns.
- Node 22. `npm test` must stay green after every task.

---

### Task 1: `selfAssessment` flag through `createSession` + `resultNeedsFeedback`

**Files:**
- Modify: `src/lib/session.js` (`createSession`)
- Modify: `src/lib/validation.js` (`resultNeedsFeedback`)
- Test: `tests/session.test.js`, `tests/validation.test.js`

**Interfaces:**
- Produces: `createSession({..., selfAssessment?})` returns a session that includes `selfAssessment` (boolean, default `false`). `resultNeedsFeedback(session, result)` returns `false` whenever `session.selfAssessment` is truthy.

- [ ] **Step 1: Write the failing tests**

Append to `tests/session.test.js`:

```js
test('createSession stores selfAssessment, defaulting to false', () => {
  expect(base().selfAssessment).toBe(false);
  const solo = createSession({ id: 's2', createdAt: 't', config: cfg, selfAssessment: true, paddlers: [{ name: 'Me', target: 'L2' }] });
  expect(solo.selfAssessment).toBe(true);
});
```

Append to `tests/validation.test.js`:

```js
test('self-assessment waives all required feedback', () => {
  const s = withResults([]);
  expect(resultNeedsFeedback({ ...s, selfAssessment: true }, { skillId: 'd', rating: 'l1', feedback: ' ' })).toBe(false);
  expect(resultNeedsFeedback({ ...s, selfAssessment: true }, { skillId: 'd', rating: 'below', feedback: '' })).toBe(false);
  // control: without the flag the same below rating still needs feedback
  expect(resultNeedsFeedback(s, { skillId: 'd', rating: 'below', feedback: '' })).toBe(true);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/session.test.js tests/validation.test.js`
Expected: FAIL (`selfAssessment` is `undefined`; the waive assertions fail).

- [ ] **Step 3: Implement**

In `src/lib/session.js`, change `createSession` to accept and store the flag:

```js
export function createSession({ id, createdAt, config, location = '', paddlers, selfAssessment = false }) {
  const people = paddlers.map(p => ({ name: (p.name || '').trim(), target: p.target })).filter(p => p.name);
  const withIds = people.map(p => ({ id: pid(), name: p.name, target: p.target }));
  const results = [];
  for (const p of withIds) {
    for (const sk of config.skills) {
      if (sk.level === p.target) results.push({ paddlerId: p.id, skillId: sk.id, rating: null, feedback: '' });
    }
  }
  return { id, createdAt, location, selfAssessment: !!selfAssessment, scales: config.scales, paddlers: withIds, skills: config.skills, results };
}
```

In `src/lib/validation.js`, add the seam as the first line of `resultNeedsFeedback`:

```js
export function resultNeedsFeedback(session, result) {
  if (session.selfAssessment) return false;
  const skill = skillById(session, result.skillId);
  if (!skill || skill.optional) return false;
  const opt = optionFor(session, skill, result.rating);
  return !!(opt && opt.requiresFeedback) && result.feedback.trim() === '';
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run tests/session.test.js tests/validation.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/session.js src/lib/validation.js tests/session.test.js tests/validation.test.js
git commit -m "feat: selfAssessment flag waives required notes"
```

---

### Task 2: Setup — Self-assessment checkbox → single paddler

**Files:**
- Modify: `src/screens/Setup.jsx`

**Interfaces:**
- Consumes: `createSession` from Task 1 (accepts `selfAssessment`).
- Produces: Setup passes `selfAssessment` to `createSession`; in self-assessment mode it submits exactly one paddler, defaulting the name to `"Me"` when blank.

- [ ] **Step 1: Add state + a checkbox, and branch the paddler UI**

Edit `src/screens/Setup.jsx`. Add a `selfAssessment` state and, when true, render a single name row instead of the 5-paddler fieldset. Full new component body:

```jsx
export function Setup({ onStart }) {
  const [location, setLocation] = useState('');
  const [selfAssessment, setSelfAssessment] = useState(false);
  const [paddlers, setPaddlers] = useState(
    Array.from({ length: PADDLER_COUNT }, () => ({ name: '', target: 'L2' })),
  );
  const [solo, setSolo] = useState({ name: '', target: 'L2' });
  const [error, setError] = useState('');

  function updatePaddlerName(index, value) {
    setPaddlers(rows => rows.map((p, i) => (i === index ? { ...p, name: value } : p)));
  }
  function updatePaddlerTarget(index, value) {
    setPaddlers(rows => rows.map((p, i) => (i === index ? { ...p, target: value } : p)));
  }

  function handleStart() {
    const chosen = selfAssessment
      ? [{ name: solo.name.trim() || 'Me', target: solo.target }]
      : paddlers;
    const session = createSession({
      id: `sess-${Date.now()}`,
      createdAt: new Date().toISOString(),
      config: CONFIG,
      location,
      paddlers: chosen,
      selfAssessment,
    });
    if (session.paddlers.length === 0) {
      setError('Add at least one paddler name.');
      return;
    }
    setError('');
    onStart(session);
  }

  return (
    <main className="screen setup-screen">
      <h1>New Assessment</h1>
      {PRIVATE ? <p><a href="/sessions">Past assessments &rarr;</a></p> : null}

      <label className="field checkbox-field">
        <input type="checkbox" checked={selfAssessment} onChange={e => setSelfAssessment(e.currentTarget.checked)} />
        <span>Self-assessment (just me — notes optional)</span>
      </label>

      <label className="field">
        <span>Location (optional)</span>
        <input type="text" value={location} onChange={e => setLocation(e.currentTarget.value)} />
      </label>

      {selfAssessment ? (
        <fieldset className="field paddler-fieldset">
          <legend>You</legend>
          <div className="field paddler-row">
            <label className="field">
              <span>Your name</span>
              <input type="text" placeholder="Me" value={solo.name} onChange={e => setSolo(s => ({ ...s, name: e.currentTarget.value }))} />
            </label>
            <label className="field">
              <span>Target</span>
              <select value={solo.target} onChange={e => setSolo(s => ({ ...s, target: e.currentTarget.value }))}>
                {TARGETS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
          </div>
        </fieldset>
      ) : (
        <fieldset className="field paddler-fieldset">
          <legend>Paddlers</legend>
          {paddlers.map((p, i) => (
            <div className="field paddler-row" key={i}>
              <label className="field">
                <span>{`Paddler ${i + 1}`}</span>
                <input type="text" value={p.name} onChange={e => updatePaddlerName(i, e.currentTarget.value)} />
              </label>
              <label className="field">
                <span>Target</span>
                <select value={p.target} onChange={e => updatePaddlerTarget(i, e.currentTarget.value)}>
                  {TARGETS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
            </div>
          ))}
        </fieldset>
      )}

      {error ? <p className="error">{error}</p> : null}

      <button type="button" onClick={handleStart}>Start Assessment</button>
    </main>
  );
}
```

- [ ] **Step 2: Add a minimal checkbox style**

Append to `src/styles.css`:

```css
.checkbox-field { flex-direction: row; align-items: center; gap: 0.5rem; }
.checkbox-field input { width: auto; min-height: auto; }
```

- [ ] **Step 3: Verify build**

Run: `BASE_PATH=/ VITE_PRIVATE=true npm run build`
Expected: build succeeds.

- [ ] **Step 4: Run tests + commit**

Run: `npm test` (stays green — no logic tests for the UI here; behavior is covered by Task 1).

```bash
git add src/screens/Setup.jsx src/styles.css
git commit -m "feat: self-assessment checkbox collapses Setup to one paddler"
```

---

### Task 3: Review — "Download JSON" export

**Files:**
- Modify: `src/screens/Review.jsx`

**Interfaces:**
- Consumes: the existing `download(name, text, type)` helper already defined in `Review.jsx`.
- Produces: a "Download JSON" button that exports `JSON.stringify(session)` as `aca-assessment-${session.id}.json`.

- [ ] **Step 1: Add the handler and button**

In `src/screens/Review.jsx`, add a handler next to `handleDownloadCsv`:

```jsx
  function handleDownloadJson() {
    download(`aca-assessment-${session.id}.json`, JSON.stringify(session, null, 2), 'application/json');
  }
```

Add the button in the `.review-actions` row, immediately after the CSV button:

```jsx
        <button type="button" onClick={handleDownloadJson}>Download JSON</button>
```

(Leave it ungated — the JSON is the portable session file and is valid at any point; this is what a self-assessor emails to the instructor.)

- [ ] **Step 2: Verify build**

Run: `BASE_PATH=/ VITE_PRIVATE=true npm run build`
Expected: build succeeds.

- [ ] **Step 3: Run tests + commit**

Run: `npm test` (stays green).

```bash
git add src/screens/Review.jsx
git commit -m "feat: Download JSON export on Review (portable session)"
```

---

### Task 4: Expose `selfAssessment` in the session summary

**Files:**
- Modify: `src/lib/session-summary.js`
- Test: `tests/session-summary.test.js`

**Interfaces:**
- Produces: `sessionSummary(session)` includes `selfAssessment: boolean` (from `!!session.selfAssessment`), consumed by the `/sessions` page (Task 5) to render the "self" tag.

- [ ] **Step 1: Write the failing test**

Append to `tests/session-summary.test.js`:

```js
test('sessionSummary reports selfAssessment', () => {
  const base = { id: 'x', createdAt: 't', skills: [], results: [], paddlers: [{ name: 'Me', target: 'L2' }] };
  expect(sessionSummary({ ...base, selfAssessment: true }).selfAssessment).toBe(true);
  expect(sessionSummary(base).selfAssessment).toBe(false);
});
```

(The file already imports `sessionSummary`; if not, add `import { sessionSummary } from '../src/lib/session-summary.js';` at the top.)

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/session-summary.test.js`
Expected: FAIL (`selfAssessment` is `undefined`).

- [ ] **Step 3: Implement**

In `src/lib/session-summary.js`, add `selfAssessment` to the `base` object in `sessionSummary`:

```js
  const base = {
    id: session.id, createdAt: session.createdAt,
    participants: paddlers.map(p => p.name),
    selfAssessment: !!session.selfAssessment,
    counts: coreCounts(session),
  };
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run tests/session-summary.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/session-summary.js tests/session-summary.test.js
git commit -m "feat: expose selfAssessment in session summary"
```

---

### Task 5: Pi `/sessions` — Import JSON control + "self" tag

**Files:**
- Modify: `pi/sync-server.mjs`

**Interfaces:**
- Consumes: `sessionSummary().selfAssessment` (Task 4); the existing `POST /sync` endpoint (validates `id`/`results`, writes via `safeSessionPath`, returns `{ syncedAt }`).
- Produces: an "Import JSON" file picker on the `/sessions` page that reads a file and `POST`s its text to `/sync`, then reloads; a "self" marker in rows where `x.selfAssessment` is true.

- [ ] **Step 1: Add the Import control to the page markup**

In `pi/sync-server.mjs`, in the `/sessions` HTML, add an import input inside `<header>` (after the "Back to app" link). Change the header line to:

```js
`<header><strong>Past Assessments</strong> &nbsp; <a href="/">&larr; Back to app</a>
 &nbsp; <label class="imp">Import JSON <input type="file" id="imp" accept="application/json,.json"></label></header>`
```

- [ ] **Step 2: Add the "self" tag in the participants cell**

In the row-building loop, replace the participants cell line:

```js
  const participantsText=x.participants.map((n,i)=>x.landings[i]?n+' ('+x.landings[i]+')':n).join(', ');
  tr.appendChild(cell(participantsText));
```

with a version that appends a "self" marker:

```js
  const participantsText=x.participants.map((n,i)=>x.landings[i]?n+' ('+x.landings[i]+')':n).join(', ');
  const pcell=cell(participantsText);
  if(x.selfAssessment){const b=document.createElement('span');b.className='selftag';b.textContent='self';pcell.append(' ');pcell.appendChild(b);}
  tr.appendChild(pcell);
```

- [ ] **Step 3: Wire the import handler**

At the end of the inline `<script>`, after the `load();` call, add:

```js
document.getElementById('imp').addEventListener('change',async e=>{
 const f=e.target.files[0]; if(!f) return;
 let text; try{ text=await f.text(); JSON.parse(text); }catch{ alert('Not a valid JSON file.'); e.target.value=''; return; }
 const r=await fetch('/sync',{method:'POST',headers:{'Content-Type':'application/json'},body:text});
 if(r.ok){ e.target.value=''; load(); } else { const j=await r.json().catch(()=>({})); alert('Import failed: '+(j.error||r.status)); }
});
```

- [ ] **Step 4: Add styles for the tag and control**

In the `/sessions` `<style>` block, add:

```css
 .selftag{background:#eef7f8;color:#00707e;border:1px solid #bcdfe3;border-radius:4px;padding:0 .35rem;font-size:.75rem}
 .imp{font-size:.9rem;color:#bdeae2}
 .imp input{color:#fff}
```

- [ ] **Step 5: Verify syntax and a live round-trip**

Run: `node --check pi/sync-server.mjs`
Expected: no output (valid).

Manual smoke (from the repo root):
```bash
PORT=4199 node pi/sync-server.mjs &
SRV=$!
# craft a minimal self-assessment session and import it via /sync (what the file picker does)
curl -s -X POST localhost:4199/sync -H 'Content-Type: application/json' \
  -d '{"id":"imp-test","createdAt":"t","selfAssessment":true,"paddlers":[{"id":"p1","name":"Me","target":"L2"}],"skills":[],"results":[]}'
curl -s localhost:4199/api/sessions   # expect one row with "selfAssessment":true
kill $SRV
```
Expected: the POST returns `{"syncedAt":...}`; `/api/sessions` shows the imported session with `selfAssessment: true`. Delete the scratch file afterward: `rm -f pi/sessions/imp-test.json`.

- [ ] **Step 6: Commit**

```bash
git add pi/sync-server.mjs
git commit -m "feat: import JSON baselines on /sessions + self tag"
```

---

## Notes for the executor

- Repo root: `~/Develop/aca-skills-assessment`. Work on branch `feat/self-assessment` (already created).
- The local preview server (`PORT=4173 node pi/sync-server.mjs`) serves `dist/`; rebuild with `BASE_PATH=/ VITE_PRIVATE=true npm run build` to refresh it for phone testing.
- Do not merge/deploy — the controller handles the finish/deploy flow after the whole-branch review.
