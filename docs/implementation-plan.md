# ACA Skills Assessment PWA — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an offline-first PWA to score up to 4 paddlers against ACA Coastal Kayaking L1/L2 skills in real time on the water, with mandatory dictated feedback on "Does Not Meet", per-paddler PDF/CSV export, and sync to a Raspberry Pi.

**Architecture:** A Preact single-page app built with Vite. Pure functions (skills loading, session updates, validation, summary, CSV) are unit-tested with Vitest and hold all logic; Preact screens are thin views over them. State persists to `localStorage` on every change. `vite-plugin-pwa` precaches the app + jsPDF for full offline use. A tiny Node HTTP server on the Pi receives synced session JSON, hosted via `tailscale serve`.

**Tech Stack:** Vite 6, Preact 10, `vite-plugin-pwa`, jsPDF (bundled), Vitest, plain CSS. Pi: Node built-in `http` module + `tailscale serve`.

## Global Constraints

- App lives in `skills-assessment/` at the repo root. Do NOT touch `website/`.
- Node ≥ 26, npm ≥ 11 (dev machine has 26.4.0 / 11.17.0).
- Rating values are exactly the strings `'does_not_meet' | 'meets' | 'exceeds'`.
- localStorage key for the active session: `aca-assessment:session`.
- **Core invariant:** a result with `rating === 'does_not_meet'` MUST have non-empty trimmed `feedback`. Enforced in UI and unit-tested.
- All logic functions are pure and return NEW session objects (no mutation), so Preact re-renders reliably.
- No fabricated ACA standards: seed `standard` values are short cues suffixed `[VERIFY]`.
- Offline is non-negotiable: no runtime CDN calls; all deps bundled.
- ES modules everywhere (`.mjs` for Pi script, `type: module` in package.json).

---

## File Structure

```
skills-assessment/
├── package.json
├── vite.config.js
├── index.html
├── public/icons/            # PWA icons (192, 512, maskable)
├── src/
│   ├── main.jsx             # mounts <App/>
│   ├── app.jsx              # screen router + top-level session state
│   ├── data/skills.json     # seed skills w/ [VERIFY] standards
│   ├── lib/
│   │   ├── skills.js        # loadSkills, skillsForLevel
│   │   ├── session.js       # createSession, save/load/clear, setRating, setFeedback, getResult
│   │   ├── validation.js    # resultNeedsFeedback, invalidResults, isSessionComplete
│   │   ├── summary.js       # paddlerSummary
│   │   ├── csv.js           # sessionToCsv
│   │   ├── pdf.js           # downloadPaddlerPdf
│   │   └── sync.js          # syncSession
│   ├── screens/
│   │   ├── Setup.jsx
│   │   ├── Rate.jsx
│   │   └── Review.jsx
│   └── styles.css
├── tests/
│   ├── skills.test.js
│   ├── session.test.js
│   ├── validation.test.js
│   ├── summary.test.js
│   └── csv.test.js
└── pi/
    ├── sync-server.mjs
    └── README.md
```

---

### Task 1: Project scaffold (Vite + Preact + Vitest)

**Files:**
- Create: `skills-assessment/package.json`, `skills-assessment/vite.config.js`, `skills-assessment/index.html`, `skills-assessment/src/main.jsx`, `skills-assessment/src/app.jsx`, `skills-assessment/src/styles.css`
- Test: `skills-assessment/tests/smoke.test.js`

**Interfaces:**
- Produces: a runnable dev server and a passing Vitest setup that later tasks extend.

- [ ] **Step 1: Create `skills-assessment/package.json`**

```json
{
  "name": "aca-skills-assessment",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview --host",
    "test": "vitest run"
  },
  "dependencies": {
    "preact": "^10.24.0",
    "jspdf": "^2.5.2"
  },
  "devDependencies": {
    "vite": "^6.0.0",
    "@preact/preset-vite": "^2.9.0",
    "vite-plugin-pwa": "^0.21.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `skills-assessment/vite.config.js`** (PWA added in Task 11; minimal here)

```js
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  plugins: [preact()],
  test: { environment: 'node' },
});
```

- [ ] **Step 3: Create `skills-assessment/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>ACA Skills Assessment</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 4: Create `skills-assessment/src/styles.css`** (starter; expanded in screen tasks)

```css
:root { --hit: 56px; --dnm: #c0392b; --meet: #2e7d32; --exc: #005f6b; }
* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, sans-serif; font-size: 18px; -webkit-text-size-adjust: 100%; }
button { min-height: var(--hit); font-size: 18px; }
```

- [ ] **Step 5: Create `skills-assessment/src/app.jsx`** (placeholder shell)

```jsx
export function App() {
  return <main style={{ padding: '1rem' }}><h1>ACA Skills Assessment</h1></main>;
}
```

- [ ] **Step 6: Create `skills-assessment/src/main.jsx`**

```jsx
import { render } from 'preact';
import { App } from './app.jsx';
import './styles.css';

render(<App />, document.getElementById('app'));
```

- [ ] **Step 7: Create `skills-assessment/tests/smoke.test.js`**

```js
import { expect, test } from 'vitest';

test('math sanity — toolchain runs', () => {
  expect(1 + 1).toBe(2);
});
```

- [ ] **Step 8: Install and verify**

Run: `cd skills-assessment && npm install && npm test`
Expected: Vitest reports `1 passed`.

- [ ] **Step 9: Verify dev server boots**

Run: `cd skills-assessment && npm run build`
Expected: build completes, `dist/` created, no errors.

- [ ] **Step 10: Commit**

```bash
git add skills-assessment/package.json skills-assessment/package-lock.json skills-assessment/vite.config.js skills-assessment/index.html skills-assessment/src skills-assessment/tests/smoke.test.js
git commit -m "chore: scaffold ACA skills assessment PWA (Vite + Preact + Vitest)"
```

---

### Task 2: Skills data + loader/validation

**Files:**
- Create: `skills-assessment/src/data/skills.json`, `skills-assessment/src/lib/skills.js`
- Test: `skills-assessment/tests/skills.test.js`

**Interfaces:**
- Produces:
  - `loadSkills(raw: unknown): Skill[]` — validates shape, throws `Error` with a clear message on bad data.
  - `skillsForLevel(skills: Skill[], level: 'L1'|'L2'): Skill[]` — filters to skills whose `levels` includes `level`.
  - `Skill = { id, category, name, levels: ('L1'|'L2')[], standard: { L1?: string, L2?: string } }`

- [ ] **Step 1: Write the failing test** — `skills-assessment/tests/skills.test.js`

```js
import { expect, test } from 'vitest';
import { loadSkills, skillsForLevel } from '../src/lib/skills.js';

const good = [
  { id: 'wet-exit', category: 'Rescues', name: 'Wet Exit', levels: ['L1', 'L2'], standard: { L1: 'exits calmly [VERIFY]', L2: 'exits calmly [VERIFY]' } },
  { id: 'stern-rudder', category: 'Strokes', name: 'Stern Rudder', levels: ['L2'], standard: { L2: 'holds line [VERIFY]' } },
];

test('loadSkills accepts valid data', () => {
  expect(loadSkills(good)).toHaveLength(2);
});

test('loadSkills rejects a skill missing an id', () => {
  expect(() => loadSkills([{ category: 'x', name: 'y', levels: ['L1'], standard: {} }]))
    .toThrow(/id/);
});

test('loadSkills rejects an invalid level tag', () => {
  expect(() => loadSkills([{ id: 'a', category: 'x', name: 'y', levels: ['L3'], standard: {} }]))
    .toThrow(/level/i);
});

test('skillsForLevel filters by level', () => {
  const skills = loadSkills(good);
  expect(skillsForLevel(skills, 'L1').map(s => s.id)).toEqual(['wet-exit']);
  expect(skillsForLevel(skills, 'L2').map(s => s.id)).toEqual(['wet-exit', 'stern-rudder']);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd skills-assessment && npx vitest run tests/skills.test.js`
Expected: FAIL — cannot resolve `../src/lib/skills.js`.

- [ ] **Step 3: Implement `skills-assessment/src/lib/skills.js`**

```js
const LEVELS = ['L1', 'L2'];

export function loadSkills(raw) {
  if (!Array.isArray(raw)) throw new Error('skills.json must be an array');
  return raw.map((s, i) => {
    if (!s || typeof s.id !== 'string' || !s.id) throw new Error(`skill[${i}] missing id`);
    if (typeof s.category !== 'string') throw new Error(`skill ${s.id} missing category`);
    if (typeof s.name !== 'string') throw new Error(`skill ${s.id} missing name`);
    if (!Array.isArray(s.levels) || s.levels.length === 0) throw new Error(`skill ${s.id} missing levels`);
    for (const lv of s.levels) if (!LEVELS.includes(lv)) throw new Error(`skill ${s.id} has invalid level ${lv}`);
    const standard = s.standard && typeof s.standard === 'object' ? s.standard : {};
    return { id: s.id, category: s.category, name: s.name, levels: [...s.levels], standard };
  });
}

export function skillsForLevel(skills, level) {
  return skills.filter(s => s.levels.includes(level));
}
```

- [ ] **Step 4: Create seed `skills-assessment/src/data/skills.json`** (DRAFT — Ken corrects; standards suffixed `[VERIFY]`)

```json
[
  { "id": "dress-conditions", "category": "Preparation & Equipment", "name": "Personal gear & dress for conditions", "levels": ["L1", "L2"], "standard": { "L1": "Dressed appropriately for water temperature and weather; understands layering. [VERIFY]", "L2": "Selects immersion-appropriate clothing for coastal conditions. [VERIFY]" } },
  { "id": "pfd-fit", "category": "Preparation & Equipment", "name": "PFD fit and use", "levels": ["L1", "L2"], "standard": { "L1": "PFD correctly sized, worn, and fastened. [VERIFY]", "L2": "PFD correctly worn; understands rescue-relevant features. [VERIFY]" } },
  { "id": "boat-outfitting", "category": "Preparation & Equipment", "name": "Boat outfitting & fit", "levels": ["L1", "L2"], "standard": { "L1": "Foot pegs, backband, and contact points adjusted for control. [VERIFY]", "L2": "Outfitting supports edging and bracing in moving water. [VERIFY]" } },
  { "id": "prelaunch-check", "category": "Preparation & Equipment", "name": "Pre-launch safety check", "levels": ["L1", "L2"], "standard": { "L1": "Checks own and group gear before launch. [VERIFY]", "L2": "Completes float plan / conditions check before coastal launch. [VERIFY]" } },
  { "id": "launch", "category": "Launching & Landing", "name": "Launch from beach/shore", "levels": ["L1", "L2"], "standard": { "L1": "Enters boat and launches under control from shore. [VERIFY]", "L2": "Launches under control through small surf/wind. [VERIFY]" } },
  { "id": "land", "category": "Launching & Landing", "name": "Land on beach/shore", "levels": ["L1", "L2"], "standard": { "L1": "Approaches and exits boat under control at shore. [VERIFY]", "L2": "Lands under control in small surf/wind. [VERIFY]" } },
  { "id": "forward-stroke", "category": "Strokes & Maneuvers", "name": "Forward stroke", "levels": ["L1", "L2"], "standard": { "L1": "Maintains a straight course with efficient, symmetric strokes. [VERIFY]", "L2": "Efficient torso-driven forward stroke tracking straight in wind. [VERIFY]" } },
  { "id": "reverse-stop", "category": "Strokes & Maneuvers", "name": "Reverse stroke & stopping", "levels": ["L1", "L2"], "standard": { "L1": "Stops and paddles backward under control. [VERIFY]", "L2": "Controlled reverse and stop in moving water. [VERIFY]" } },
  { "id": "forward-sweep", "category": "Strokes & Maneuvers", "name": "Forward sweep turn", "levels": ["L1", "L2"], "standard": { "L1": "Turns the boat with an effective forward sweep. [VERIFY]", "L2": "Combines sweep with edge to turn efficiently. [VERIFY]" } },
  { "id": "reverse-sweep", "category": "Strokes & Maneuvers", "name": "Reverse sweep turn", "levels": ["L1", "L2"], "standard": { "L1": "Turns the boat with an effective reverse sweep. [VERIFY]", "L2": "Controlled reverse sweep with edge. [VERIFY]" } },
  { "id": "draw-stroke", "category": "Strokes & Maneuvers", "name": "Draw stroke (side/T)", "levels": ["L1", "L2"], "standard": { "L1": "Moves the boat sideways under control. [VERIFY]", "L2": "Effective draw to move sideways to a target. [VERIFY]" } },
  { "id": "stern-rudder", "category": "Strokes & Maneuvers", "name": "Stern rudder", "levels": ["L2"], "standard": { "L2": "Holds a line with a stern rudder while moving. [VERIFY]" } },
  { "id": "edging", "category": "Strokes & Maneuvers", "name": "Edging / boat tilt", "levels": ["L2"], "standard": { "L2": "Holds a stable edge to assist turns. [VERIFY]" } },
  { "id": "low-brace", "category": "Strokes & Maneuvers", "name": "Low brace", "levels": ["L1", "L2"], "standard": { "L1": "Recovers balance with a low brace. [VERIFY]", "L2": "Reliable low brace in small waves. [VERIFY]" } },
  { "id": "high-brace", "category": "Strokes & Maneuvers", "name": "High brace", "levels": ["L2"], "standard": { "L2": "Recovers with a safe high brace, elbows low. [VERIFY]" } },
  { "id": "wet-exit", "category": "Rescues & Safety", "name": "Wet exit", "levels": ["L1", "L2"], "standard": { "L1": "Exits a capsized boat calmly and retains paddle/boat. [VERIFY]", "L2": "Controlled wet exit in coastal conditions. [VERIFY]" } },
  { "id": "assisted-rescuer", "category": "Rescues & Safety", "name": "Assisted (T/X) rescue — as rescuer", "levels": ["L1", "L2"], "standard": { "L1": "Empties and stabilizes a swimmer's boat and assists re-entry. [VERIFY]", "L2": "Efficient assisted rescue in wind/waves. [VERIFY]" } },
  { "id": "assisted-swimmer", "category": "Rescues & Safety", "name": "Assisted (T/X) rescue — as swimmer", "levels": ["L1", "L2"], "standard": { "L1": "Assists own rescue and re-enters the boat. [VERIFY]", "L2": "Effective swimmer role in coastal conditions. [VERIFY]" } },
  { "id": "reentry-empty", "category": "Rescues & Safety", "name": "Re-entry & boat emptying", "levels": ["L2"], "standard": { "L2": "Empties and re-enters boat with minimal water remaining. [VERIFY]" } },
  { "id": "contact-tow", "category": "Rescues & Safety", "name": "Contact tow / short tow", "levels": ["L2"], "standard": { "L2": "Performs a short contact tow under control. [VERIFY]" } },
  { "id": "tow-system", "category": "Rescues & Safety", "name": "Use of tow system", "levels": ["L2"], "standard": { "L2": "Deploys and releases a tow system safely. [VERIFY]" } },
  { "id": "signals", "category": "Group & Judgment", "name": "Communication & paddle signals", "levels": ["L1", "L2"], "standard": { "L1": "Knows and uses basic paddle/whistle signals. [VERIFY]", "L2": "Communicates clearly to coordinate the group. [VERIFY]" } },
  { "id": "group-awareness", "category": "Group & Judgment", "name": "Group awareness & positioning", "levels": ["L1", "L2"], "standard": { "L1": "Stays with the group and aware of others. [VERIFY]", "L2": "Maintains safe positioning relative to group and hazards. [VERIFY]" } },
  { "id": "conditions", "category": "Group & Judgment", "name": "Understanding of conditions / trip planning", "levels": ["L2"], "standard": { "L2": "Describes wind, tide, and hazard basics for the trip. [VERIFY]" } }
]
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd skills-assessment && npx vitest run tests/skills.test.js`
Expected: `4 passed`.

- [ ] **Step 6: Commit**

```bash
git add skills-assessment/src/data/skills.json skills-assessment/src/lib/skills.js skills-assessment/tests/skills.test.js
git commit -m "feat: add skills schema, validating loader, and seed L1/L2 skill list"
```

---

### Task 3: Session model + persistence

**Files:**
- Create: `skills-assessment/src/lib/session.js`
- Test: `skills-assessment/tests/session.test.js`

**Interfaces:**
- Consumes: `Skill`, `skillsForLevel` from `skills.js`.
- Produces:
  - `Rating = 'does_not_meet'|'meets'|'exceeds'`
  - `SkillResult = { paddlerId, skillId, rating: Rating|null, feedback: string }`
  - `Session = { id, createdAt, level, location, paddlers: {id,name}[], skills: Skill[], results: SkillResult[], syncedAt?: string }`
  - `createSession({ id, createdAt, level, location, paddlerNames, skills }): Session` — builds one `SkillResult` per (paddler × applicable skill), `rating: null`, `feedback: ''`. `id`/`createdAt` are passed in (caller supplies, so tests are deterministic).
  - `getResult(session, paddlerId, skillId): SkillResult | undefined`
  - `setRating(session, paddlerId, skillId, rating): Session` — returns a new session; clears `feedback` to `''` when rating changes away from `does_not_meet`.
  - `setFeedback(session, paddlerId, skillId, feedback): Session` — returns a new session.
  - `saveSession(session): void` / `loadSession(): Session|null` / `clearSession(): void` — localStorage under `aca-assessment:session`.

- [ ] **Step 1: Write the failing test** — `skills-assessment/tests/session.test.js`

```js
import { expect, test, beforeEach } from 'vitest';
import { createSession, getResult, setRating, setFeedback, saveSession, loadSession, clearSession } from '../src/lib/session.js';

const skills = [
  { id: 'wet-exit', category: 'R', name: 'Wet Exit', levels: ['L1', 'L2'], standard: {} },
  { id: 'stern-rudder', category: 'S', name: 'Stern Rudder', levels: ['L2'], standard: {} },
];

function base() {
  return createSession({ id: 's1', createdAt: '2026-07-09T12:00:00Z', level: 'L1', location: 'Cold Spring', paddlerNames: ['Alex', 'Sam'], skills });
}

test('createSession builds one result per paddler x applicable skill', () => {
  const s = base(); // L1 => only wet-exit applies; 2 paddlers => 2 results
  expect(s.results).toHaveLength(2);
  expect(s.paddlers.map(p => p.name)).toEqual(['Alex', 'Sam']);
  expect(getResult(s, s.paddlers[0].id, 'wet-exit').rating).toBeNull();
});

test('setRating returns a new session and does not mutate', () => {
  const s = base();
  const pid = s.paddlers[0].id;
  const s2 = setRating(s, pid, 'wet-exit', 'meets');
  expect(getResult(s, pid, 'wet-exit').rating).toBeNull();
  expect(getResult(s2, pid, 'wet-exit').rating).toBe('meets');
});

test('changing rating away from does_not_meet clears feedback', () => {
  const s = base();
  const pid = s.paddlers[0].id;
  let s2 = setRating(s, pid, 'wet-exit', 'does_not_meet');
  s2 = setFeedback(s2, pid, 'wet-exit', 'needs work');
  s2 = setRating(s2, pid, 'wet-exit', 'meets');
  expect(getResult(s2, pid, 'wet-exit').feedback).toBe('');
});

test('save/load/clear round-trips via localStorage', () => {
  const s = base();
  saveSession(s);
  expect(loadSession().id).toBe('s1');
  clearSession();
  expect(loadSession()).toBeNull();
});
```

- [ ] **Step 2: Add a localStorage shim for the Node test env** — prepend to `tests/session.test.js`

```js
beforeEach(() => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k),
  };
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd skills-assessment && npx vitest run tests/session.test.js`
Expected: FAIL — cannot resolve `../src/lib/session.js`.

- [ ] **Step 4: Implement `skills-assessment/src/lib/session.js`**

```js
import { skillsForLevel } from './skills.js';

const KEY = 'aca-assessment:session';

let seq = 0;
function pid() { return `p${++seq}-${seq}`; }

export function createSession({ id, createdAt, level, location = '', paddlerNames, skills }) {
  const paddlers = paddlerNames
    .map(n => n.trim())
    .filter(Boolean)
    .map(name => ({ id: pid(), name }));
  const applicable = skillsForLevel(skills, level);
  const results = [];
  for (const p of paddlers) {
    for (const sk of applicable) {
      results.push({ paddlerId: p.id, skillId: sk.id, rating: null, feedback: '' });
    }
  }
  return { id, createdAt, level, location, paddlers, skills: applicable, results };
}

export function getResult(session, paddlerId, skillId) {
  return session.results.find(r => r.paddlerId === paddlerId && r.skillId === skillId);
}

function mapResult(session, paddlerId, skillId, fn) {
  return {
    ...session,
    results: session.results.map(r =>
      r.paddlerId === paddlerId && r.skillId === skillId ? fn(r) : r),
  };
}

export function setRating(session, paddlerId, skillId, rating) {
  return mapResult(session, paddlerId, skillId, r => ({
    ...r,
    rating,
    feedback: rating === 'does_not_meet' ? r.feedback : '',
  }));
}

export function setFeedback(session, paddlerId, skillId, feedback) {
  return mapResult(session, paddlerId, skillId, r => ({ ...r, feedback }));
}

export function saveSession(session) {
  localStorage.setItem(KEY, JSON.stringify(session));
}

export function loadSession() {
  const raw = localStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : null;
}

export function clearSession() {
  localStorage.removeItem(KEY);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd skills-assessment && npx vitest run tests/session.test.js`
Expected: `4 passed`.

- [ ] **Step 6: Commit**

```bash
git add skills-assessment/src/lib/session.js skills-assessment/tests/session.test.js
git commit -m "feat: add session model with immutable rating/feedback updates and persistence"
```

---

### Task 4: Validation invariant (DNM requires feedback)

**Files:**
- Create: `skills-assessment/src/lib/validation.js`
- Test: `skills-assessment/tests/validation.test.js`

**Interfaces:**
- Consumes: `Session`, `SkillResult`.
- Produces:
  - `resultNeedsFeedback(result): boolean` — true iff `rating === 'does_not_meet'` and `feedback.trim() === ''`.
  - `invalidResults(session): SkillResult[]` — all results where `resultNeedsFeedback` is true.
  - `isSessionComplete(session): boolean` — every result has a non-null rating AND no invalid results.

- [ ] **Step 1: Write the failing test** — `skills-assessment/tests/validation.test.js`

```js
import { expect, test } from 'vitest';
import { resultNeedsFeedback, invalidResults, isSessionComplete } from '../src/lib/validation.js';

const r = (rating, feedback = '') => ({ paddlerId: 'a', skillId: 'x', rating, feedback });

test('DNM with empty feedback needs feedback', () => {
  expect(resultNeedsFeedback(r('does_not_meet', '  '))).toBe(true);
  expect(resultNeedsFeedback(r('does_not_meet', 'why'))).toBe(false);
  expect(resultNeedsFeedback(r('meets'))).toBe(false);
});

test('invalidResults collects only unfilled DNMs', () => {
  const s = { results: [r('does_not_meet', ''), r('meets'), r('does_not_meet', 'ok')] };
  expect(invalidResults(s)).toHaveLength(1);
});

test('isSessionComplete requires all rated and all valid', () => {
  expect(isSessionComplete({ results: [r('meets'), r('exceeds')] })).toBe(true);
  expect(isSessionComplete({ results: [r(null)] })).toBe(false);
  expect(isSessionComplete({ results: [r('does_not_meet', '')] })).toBe(false);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd skills-assessment && npx vitest run tests/validation.test.js`
Expected: FAIL — cannot resolve `../src/lib/validation.js`.

- [ ] **Step 3: Implement `skills-assessment/src/lib/validation.js`**

```js
export function resultNeedsFeedback(result) {
  return result.rating === 'does_not_meet' && result.feedback.trim() === '';
}

export function invalidResults(session) {
  return session.results.filter(resultNeedsFeedback);
}

export function isSessionComplete(session) {
  return session.results.every(r => r.rating !== null) && invalidResults(session).length === 0;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd skills-assessment && npx vitest run tests/validation.test.js`
Expected: `3 passed`.

- [ ] **Step 5: Commit**

```bash
git add skills-assessment/src/lib/validation.js skills-assessment/tests/validation.test.js
git commit -m "feat: add DNM-requires-feedback validation and completeness check"
```

---

### Task 5: Per-paddler summary

**Files:**
- Create: `skills-assessment/src/lib/summary.js`
- Test: `skills-assessment/tests/summary.test.js`

**Interfaces:**
- Consumes: `Session`.
- Produces:
  - `paddlerSummary(session, paddlerId): { name, total, met, exceeds, notMet, unrated, notMetItems: { skillId, name, category, feedback }[] }`
    - `met` counts `meets`; `exceeds` counts `exceeds`; `notMet` counts `does_not_meet`; `unrated` counts `null`.
    - `notMetItems` lists each DNM skill with its name/category (looked up from `session.skills`) and feedback.

- [ ] **Step 1: Write the failing test** — `skills-assessment/tests/summary.test.js`

```js
import { expect, test } from 'vitest';
import { paddlerSummary } from '../src/lib/summary.js';

const session = {
  paddlers: [{ id: 'p1', name: 'Alex' }],
  skills: [
    { id: 'wet-exit', category: 'Rescues', name: 'Wet Exit' },
    { id: 'forward', category: 'Strokes', name: 'Forward Stroke' },
    { id: 'brace', category: 'Strokes', name: 'Low Brace' },
  ],
  results: [
    { paddlerId: 'p1', skillId: 'wet-exit', rating: 'does_not_meet', feedback: 'panicked' },
    { paddlerId: 'p1', skillId: 'forward', rating: 'exceeds', feedback: '' },
    { paddlerId: 'p1', skillId: 'brace', rating: 'meets', feedback: '' },
  ],
};

test('paddlerSummary tallies ratings and lists DNM items', () => {
  const s = paddlerSummary(session, 'p1');
  expect(s.name).toBe('Alex');
  expect(s).toMatchObject({ total: 3, met: 1, exceeds: 1, notMet: 1, unrated: 0 });
  expect(s.notMetItems).toEqual([
    { skillId: 'wet-exit', name: 'Wet Exit', category: 'Rescues', feedback: 'panicked' },
  ]);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd skills-assessment && npx vitest run tests/summary.test.js`
Expected: FAIL — cannot resolve `../src/lib/summary.js`.

- [ ] **Step 3: Implement `skills-assessment/src/lib/summary.js`**

```js
export function paddlerSummary(session, paddlerId) {
  const paddler = session.paddlers.find(p => p.id === paddlerId);
  const skillById = new Map(session.skills.map(s => [s.id, s]));
  const rows = session.results.filter(r => r.paddlerId === paddlerId);
  const summary = { name: paddler ? paddler.name : '', total: rows.length, met: 0, exceeds: 0, notMet: 0, unrated: 0, notMetItems: [] };
  for (const r of rows) {
    if (r.rating === 'meets') summary.met++;
    else if (r.rating === 'exceeds') summary.exceeds++;
    else if (r.rating === 'does_not_meet') {
      summary.notMet++;
      const sk = skillById.get(r.skillId);
      summary.notMetItems.push({ skillId: r.skillId, name: sk ? sk.name : r.skillId, category: sk ? sk.category : '', feedback: r.feedback });
    } else summary.unrated++;
  }
  return summary;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd skills-assessment && npx vitest run tests/summary.test.js`
Expected: `1 passed`.

- [ ] **Step 5: Commit**

```bash
git add skills-assessment/src/lib/summary.js skills-assessment/tests/summary.test.js
git commit -m "feat: add per-paddler summary computation"
```

---

### Task 6: CSV export

**Files:**
- Create: `skills-assessment/src/lib/csv.js`
- Test: `skills-assessment/tests/csv.test.js`

**Interfaces:**
- Consumes: `Session`.
- Produces: `sessionToCsv(session): string` — header row `Paddler,Category,Skill,Rating,Feedback` then one row per result. Fields containing `,` `"` or newlines are double-quoted with `"` escaped as `""`. Rating is the raw enum string; `null` becomes empty.

- [ ] **Step 1: Write the failing test** — `skills-assessment/tests/csv.test.js`

```js
import { expect, test } from 'vitest';
import { sessionToCsv } from '../src/lib/csv.js';

const session = {
  paddlers: [{ id: 'p1', name: 'Alex' }],
  skills: [{ id: 'wet-exit', category: 'Rescues', name: 'Wet Exit' }],
  results: [{ paddlerId: 'p1', skillId: 'wet-exit', rating: 'does_not_meet', feedback: 'said "help", panicked' }],
};

test('CSV has header and escaped quoted field', () => {
  const csv = sessionToCsv(session);
  const lines = csv.split('\n');
  expect(lines[0]).toBe('Paddler,Category,Skill,Rating,Feedback');
  expect(lines[1]).toBe('Alex,Rescues,Wet Exit,does_not_meet,"said ""help"", panicked"');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd skills-assessment && npx vitest run tests/csv.test.js`
Expected: FAIL — cannot resolve `../src/lib/csv.js`.

- [ ] **Step 3: Implement `skills-assessment/src/lib/csv.js`**

```js
function esc(field) {
  const s = String(field ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function sessionToCsv(session) {
  const paddlerById = new Map(session.paddlers.map(p => [p.id, p.name]));
  const skillById = new Map(session.skills.map(s => [s.id, s]));
  const rows = [['Paddler', 'Category', 'Skill', 'Rating', 'Feedback']];
  for (const r of session.results) {
    const sk = skillById.get(r.skillId) || { category: '', name: r.skillId };
    rows.push([paddlerById.get(r.paddlerId) || r.paddlerId, sk.category, sk.name, r.rating || '', r.feedback]);
  }
  return rows.map(cols => cols.map(esc).join(',')).join('\n');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd skills-assessment && npx vitest run tests/csv.test.js`
Expected: `1 passed`.

- [ ] **Step 5: Commit**

```bash
git add skills-assessment/src/lib/csv.js skills-assessment/tests/csv.test.js
git commit -m "feat: add CSV export with RFC-4180 field escaping"
```

---

### Task 7: Setup screen

**Files:**
- Create: `skills-assessment/src/screens/Setup.jsx`
- Modify: `skills-assessment/src/app.jsx` (wire routing + top-level state)

**Interfaces:**
- Consumes: `loadSkills` (skills.js), `createSession`/`saveSession`/`loadSession`/`clearSession` (session.js), `skills.json`.
- Produces: `<Setup onStart={(session) => void} />`. `app.jsx` holds `session` state and a `screen` value of `'setup'|'rate'|'review'`.

- [ ] **Step 1: Implement `skills-assessment/src/screens/Setup.jsx`**

```jsx
import { useState } from 'preact/hooks';
import rawSkills from '../data/skills.json';
import { loadSkills } from '../lib/skills.js';
import { createSession } from '../lib/session.js';

const SKILLS = loadSkills(rawSkills);

export function Setup({ onStart }) {
  const [level, setLevel] = useState('L1');
  const [location, setLocation] = useState('');
  const [names, setNames] = useState(['', '', '', '']);

  function update(i, v) { setNames(names.map((n, j) => (j === i ? v : n))); }

  function start() {
    const session = createSession({
      id: `sess-${Date.now()}`,
      createdAt: new Date().toISOString(),
      level, location, paddlerNames: names, skills: SKILLS,
    });
    if (session.paddlers.length === 0) { alert('Add at least one paddler name.'); return; }
    onStart(session);
  }

  return (
    <main style={{ padding: '1rem', maxWidth: 560, margin: '0 auto' }}>
      <h1>New Assessment</h1>
      <label>Level{' '}
        <select value={level} onChange={e => setLevel(e.currentTarget.value)}>
          <option value="L1">Level 1</option>
          <option value="L2">Level 2</option>
        </select>
      </label>
      <p><input placeholder="Location (optional)" value={location} onInput={e => setLocation(e.currentTarget.value)} style={{ width: '100%', minHeight: 44 }} /></p>
      <h2>Paddlers (up to 4)</h2>
      {names.map((n, i) => (
        <p key={i}><input placeholder={`Paddler ${i + 1}`} value={n} onInput={e => update(i, e.currentTarget.value)} style={{ width: '100%', minHeight: 44 }} /></p>
      ))}
      <button onClick={start} style={{ width: '100%', background: 'var(--exc)', color: '#fff', border: 0, borderRadius: 8 }}>Start Assessment</button>
    </main>
  );
}
```

- [ ] **Step 2: Rewrite `skills-assessment/src/app.jsx`** to route between screens and restore an in-progress session

```jsx
import { useState } from 'preact/hooks';
import { Setup } from './screens/Setup.jsx';
import { saveSession, loadSession, clearSession } from './lib/session.js';

export function App() {
  const [session, setSession] = useState(() => loadSession());
  const [screen, setScreen] = useState(() => (loadSession() ? 'rate' : 'setup'));

  function begin(s) { saveSession(s); setSession(s); setScreen('rate'); }
  function update(s) { saveSession(s); setSession(s); }
  function reset() { clearSession(); setSession(null); setScreen('setup'); }

  if (screen === 'setup' || !session) return <Setup onStart={begin} />;
  // Rate and Review screens wired in Tasks 8-9.
  return (
    <main style={{ padding: '1rem' }}>
      <p>Session for {session.paddlers.length} paddler(s), level {session.level}.</p>
      <button onClick={reset}>Start over</button>
    </main>
  );
}
```

- [ ] **Step 3: Verify manually in dev**

Run: `cd skills-assessment && npm run dev`
Expected: load the printed URL; choosing a level, typing names, and clicking **Start Assessment** advances to the placeholder session screen. Reload the page — it stays on the session (restored from localStorage). Click **Start over** — returns to setup.

- [ ] **Step 4: Verify build passes**

Run: `cd skills-assessment && npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add skills-assessment/src/screens/Setup.jsx skills-assessment/src/app.jsx
git commit -m "feat: add session setup screen with level, location, and paddler entry"
```

---

### Task 8: Rate screen (core)

**Files:**
- Create: `skills-assessment/src/screens/Rate.jsx`
- Modify: `skills-assessment/src/app.jsx` (render `Rate`), `skills-assessment/src/styles.css` (chips, rows)

**Interfaces:**
- Consumes: `getResult`, `setRating`, `setFeedback` (session.js); `resultNeedsFeedback`, `invalidResults` (validation.js).
- Produces: `<Rate session onChange={(session)=>void} onDone={()=>void} />`. One skill at a time; per-paddler chips; inline feedback on DNM; collapsible standard reference; prev/next with blocked navigation when the current skill has an unfilled DNM; a "Review" action enabled from the last skill.

- [ ] **Step 1: Add chip/row styles to `skills-assessment/src/styles.css`**

```css
.skill-head { position: sticky; top: 0; background: #fff; padding-bottom: .5rem; }
.standard { background: #f2f7f8; border-left: 4px solid var(--exc); padding: .5rem .75rem; border-radius: 6px; }
.prow { display: flex; align-items: center; gap: .5rem; margin: .5rem 0; flex-wrap: wrap; }
.pname { flex: 1 1 100%; font-weight: 600; }
.chip { flex: 1; border: 2px solid #ccc; background: #fff; border-radius: 10px; }
.chip[aria-pressed="true"][data-r="does_not_meet"] { background: var(--dnm); color: #fff; border-color: var(--dnm); }
.chip[aria-pressed="true"][data-r="meets"] { background: var(--meet); color: #fff; border-color: var(--meet); }
.chip[aria-pressed="true"][data-r="exceeds"] { background: var(--exc); color: #fff; border-color: var(--exc); }
.fb { width: 100%; min-height: 72px; font-size: 18px; border: 2px solid var(--dnm); border-radius: 8px; padding: .5rem; }
.navbar { display: flex; gap: .5rem; position: sticky; bottom: 0; background: #fff; padding: .5rem 0; }
.navbar button { flex: 1; }
.missing { color: var(--dnm); font-weight: 600; }
```

- [ ] **Step 2: Implement `skills-assessment/src/screens/Rate.jsx`**

```jsx
import { useState } from 'preact/hooks';
import { getResult, setRating, setFeedback } from '../lib/session.js';
import { resultNeedsFeedback } from '../lib/validation.js';

const RATINGS = [['does_not_meet', 'Does Not Meet'], ['meets', 'Meets'], ['exceeds', 'Exceeds']];

export function Rate({ session, onChange, onDone }) {
  const [i, setI] = useState(0);
  const [showStd, setShowStd] = useState(true);
  const skill = session.skills[i];
  const standard = skill.standard[session.level];

  const blocking = session.paddlers.some(p => resultNeedsFeedback(getResult(session, p.id, skill.id)));

  function rate(pid, rating) { onChange(setRating(session, pid, skill.id, rating)); }
  function feedback(pid, v) { onChange(setFeedback(session, pid, skill.id, v)); }
  function go(delta) { if (blocking) return; setI(Math.min(session.skills.length - 1, Math.max(0, i + delta))); }

  const ratedCount = session.skills.filter(sk =>
    session.paddlers.every(p => getResult(session, p.id, sk.id).rating !== null)).length;

  return (
    <main style={{ padding: '1rem', maxWidth: 640, margin: '0 auto' }}>
      <div class="skill-head">
        <small>{skill.category} · Skill {i + 1}/{session.skills.length} · {ratedCount} fully rated</small>
        <h2 style={{ margin: '.25rem 0' }}>{skill.name}</h2>
        {standard && (
          <div class="standard">
            <button onClick={() => setShowStd(!showStd)} style={{ float: 'right', border: 0, background: 'none' }}>{showStd ? 'Hide' : 'Show'}</button>
            <strong>{session.level} standard</strong>
            {showStd && <div>{standard}</div>}
          </div>
        )}
      </div>

      {session.paddlers.map(p => {
        const r = getResult(session, p.id, skill.id);
        return (
          <div class="prow" key={p.id}>
            <div class="pname">{p.name}</div>
            {RATINGS.map(([val, label]) => (
              <button class="chip" data-r={val} aria-pressed={r.rating === val} onClick={() => rate(p.id, val)} key={val}>{label}</button>
            ))}
            {r.rating === 'does_not_meet' && (
              <textarea class="fb" placeholder="Required: what did not meet the standard? (tap keyboard mic to dictate)"
                value={r.feedback} onInput={e => feedback(p.id, e.currentTarget.value)} />
            )}
          </div>
        );
      })}

      {blocking && <p class="missing">Feedback is required for each “Does Not Meet” before moving on.</p>}

      <div class="navbar">
        <button onClick={() => go(-1)} disabled={i === 0 || blocking}>◀ Prev</button>
        {i < session.skills.length - 1
          ? <button onClick={() => go(1)} disabled={blocking}>Next ▶</button>
          : <button onClick={() => { if (!blocking) onDone(); }} disabled={blocking} style={{ background: 'var(--exc)', color: '#fff', border: 0 }}>Review ▶</button>}
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Wire `Rate` into `skills-assessment/src/app.jsx`**

Replace the placeholder session block so `screen === 'rate'` renders `Rate`:

```jsx
import { useState } from 'preact/hooks';
import { Setup } from './screens/Setup.jsx';
import { Rate } from './screens/Rate.jsx';
import { saveSession, loadSession, clearSession } from './lib/session.js';

export function App() {
  const [session, setSession] = useState(() => loadSession());
  const [screen, setScreen] = useState(() => (loadSession() ? 'rate' : 'setup'));

  function begin(s) { saveSession(s); setSession(s); setScreen('rate'); }
  function update(s) { saveSession(s); setSession(s); }

  if (screen === 'setup' || !session) return <Setup onStart={begin} />;
  if (screen === 'rate') return <Rate session={session} onChange={update} onDone={() => setScreen('review')} />;
  return (
    <main style={{ padding: '1rem' }}>
      <p>Review screen arrives in Task 9.</p>
      <button onClick={() => setScreen('rate')}>◀ Back to rating</button>
    </main>
  );
}
```

- [ ] **Step 4: Manual verification in dev**

Run: `cd skills-assessment && npm run dev`
Expected: start a 2-paddler L1 session. For a skill, tap **Does Not Meet** for one paddler — a required feedback box appears. **Next** is disabled and the red message shows until you type feedback. Fill it — **Next** re-enables. The standard box shows the L1 text and collapses/expands. Reach the last skill — the button reads **Review**.

- [ ] **Step 5: Verify build passes**

Run: `cd skills-assessment && npm run build`
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add skills-assessment/src/screens/Rate.jsx skills-assessment/src/app.jsx skills-assessment/src/styles.css
git commit -m "feat: add core rate screen with per-paddler chips, standard reference, and enforced feedback"
```

---

### Task 9: Review screen + PDF export

**Files:**
- Create: `skills-assessment/src/lib/pdf.js`, `skills-assessment/src/screens/Review.jsx`
- Modify: `skills-assessment/src/app.jsx` (render `Review`)

**Interfaces:**
- Consumes: `paddlerSummary` (summary.js), `sessionToCsv` (csv.js), `invalidResults`/`isSessionComplete` (validation.js), jsPDF.
- Produces:
  - `downloadPaddlerPdf(session, paddlerId): void` — builds and triggers download of a per-paddler PDF.
  - `<Review session onBack={()=>void} />` — per-paddler summaries, PDF button per paddler, one CSV download button, and (Task 10) Sync button.

- [ ] **Step 1: Implement `skills-assessment/src/lib/pdf.js`**

```js
import { jsPDF } from 'jspdf';
import { paddlerSummary } from './summary.js';

export function downloadPaddlerPdf(session, paddlerId) {
  const s = paddlerSummary(session, paddlerId);
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  let y = 56;
  const line = (t, dy = 18, size = 11) => { doc.setFontSize(size); doc.text(String(t), 48, y); y += dy; };
  line(`ACA ${session.level} Assessment — ${s.name}`, 26, 16);
  line(`Date: ${new Date(session.createdAt).toLocaleString()}${session.location ? ' · ' + session.location : ''}`);
  line(`Meets: ${s.met}   Exceeds: ${s.exceeds}   Does Not Meet: ${s.notMet}   Unrated: ${s.unrated}`, 24);
  line('Skills that did not meet the standard:', 22, 13);
  if (s.notMetItems.length === 0) line('None — all assessed skills met or exceeded.', 18);
  for (const item of s.notMetItems) {
    line(`• ${item.name} (${item.category})`, 18, 12);
    for (const chunk of doc.splitTextToSize(item.feedback || '(no feedback)', 480)) {
      doc.setFontSize(11); doc.text(chunk, 64, y); y += 16;
      if (y > 720) { doc.addPage(); y = 56; }
    }
    y += 4;
    if (y > 720) { doc.addPage(); y = 56; }
  }
  const safe = s.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'paddler';
  doc.save(`aca-${session.level}-${safe}.pdf`);
}
```

- [ ] **Step 2: Implement `skills-assessment/src/screens/Review.jsx`**

```jsx
import { paddlerSummary } from '../lib/summary.js';
import { sessionToCsv } from '../lib/csv.js';
import { isSessionComplete, invalidResults } from '../lib/validation.js';
import { downloadPaddlerPdf } from '../lib/pdf.js';

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

export function Review({ session, onBack }) {
  const problems = invalidResults(session).length;
  return (
    <main style={{ padding: '1rem', maxWidth: 640, margin: '0 auto' }}>
      <h1>Review — {session.level}</h1>
      {problems > 0 && <p class="missing">{problems} “Does Not Meet” still need feedback. Go back to fix before exporting.</p>}
      {!isSessionComplete(session) && problems === 0 && <p>Some skills are still unrated.</p>}

      {session.paddlers.map(p => {
        const s = paddlerSummary(session, p.id);
        return (
          <section key={p.id} style={{ border: '1px solid #ddd', borderRadius: 8, padding: '.75rem', margin: '.75rem 0' }}>
            <h2 style={{ margin: '.25rem 0' }}>{s.name}</h2>
            <p>Meets {s.met} · Exceeds {s.exceeds} · <span class="missing">Does Not Meet {s.notMet}</span> · Unrated {s.unrated}</p>
            {s.notMetItems.length > 0 && (
              <ul>{s.notMetItems.map(it => <li key={it.skillId}><strong>{it.name}</strong>: {it.feedback}</li>)}</ul>
            )}
            <button onClick={() => downloadPaddlerPdf(session, p.id)}>Download {s.name}'s PDF</button>
          </section>
        );
      })}

      <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
        <button onClick={onBack}>◀ Back to rating</button>
        <button onClick={() => download(`aca-${session.level}-${session.id}.csv`, sessionToCsv(session), 'text/csv')}>Download CSV (all)</button>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Render `Review` in `skills-assessment/src/app.jsx`**

Replace the Task-8 placeholder review block:

```jsx
import { Review } from './screens/Review.jsx';
// ...
  if (screen === 'review') return <Review session={session} onBack={() => setScreen('rate')} />;
```

- [ ] **Step 4: Manual verification in dev**

Run: `cd skills-assessment && npm run dev`
Expected: complete a session, reach **Review**. Each paddler card shows tallies and its DNM list. Click a paddler PDF button — a PDF downloads with the name, date, counts, and DNM feedback. Click **Download CSV** — a CSV downloads with all rows.

- [ ] **Step 5: Verify build passes**

Run: `cd skills-assessment && npm run build`
Expected: build succeeds (jsPDF bundled).

- [ ] **Step 6: Commit**

```bash
git add skills-assessment/src/lib/pdf.js skills-assessment/src/screens/Review.jsx skills-assessment/src/app.jsx
git commit -m "feat: add review screen with per-paddler summaries, PDF, and CSV export"
```

---

### Task 10: Sync to Pi (client)

**Files:**
- Create: `skills-assessment/src/lib/sync.js`
- Modify: `skills-assessment/src/screens/Review.jsx` (Sync button + status)

**Interfaces:**
- Consumes: `Session`.
- Produces: `syncSession(session, baseUrl): Promise<{ ok: boolean, syncedAt?: string, error?: string }>` — `POST ${baseUrl}/sync` with the session JSON. Resolves (never rejects) so the UI can show a friendly retry message offline.

- [ ] **Step 1: Implement `skills-assessment/src/lib/sync.js`**

```js
// Base URL of the Pi's sync endpoint (its tailscale-serve HTTPS host).
// Empty string means "same origin as the app" (works when hosted on the Pi).
export const SYNC_BASE = '';

export async function syncSession(session, baseUrl = SYNC_BASE) {
  try {
    const res = await fetch(`${baseUrl}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(session),
    });
    if (!res.ok) return { ok: false, error: `Server responded ${res.status}` };
    const data = await res.json().catch(() => ({}));
    return { ok: true, syncedAt: data.syncedAt || new Date().toISOString() };
  } catch (e) {
    return { ok: false, error: 'Could not reach the Pi (are you on the tailnet?)' };
  }
}
```

- [ ] **Step 2: Add Sync button + status to `skills-assessment/src/screens/Review.jsx`**

Add the import and a small status state, and a button next to CSV:

```jsx
import { useState } from 'preact/hooks';
import { syncSession } from '../lib/sync.js';
// inside Review(), before return:
  const [sync, setSync] = useState({ state: 'idle', msg: '' });
  async function doSync() {
    setSync({ state: 'busy', msg: 'Syncing…' });
    const r = await syncSession(session);
    setSync(r.ok ? { state: 'ok', msg: `Synced ${new Date(r.syncedAt).toLocaleTimeString()}` } : { state: 'err', msg: r.error });
  }
```

Add inside the button row:

```jsx
        <button onClick={doSync} disabled={sync.state === 'busy'}>Sync to Pi</button>
```

And below the row:

```jsx
      {sync.msg && <p class={sync.state === 'err' ? 'missing' : ''}>{sync.msg}</p>}
```

- [ ] **Step 3: Manual verification (offline path)**

Run: `cd skills-assessment && npm run dev`
Expected: on Review, click **Sync to Pi** with no Pi running — status shows the friendly "Could not reach the Pi" message and nothing crashes. (The success path is verified in Task 12.)

- [ ] **Step 4: Commit**

```bash
git add skills-assessment/src/lib/sync.js skills-assessment/src/screens/Review.jsx
git commit -m "feat: add graceful Pi sync from the review screen"
```

---

### Task 11: PWA / offline packaging

**Files:**
- Modify: `skills-assessment/vite.config.js`
- Create: `skills-assessment/public/icons/icon-192.png`, `icon-512.png`, `icon-maskable-512.png` (any OWN-branded square PNGs; solid-color placeholders acceptable for Thursday)

**Interfaces:**
- Produces: an installable, offline-capable build. No new JS API.

- [ ] **Step 1: Add the PWA plugin to `skills-assessment/vite.config.js`**

```js
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'ACA Skills Assessment',
        short_name: 'ACA Assess',
        description: 'Offline coastal kayaking L1/L2 skills assessment',
        theme_color: '#005f6b',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,json,png,svg,woff2}'] },
    }),
  ],
  test: { environment: 'node' },
});
```

- [ ] **Step 2: Add placeholder icons**

Create three square PNGs (192, 512, 512-maskable) in `public/icons/`. A solid `#005f6b` square with white "ACA" text is fine for Thursday; swap real OWN branding later.
Run: `cd skills-assessment && ls public/icons`
Expected: the three PNG files are listed.

- [ ] **Step 3: Build and verify the service worker is generated**

Run: `cd skills-assessment && npm run build`
Expected: build output lists `sw.js` and `manifest.webmanifest` (or `workbox-*`), and `dist/` contains `sw.js`.

- [ ] **Step 4: Offline dress rehearsal (acceptance gate — do on a phone before Thursday)**

Run: `cd skills-assessment && npm run preview -- --host`
Then on the phone (same LAN or tailnet): open the printed URL, **Add to Home Screen**, launch from the home-screen icon, enable **airplane mode**, and run a full 4-paddler mock session: rate skills, dictate a DNM feedback with the keyboard mic, reach Review, export a PDF and the CSV. All must work with the network off.
Expected: app launches offline; PDF/CSV export succeed offline.

- [ ] **Step 5: Commit**

```bash
git add skills-assessment/vite.config.js skills-assessment/public/icons
git commit -m "feat: make the app an installable, offline-first PWA"
```

---

### Task 12: Raspberry Pi sync server + hosting docs

**Files:**
- Create: `skills-assessment/pi/sync-server.mjs`, `skills-assessment/pi/README.md`

**Interfaces:**
- Consumes: the client `POST /sync` payload (a `Session`).
- Produces: a Node server writing `pi/sessions/<id>.json` and responding `{ syncedAt }`. Serves the built app statically at `/` so the app and sync share an origin (matches `SYNC_BASE = ''`).

- [ ] **Step 1: Implement `skills-assessment/pi/sync-server.mjs`**

```js
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const PORT = process.env.PORT || 8787;
const DIST = new URL('../dist/', import.meta.url).pathname;
const SESSIONS = new URL('./sessions/', import.meta.url).pathname;
await mkdir(SESSIONS, { recursive: true });

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };

function body(req) {
  return new Promise((res, rej) => { let d = ''; req.on('data', c => (d += c)); req.on('end', () => res(d)); req.on('error', rej); });
}

const server = createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/sync') {
    try {
      const session = JSON.parse(await body(req));
      if (!session || typeof session.id !== 'string' || !Array.isArray(session.results)) throw new Error('bad payload');
      const safe = session.id.replace(/[^a-z0-9\-_]/gi, '_');
      await writeFile(join(SESSIONS, `${safe}.json`), JSON.stringify(session, null, 2));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ syncedAt: new Date().toISOString() }));
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: String(e.message || e) }));
    }
  }
  // static file serving from dist/
  const rel = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  let file = join(DIST, rel === '/' ? 'index.html' : rel);
  try {
    let data;
    try { data = await readFile(file); }
    catch { data = await readFile(join(DIST, 'index.html')); file = 'index.html'; } // SPA fallback
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404); res.end('Not found');
  }
});

server.listen(PORT, () => console.log(`ACA assessment server on :${PORT}`));
```

- [ ] **Step 2: Write `skills-assessment/pi/README.md`**

````markdown
# Raspberry Pi hosting + sync

## Prerequisites
- Node ≥ 20 on the Pi
- Tailscale installed and logged in (`tailscale status` works)

## Build the app (on the Pi, or copy a built `dist/` over)
```bash
cd skills-assessment
npm install
npm run build      # creates dist/
```

## Run the server
```bash
node pi/sync-server.mjs        # serves dist/ and accepts POST /sync on :8787
```
Synced sessions are written to `pi/sessions/<session-id>.json`.

## Expose over Tailscale HTTPS (required for the PWA service worker)
```bash
tailscale serve --https=443 http://localhost:8787
tailscale serve status        # shows https://<pi-name>.<tailnet>.ts.net
```
Open that HTTPS URL on your phone, then **Add to Home Screen**. Because the app
and `/sync` share this origin, the in-app **Sync to Pi** button works with the
default `SYNC_BASE = ''`.

## Optional: run on boot
Create a systemd service running `node pi/sync-server.mjs`, plus
`tailscale serve` as configured above.
````

- [ ] **Step 3: Local end-to-end verification (stand-in for the Pi)**

Run:
```bash
cd skills-assessment && npm run build && node pi/sync-server.mjs
```
In another terminal:
```bash
curl -s -X POST localhost:8787/sync -H 'Content-Type: application/json' \
  -d '{"id":"test-1","createdAt":"2026-07-09T12:00:00Z","level":"L1","paddlers":[],"skills":[],"results":[]}'
```
Expected: response `{"syncedAt":"..."}`, and `skills-assessment/pi/sessions/test-1.json` exists with the payload. Also open `http://localhost:8787/` — the app loads.

- [ ] **Step 4: Verify bad payloads are rejected**

Run: `curl -s -X POST localhost:8787/sync -H 'Content-Type: application/json' -d '{"nope":true}'`
Expected: HTTP 400 with `{"error":"bad payload"}`; no file written.

- [ ] **Step 5: Add `sessions/` to gitignore and commit**

```bash
cd skills-assessment && printf 'node_modules/\ndist/\npi/sessions/\n' > .gitignore
git add skills-assessment/pi/sync-server.mjs skills-assessment/pi/README.md skills-assessment/.gitignore
git commit -m "feat: add Pi sync server and Tailscale hosting docs"
```

---

## Self-Review

**Spec coverage:**
- Offline-first PWA → Task 11. Data model (Skill/Paddler/SkillResult/Session) → Tasks 2–3. Editable `skills.json` with per-level `standard` → Task 2. DNM-requires-feedback invariant → Task 4, enforced in UI Task 8. Native dictation → plain `<textarea>` in Task 8 (no code needed beyond the field). By-skill rate layout with standard reference → Task 8. Start/Rate/Review flow → Tasks 7/8/9. On-screen summary + PDF + CSV → Tasks 5/6/9. Sync to Pi (graceful offline) → Tasks 10/12. Pi hosting via `tailscale serve` → Task 12. Autosave/resume → Tasks 3/7. Testing (invariant, CSV, summary, skills, session) → Tasks 2–6. Offline dress rehearsal → Task 11 Step 4. All spec sections covered.
- Deferred by design (spec "Open Items"): Ken corrects skill list + real `standard` text; confirms Pi hostname; one-level-per-session default. These are data/ops, not code gaps.

**Placeholder scan:** No "TBD/TODO" logic. The `[VERIFY]` markers in `skills.json` and the placeholder icons are intentional, spec-sanctioned data the plan calls out explicitly.

**Type consistency:** Rating strings, `SkillResult`/`Session` shapes, and function names (`createSession`, `getResult`, `setRating`, `setFeedback`, `skillsForLevel`, `resultNeedsFeedback`, `invalidResults`, `isSessionComplete`, `paddlerSummary`, `sessionToCsv`, `downloadPaddlerPdf`, `syncSession`) are used identically across tasks. `SYNC_BASE=''` matches the shared-origin hosting in Task 12.
