# Review Below-Standard Detail + Jump-to-Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the Review screen, show each below-standard rating in full (name, category, complete official ACA standard, rating, note) with a "Go to skill →" link that reopens the Rate screen positioned on that skill.

**Architecture:** Add the skill's `standard` text to the summary's flagged items; extract Rate's page-list into a pure `ratePages()`/`indexOfSkill()` module; render the detail in a new thin `BelowStandardDetail` component; wire a `focusSkillId` through `app.jsx` so Rate opens on the chosen skill.

**Tech Stack:** Vite + Preact, plain CSS, Vitest (`environment: node`).

## Global Constraints

- **Node 22+**; test env is **`node`** (no DOM). Tests cover pure `src/lib/` logic only.
- **No new dependencies.** Screens/components are thin views over unit-tested libs and are NOT unit-tested by rendering (no `preact-render-to-string`).
- **Preact** — import from `preact`/`preact/hooks`; no React.
- **Scope:** Review page only. Do NOT change PDF/CSV export, and surface only the existing below-standard (`flagged`) set — not DNO/unrated/optional.
- Existing test-authoring style in `tests/summary.test.js` is `import { expect, test } from 'vitest'` with an inline session fixture — match it.

---

### Task 1: Add `standard` to the summary's flagged items

**Files:**
- Modify: `src/lib/summary.js` (the `item()` builder)
- Test: `tests/summary.test.js` (extend)

**Interfaces:**
- Consumes: skill objects already carry `standard` (from `skills.js` `loadConfig`).
- Produces: `paddlerSummary().flagged[i]` and `.optionalItems[i]` each gain a `standard` string field; all existing fields unchanged.

- [ ] **Step 1: Write the failing test (append to `tests/summary.test.js`)**

```js
test('flagged items carry the skill standard text', () => {
  const s = paddlerSummary(session, 'p');
  expect(s.flagged[0].standard).toBe('s');
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/summary.test.js`
Expected: FAIL — `s.flagged[0].standard` is `undefined` (field not yet added).

- [ ] **Step 3: Add `standard` to the `item()` builder**

In `src/lib/summary.js`, change the `item` arrow to include `standard: s.standard`:

```js
  const item = (r, s) => ({ skillId: r.skillId, name: skillLabel(s), category: s.category, standard: s.standard, rating: r.rating, ratingLabel: (scale.find(o => o.value === r.rating) || {}).label || '', feedback: r.feedback });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/summary.test.js`
Expected: PASS (existing summary tests + the new one).

- [ ] **Step 5: Commit**

```bash
git add src/lib/summary.js tests/summary.test.js
git commit -m "feat(summary): include full skill standard text in flagged items"
```

---

### Task 2: Extract `ratePages()` + `indexOfSkill()` pure module

**Files:**
- Create: `src/lib/rate-pages.js`
- Test: `tests/rate-pages.test.js`

**Interfaces:**
- Consumes: a `session` with `skills` (each `{id, level, ...}`), `paddlers` (each `{target}`), and optional `intro` (`{sections: [...]}`).
- Produces:
  - `ratePages(session): Array<{intro:true} | Skill>` — an optional intro page at index 0 (only when `session.intro.sections` is a non-empty array), followed by the skills whose `level` matches at least one paddler's `target`, in `session.skills` order.
  - `indexOfSkill(session, skillId): number` — the index of that skill in `ratePages(session)`, or `0` if absent/null.

- [ ] **Step 1: Write the failing tests**

```js
// tests/rate-pages.test.js
import { expect, test } from 'vitest';
import { ratePages, indexOfSkill } from '../src/lib/rate-pages.js';

const base = {
  paddlers: [{ target: 'L2' }],
  skills: [
    { id: 'a', level: 'L2' },
    { id: 'b', level: 'L1' },   // no paddler targets L1 -> excluded
    { id: 'c', level: 'L2' },
  ],
};
const withIntro = { ...base, intro: { sections: [{ heading: 'Overview' }] } };
const noIntro = { ...base, intro: null };

test('ratePages puts intro at index 0 and includes only applicable skills', () => {
  const pages = ratePages(withIntro);
  expect(pages[0]).toEqual({ intro: true });
  expect(pages.slice(1).map(p => p.id)).toEqual(['a', 'c']);
});

test('ratePages omits the intro page when there are no intro sections', () => {
  expect(ratePages(noIntro).map(p => p.id)).toEqual(['a', 'c']);
});

test('indexOfSkill returns the page index accounting for the intro offset', () => {
  expect(indexOfSkill(withIntro, 'c')).toBe(2);  // [intro, a, c]
  expect(indexOfSkill(noIntro, 'c')).toBe(1);    // [a, c]
});

test('indexOfSkill returns 0 for a missing or null skill id', () => {
  expect(indexOfSkill(withIntro, 'nope')).toBe(0);
  expect(indexOfSkill(withIntro, null)).toBe(0);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/rate-pages.test.js`
Expected: FAIL — cannot resolve `../src/lib/rate-pages.js`.

- [ ] **Step 3: Create the module**

```js
// src/lib/rate-pages.js
// The ordered pages of the Rate screen: an optional intro page (index 0) then
// the skills applicable to this session's paddlers, in skills order. Extracted
// so Rate and the review-page "jump to skill" lookup share one definition.
export function ratePages(session) {
  const visibleSkills = session.skills.filter(
    s => session.paddlers.some(p => p.target === s.level));
  const intro = session.intro && Array.isArray(session.intro.sections)
    && session.intro.sections.length ? session.intro : null;
  return intro ? [{ intro: true }, ...visibleSkills] : visibleSkills;
}

// Index of a skill in the Rate page space, or 0 (the first page) if not found.
export function indexOfSkill(session, skillId) {
  const i = ratePages(session).findIndex(p => !p.intro && p.id === skillId);
  return i >= 0 ? i : 0;
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run tests/rate-pages.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/rate-pages.js tests/rate-pages.test.js
git commit -m "feat(rate): extract pure ratePages + indexOfSkill helpers"
```

---

### Task 3: Rate uses `ratePages`, opens at `focusSkillId`

Behavior-preserving refactor plus the new entry point. Verified by the full suite staying green (no logic change to paging) and a manual check.

**Files:**
- Modify: `src/screens/Rate.jsx`

**Interfaces:**
- Consumes: `ratePages`, `indexOfSkill` from `src/lib/rate-pages.js`.
- Produces: `Rate` accepts a new optional prop `focusSkillId` (string | null, default `null`) and opens on that skill; when null/unknown it opens at index 0 (unchanged behavior).

- [ ] **Step 1: Import the helpers**

In `src/screens/Rate.jsx`, add to the imports:

```jsx
import { ratePages, indexOfSkill } from '../lib/rate-pages.js';
```

- [ ] **Step 2: Accept `focusSkillId` and initialize the page index from it**

Change the component signature and the `i` state initializer:

```jsx
export function Rate({ session, onChange, onDone, focusSkillId = null }) {
  const [i, setI] = useState(() => indexOfSkill(session, focusSkillId));
```

(Rate remounts on each screen entry, so this lazy initializer runs once per entry.)

- [ ] **Step 3: Replace the inline page construction with `ratePages`**

In `src/screens/Rate.jsx`, delete the inline `visibleSkills`/`intro`/`pages` lines:

```jsx
  const visibleSkills = session.skills.filter(s => session.paddlers.some(p => p.target === s.level));
  ...
  const intro = session.intro && Array.isArray(session.intro.sections) && session.intro.sections.length
    ? session.intro : null;
  ...
  const pages = intro ? [{ intro: true }, ...visibleSkills] : visibleSkills;
```

Replace them with the shared helper, preserving the local names the rest of the component uses. Keep the empty-state guard and the `introLevel`/`skillNo` computations intact:

```jsx
  const pages = ratePages(session);
  const visibleSkills = pages.filter(p => !p.intro);
  const intro = pages.length > 0 && pages[0].intro ? session.intro : null;

  if (visibleSkills.length === 0) {
    return (
      <main className="screen rate-screen">
        <p>No skills apply to this session's paddlers.</p>
      </main>
    );
  }

  const introLevel = (visibleSkills[0] && visibleSkills[0].level || '').toLowerCase();
```

Leave `const page = pages[i];`, `onIntro`, `skill`, `isLast`, `skillNo`, and everything below unchanged. `skillNo = onIntro ? 0 : i - (intro ? 1 : 0) + 1` still works because `intro` is truthy exactly when a page-0 intro exists.

- [ ] **Step 4: Run the full suite (guards the behavior-preserving refactor)**

Run: `npx vitest run`
Expected: PASS — all existing tests still green (no paging behavior changed).

- [ ] **Step 5: Manual smoke check**

Run: `npm run dev`, start an assessment, confirm the Rate screen still shows the intro first (if present) then skills, Next/Prev and the Skills overlay still work, and rating still blocks on missing feedback. (No `focusSkillId` is passed yet — that arrives in Task 5.)

- [ ] **Step 6: Commit**

```bash
git add src/screens/Rate.jsx
git commit -m "refactor(rate): use shared ratePages; open at optional focusSkillId"
```

---

### Task 4: `BelowStandardDetail` component + styles

Thin presentational view (not unit-tested per the repo convention). Its data (`standard`) comes from Task 1; its callback is wired in Task 5.

**Files:**
- Create: `src/components/BelowStandardDetail.jsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `items` (the `paddlerSummary().flagged` array — each `{skillId, name, category, standard, ratingLabel, feedback}`) and `onEditSkill(skillId)`.
- Produces: a `BelowStandardDetail` named export (no default), rendering one block per item; renders `null` for an empty/absent list.

- [ ] **Step 1: Create the component**

```jsx
// src/components/BelowStandardDetail.jsx
// Expanded view of a paddler's below-standard ratings on the Review screen:
// each shows the full official standard and the assessor's note, with a link
// back to that skill on the Rate screen. A thin view; logic lives in summary.js
// and rate-pages.js.
export function BelowStandardDetail({ items, onEditSkill }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="below-standard-detail">
      {items.map(item => (
        <section className="bsd-item" key={item.skillId}>
          <div className="bsd-head">
            <h4 className="bsd-name">{item.name}</h4>
            <span className="bsd-meta">{item.category} · {item.ratingLabel}</span>
            {onEditSkill ? (
              <button type="button" className="bsd-goto" onClick={() => onEditSkill(item.skillId)}>
                Go to skill →
              </button>
            ) : null}
          </div>
          {item.standard ? <p className="bsd-standard">{item.standard}</p> : null}
          {item.feedback ? <p className="bsd-note"><strong>Note:</strong> {item.feedback}</p> : null}
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Add styles to `src/styles.css`**

Append (match the existing review styling; these are additive, no existing rules changed):

```css
.below-standard-detail { margin: .5rem 0 0; }
.bsd-item {
  border-left: 3px solid #c0392b;
  padding: .4rem 0 .4rem .6rem;
  margin: .5rem 0;
}
.bsd-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: .4rem; }
.bsd-name { margin: 0; font-size: 1rem; }
.bsd-meta { color: #c0392b; font-size: .85rem; }
.bsd-goto {
  margin-left: auto;
  background: none; border: 0; color: #005f6b;
  font-size: .85rem; text-decoration: underline; cursor: pointer;
  min-height: 40px; padding: 0 .25rem;
}
.bsd-standard { margin: .3rem 0; color: #14323a; font-size: .9rem; }
.bsd-note { margin: .3rem 0 0; font-size: .9rem; }
```

- [ ] **Step 3: Confirm the build compiles**

Run: `npm run build`
Expected: build succeeds (component parses; no runtime wiring yet).

- [ ] **Step 4: Commit**

```bash
git add src/components/BelowStandardDetail.jsx src/styles.css
git commit -m "feat(review): add BelowStandardDetail component + styles"
```

---

### Task 5: Wire Review + app (render detail, thread the jump)

Integration task: render the component in Review and thread `focusSkillId` from `app.jsx` into Rate so "Go to skill" works end to end.

**Files:**
- Modify: `src/screens/Review.jsx`
- Modify: `src/app.jsx`

**Interfaces:**
- Consumes: `BelowStandardDetail` (Task 4); `indexOfSkill`/`focusSkillId` path via Rate (Task 3).
- Produces: `Review` accepts a new `onEditSkill(skillId)` prop; `app.jsx` owns `focusSkillId` state and passes it to Rate.

- [ ] **Step 1: Render `BelowStandardDetail` in Review**

In `src/screens/Review.jsx`, add the import:

```jsx
import { BelowStandardDetail } from '../components/BelowStandardDetail.jsx';
```

Add `onEditSkill` to the component props:

```jsx
export function Review({ session, onChange, onBack, onReset, onEditSkill }) {
```

Replace the existing below-standard list:

```jsx
              {summary.flagged.length > 0 ? (
                <ul className="review-below-list">
                  {summary.flagged.map(item => (
                    <li key={item.skillId}>
                      <strong>{item.name}</strong> ({item.category}) — {item.ratingLabel}: {item.feedback}
                    </li>
                  ))}
                </ul>
              ) : null}
```

with:

```jsx
              <BelowStandardDetail items={summary.flagged} onEditSkill={onEditSkill} />
```

- [ ] **Step 2: Add `focusSkillId` state and wiring in `app.jsx`**

In `src/app.jsx`, add the state near the other `useState` calls:

```jsx
  const [focusSkillId, setFocusSkillId] = useState(null);
```

Pass `focusSkillId` to `Rate` (in the `screen === 'rate'` branch):

```jsx
        <Rate
          session={session}
          focusSkillId={focusSkillId}
          onChange={update}
          onDone={() => setScreen('review')}
        />
```

Update the `Review` render (the final `return`) to clear focus on plain back and to pass the jump handler:

```jsx
    <Review
      session={session}
      onChange={update}
      onBack={() => { setFocusSkillId(null); setScreen('rate'); }}
      onReset={reset}
      onEditSkill={(skillId) => { setFocusSkillId(skillId); setScreen('rate'); }}
    />
```

(If the existing `onBack` was `() => setScreen('rate')`, replace it with the clearing version above.)

- [ ] **Step 3: Run the full suite**

Run: `npx vitest run`
Expected: PASS — all tests green (views untested; lib tests unaffected).

- [ ] **Step 4: Manual end-to-end verification**

Run: `npm run dev`. Create an assessment, rate a core skill **below standard** and add a note, go to **Review**. Confirm:
1. The paddler's card shows an expanded block: skill name · category · rating, the **full standard text**, and the **note**.
2. Clicking **"Go to skill →"** opens the Rate screen **on that exact skill** (the same skill name in the header).
3. From Review, **"◀ Back to rating"** opens the **first page** (intro if present, else first skill) — i.e. focus was cleared.
4. A skill with an empty standard shows header + note only; a paddler with no below-standard skills shows no detail block.

- [ ] **Step 5: Commit**

```bash
git add src/screens/Review.jsx src/app.jsx
git commit -m "feat(review): show below-standard detail and jump to the skill"
```

---

## Self-Review (completed by plan author)

- **Spec coverage:** `standard` on flagged items (Task 1); `ratePages`/`indexOfSkill` extraction + tests (Task 2); Rate refactor + `focusSkillId` entry (Task 3); `BelowStandardDetail` + styles (Task 4); Review render + `app` `focusSkillId` wiring incl. clearing on back (Task 5). Edge cases (empty standard, unknown/null focus, empty flagged) covered by component guards + `indexOfSkill` fallback and verified in Task 5 manual step. Out-of-scope items (PDF/CSV, DNO/unrated, collapse) excluded.
- **Placeholder scan:** none; every code step shows complete code.
- **Type consistency:** `flagged`/`optionalItems` item shape gains `standard` (Task 1) and `BelowStandardDetail` consumes exactly `{skillId,name,category,standard,ratingLabel,feedback}` (Task 4); `indexOfSkill(session, skillId)`/`ratePages(session)` signatures match their call sites in Rate (Task 3); `onEditSkill(skillId)` prop name consistent across `BelowStandardDetail`, `Review`, and `app` (Tasks 4–5); `focusSkillId` prop consistent across `app` and `Rate` (Tasks 3, 5).
