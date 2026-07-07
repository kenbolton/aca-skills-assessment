# Conditions Dropdowns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the four free-text "observed conditions" inputs on the Setup screen with dropdowns — wind on the Beaufort scale (knots + descriptive help line), current in knots, waves/surf in feet+meters — storing a descriptive string so all downstream (Review, PDF, Pi archive) is unchanged.

**Architecture:** A new pure reference module `src/data/conditions.js` holds the Beaufort table, current levels, and wave/surf heights, plus a `beaufortSpec()` lookup. `Setup.jsx` renders `<select>`s from those tables (blank default = not recorded) and a wind help line. The stored `conditions[key]` remains a string, so `conditionsSummary`/PDF/CSV/Pi are untouched.

**Tech Stack:** Vite + Preact, plain CSS, Vitest (`environment: node`).

## Global Constraints

- **Node 22+**; test env is **`node`** (no DOM). Tests cover pure `src/lib`/`src/data` logic only; screens are thin views not unit-tested by rendering.
- **No new dependencies.**
- **Preact** — import from `preact`/`preact/hooks`.
- **Backward-compatible:** the `conditions` object stays `{ wind, waves, surf, current }` of **strings**; existing free-text/archived sessions must still render. No data-model change, no migration.
- **Scope:** Setup screen + the new data module only. Do NOT change `normConditions`, `conditionsSummary`, PDF, CSV, or the Pi archive.
- **Reference strings are exact** (en dash `–`, `<`, `+`), copied verbatim from the spec. Stored wind value is e.g. `F4 Moderate (11–16 kn)`; the Specification is help-line-only (never stored).
- Test-authoring style: `import { expect, test } from 'vitest'` with inline fixtures (matches `tests/session.test.js`).

---

### Task 1: `conditions.js` reference module + tests

**Files:**
- Create: `src/data/conditions.js`
- Test: `tests/conditions.test.js`

**Interfaces:**
- Produces:
  - `BEAUFORT: Array<{ value: string, spec: string }>` — 13 entries, F0…F12 in order; `value` is both the option text and the stored string; `spec` is the help-line copy.
  - `CURRENT_LEVELS: string[]` — current buckets (knots).
  - `WAVE_HEIGHTS: string[]` — wave/surf height buckets (ft + m); shared by both fields.
  - `beaufortSpec(value: string): string` — the spec for a stored wind value, or `''` if not found/blank.

- [ ] **Step 1: Write the failing tests**

```js
// tests/conditions.test.js
import { expect, test } from 'vitest';
import { BEAUFORT, CURRENT_LEVELS, WAVE_HEIGHTS, beaufortSpec } from '../src/data/conditions.js';
import { createSession, conditionsSummary } from '../src/lib/session.js';

test('BEAUFORT has 13 forces F0..F12 in order, each well-formed with a spec', () => {
  expect(BEAUFORT).toHaveLength(13);
  BEAUFORT.forEach((b, i) => {
    expect(b.value.startsWith(`F${i} `)).toBe(true);
    expect(b.value).toMatch(/^F\d{1,2} .+ \(.*kn\)$/);
    expect(b.spec.length).toBeGreaterThan(0);
  });
});

test('current and height tables are non-empty; waves/surf share the height table', () => {
  expect(CURRENT_LEVELS.length).toBeGreaterThan(0);
  expect(WAVE_HEIGHTS.length).toBeGreaterThan(0);
  expect(CURRENT_LEVELS).toContain('1–2 kn');
  expect(WAVE_HEIGHTS).toContain('1–2 ft (0.3–0.6 m)');
});

test('beaufortSpec resolves a stored wind value and is safe on unknown/blank', () => {
  expect(beaufortSpec('F4 Moderate (11–16 kn)')).toBe('Raises dust, loose paper; small branches moved');
  expect(beaufortSpec('12 kn')).toBe('');   // an old free-text value
  expect(beaufortSpec('')).toBe('');
});

test('dropdown strings flow unchanged through createSession -> conditionsSummary', () => {
  const config = { scales: { L2: [] }, skills: [] };
  const s = createSession({
    id: 'c', createdAt: 't', config,
    conditions: { wind: 'F4 Moderate (11–16 kn)', waves: '1–2 ft (0.3–0.6 m)' },
    paddlers: [{ name: 'A', target: 'L2' }],
  });
  expect(s.conditions).toEqual({ wind: 'F4 Moderate (11–16 kn)', waves: '1–2 ft (0.3–0.6 m)' });
  expect(conditionsSummary(s)).toBe('Wind F4 Moderate (11–16 kn) · Waves 1–2 ft (0.3–0.6 m)');
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/conditions.test.js`
Expected: FAIL — cannot resolve `../src/data/conditions.js`.

- [ ] **Step 3: Create the module**

```js
// src/data/conditions.js
// Reference tables for the Setup "observed conditions" dropdowns. Each stored
// value is a human-readable string kept in session.conditions[key] as before,
// so summaries/exports/archive are unchanged. Wind uses the Beaufort scale
// (knots) with the ACA descriptive copy shown as a help line (spec).

export const BEAUFORT = [
  { value: 'F0 Calm (<1 kn)',            spec: 'Smoke rises vertically' },
  { value: 'F1 Light Air (1–3 kn)',      spec: 'Direction of wind shown by smoke drift but not by wind vanes' },
  { value: 'F2 Light Breeze (4–6 kn)',   spec: 'Wind felt on face; leaves rustle; wind vanes moved by wind' },
  { value: 'F3 Gentle Breeze (7–10 kn)', spec: 'Leaves and small twigs in constant motion; wind extends a light flag' },
  { value: 'F4 Moderate (11–16 kn)',     spec: 'Raises dust, loose paper; small branches moved' },
  { value: 'F5 Fresh (17–21 kn)',        spec: 'Small trees begin to sway; crested wavelets form on inland waters' },
  { value: 'F6 Strong (22–27 kn)',       spec: 'Large branches in motion; whistling heard in wires; umbrellas used with difficulty' },
  { value: 'F7 Near Gale (28–33 kn)',    spec: 'Whole trees in motion; inconvenience felt walking against the wind' },
  { value: 'F8 Gale (34–40 kn)',         spec: 'Twigs break off trees; wind generally impedes progress' },
  { value: 'F9 Strong Gale (41–47 kn)',  spec: 'Slight structural damage occurs; sheds and roofs suffer minor damage' },
  { value: 'F10 Storm (48–55 kn)',       spec: 'Trees uprooted; considerable structural damage' },
  { value: 'F11 Violent Storm (56–63 kn)', spec: 'Widespread damage; large branches snapped off; road signs toppled' },
  { value: 'F12 Hurricane (64+ kn)',     spec: 'Devastation; large trees and branches downed; significant structural damage' },
];

export const CURRENT_LEVELS = [
  'Slack (<0.5 kn)', '0.5–1 kn', '1–2 kn', '2–3 kn', '3–4 kn', '4+ kn',
];

export const WAVE_HEIGHTS = [
  'Flat', '<1 ft (<0.3 m)', '1–2 ft (0.3–0.6 m)', '2–3 ft (0.6–0.9 m)',
  '3–4 ft (0.9–1.2 m)', '4–6 ft (1.2–1.8 m)', '6+ ft (1.8+ m)',
];

// The help-line copy for a stored wind value, or '' if it isn't a Beaufort
// value (e.g. an older free-text entry) or nothing is selected.
export function beaufortSpec(value) {
  return (BEAUFORT.find(b => b.value === value) || {}).spec || '';
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run tests/conditions.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Run the full suite**

Run: `npx vitest run`
Expected: PASS (all existing tests + the 4 new).

- [ ] **Step 6: Commit**

```bash
git add src/data/conditions.js tests/conditions.test.js
git commit -m "feat(conditions): add Beaufort/current/height reference tables"
```

---

### Task 2: Swap Setup conditions inputs for dropdowns

Thin-view change (not unit-tested by rendering). Verified by the full suite staying green, `npm run build`, and a manual check.

**Files:**
- Modify: `src/screens/Setup.jsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `BEAUFORT`, `CURRENT_LEVELS`, `WAVE_HEIGHTS`, `beaufortSpec` from `src/data/conditions.js`.
- Produces: no new exports. The `conditions` state stays `{ wind, waves, surf, current }` strings; `handleStart`/`createSession` wiring is unchanged.

- [ ] **Step 1: Add the import**

In `src/screens/Setup.jsx`, add beneath the existing data imports:

```jsx
import { BEAUFORT, CURRENT_LEVELS, WAVE_HEIGHTS, beaufortSpec } from '../data/conditions.js';
```

- [ ] **Step 2: Replace the `CONDITION_FIELDS` constant with `CONDITION_SELECTS`**

Delete the existing constant:

```jsx
const CONDITION_FIELDS = [
  { key: 'wind', label: 'Wind', placeholder: 'e.g. 12 kn' },
  { key: 'waves', label: 'Waves', placeholder: 'e.g. 1 ft' },
  { key: 'surf', label: 'Surf', placeholder: 'e.g. 2 ft' },
  { key: 'current', label: 'Current', placeholder: 'e.g. 1 kn' },
];
```

Replace it with:

```jsx
const CONDITION_SELECTS = [
  { key: 'wind', label: 'Wind', options: BEAUFORT.map(b => b.value), spec: true },
  { key: 'waves', label: 'Waves', options: WAVE_HEIGHTS },
  { key: 'surf', label: 'Surf', options: WAVE_HEIGHTS },
  { key: 'current', label: 'Current', options: CURRENT_LEVELS },
];
```

(Leave the `conditions` state initializer `useState({ wind: '', waves: '', surf: '', current: '' })` unchanged.)

- [ ] **Step 3: Replace the conditions JSX block**

Replace the existing block:

```jsx
      <fieldset className="field conditions-fieldset">
        <legend>Observed conditions (optional)</legend>
        <div className="conditions-grid">
          {CONDITION_FIELDS.map(f => (
            <label className="field" key={f.key}>
              <span>{f.label}</span>
              <input
                type="text"
                placeholder={f.placeholder}
                value={conditions[f.key]}
                onChange={e => setConditions(c => ({ ...c, [f.key]: e.currentTarget.value }))}
              />
            </label>
          ))}
        </div>
      </fieldset>
```

with:

```jsx
      <fieldset className="field conditions-fieldset">
        <legend>Observed conditions (optional)</legend>
        <div className="conditions-grid">
          {CONDITION_SELECTS.map(f => (
            <label className="field" key={f.key}>
              <span>{f.label}</span>
              <select
                value={conditions[f.key]}
                onChange={e => setConditions(c => ({ ...c, [f.key]: e.currentTarget.value }))}
              >
                <option value="">— not recorded</option>
                {f.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
              {f.spec && conditions[f.key] ? (
                <span className="condition-spec">{beaufortSpec(conditions[f.key])}</span>
              ) : null}
            </label>
          ))}
        </div>
      </fieldset>
```

- [ ] **Step 4: Add the help-line style**

Append to `src/styles.css`:

```css
.condition-spec {
  display: block;
  margin-top: .25rem;
  font-size: .8rem;
  color: #4a5a5d;
}
```

- [ ] **Step 5: Run the full suite**

Run: `npx vitest run`
Expected: PASS — all tests green (Setup is a thin view; the `conditions` state shape is unchanged, so nothing regresses).

- [ ] **Step 6: Build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 7: Manual verification**

Run: `npm run dev`. On the Setup screen confirm:
1. Wind/Waves/Surf/Current are now `<select>`s, each defaulting to "— not recorded".
2. Wind lists F0…F12 (e.g. "F4 Moderate (11–16 kn)"); selecting a force shows its Specification as a help line below the field; selecting "— not recorded" hides it.
3. Waves and Surf list the ft+m height buckets; Current lists the knot buckets.
4. Start an assessment with a couple of conditions set → the Review venue line shows them (e.g. "… · Wind F4 Moderate (11–16 kn) · Waves 1–2 ft (0.3–0.6 m)").
5. Leaving all conditions at "— not recorded" records no conditions (no venue conditions shown).

- [ ] **Step 8: Commit**

```bash
git add src/screens/Setup.jsx src/styles.css
git commit -m "feat(setup): conditions as dropdowns (Beaufort wind, knots, ft+m)"
```

---

## Self-Review (completed by plan author)

- **Spec coverage:** reference tables + `beaufortSpec` (Task 1); Setup selects with blank default, wind help line, ft+m heights, knot current, unchanged `conditions` string shape (Task 2). Backward compat verified by the round-trip test (Task 1) and by leaving `normConditions`/`conditionsSummary`/PDF/CSV/Pi untouched. Out-of-scope items (structured data, multi-unit velocity, weather autofill, export format changes) excluded.
- **Placeholder scan:** none; every code step shows complete code, and the reference strings are the exact spec strings.
- **Type consistency:** `BEAUFORT` (array of `{value,spec}`), `CURRENT_LEVELS`/`WAVE_HEIGHTS` (string arrays), and `beaufortSpec(value)→string` are produced in Task 1 and consumed identically in Task 2's `CONDITION_SELECTS` (`BEAUFORT.map(b => b.value)`, `f.options`, `beaufortSpec(conditions[f.key])`). The `conditions` state remains `{key:string}` throughout, matching `createSession`/`conditionsSummary`.
