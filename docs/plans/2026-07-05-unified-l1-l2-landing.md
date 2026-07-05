# Unified L1/L2 Per-Candidate Assessment with Landing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the per-level assessment core with a unified per-candidate model: each paddler targets L1 or L2, one combined interleaved skill list, an "L1" fallback tier on dual L2 skills, and a computed per-candidate landing (L2 / L1 / did-not-meet-L1 / pending).

**Architecture:** v3 `skills.json` = `{ scales, skills[] }` (flat, ordered, each skill tagged `level`; dual L2 skills carry `l1Standard`). Pure lib modules do all logic (loader, session, validation, landing, summary, csv) and are unit-tested; Preact screens are thin views. The Pi teaching-lessons + past-assessments features are untouched except a backward-compat shim for old (v2) archived sessions.

**Tech Stack:** Vite + Preact, Vitest, Node `http` server (unchanged), pandoc (unchanged).

## Global Constraints

- Node ≥ 22, ES modules. No new runtime deps. Work in the repo root of `kenbolton/aca-skills-assessment`; tests via `npm test`, builds via `npm run build`.
- Rating scales are exactly: L1 `no`(feedback)/`pass`/`dno`; L2 `below`(feedback)/`l1`(feedback, dualOnly)/`meets`/`exceeds`.
- A candidate is rated **only** on skills where `skill.level === paddler.target`.
- Feedback required whenever the chosen option has `requiresFeedback` (`no`, `below`, `l1`). Optional skills never require feedback.
- Landing rules (verbatim from the spec): L1 target → `L1` if all core `pass`, else `did_not_meet_L1`. L2 target → `L2` if all core `meets`/`exceeds`; else `L1` if no dual skill is `below`; else `did_not_meet_L1`. Any unrated core result (or `dno` for L1) → `pending`.
- localStorage key stays `aca-assessment:session`. Private-only UI still gated by `VITE_PRIVATE`.
- This replaces the v2 flow; old archived sessions on the Pi are NOT migrated — the `/sessions` listing must degrade gracefully for them.

---

## File Structure

- `tools/build-skills-v3.mjs` (new, one-shot transform) → rewrites `src/data/skills.json` to v3.
- `src/lib/skills.js` — v3 `loadConfig` + `optionsForSkill` + helpers.
- `src/lib/session.js` — v3 `createSession` (per-paddler target), `setRating`/`setFeedback`, `optionsForSkill` usage.
- `src/lib/validation.js` — option-driven feedback (incl. `l1`).
- `src/lib/landing.js` (new) — `landingFor`.
- `src/lib/summary.js` — v3 per-paddler summary incl. landing + breakdown.
- `src/lib/session-summary.js` — v3 + v2 backward-compat for the `/sessions` list.
- `src/lib/csv.js` — add `Target`, `Landing`.
- `src/lib/pdf.js` — add target + landing.
- `src/screens/Setup.jsx` — per-paddler target selector.
- `src/screens/Rate.jsx` — combined list filtered per target, per-skill options, dual standards.
- `src/screens/Review.jsx` — landing display.
- `src/app.jsx` — discard a v2-shaped stored session on load.

---

### Task 1: Transform `skills.json` to v3

**Files:**
- Create: `tools/build-skills-v3.mjs`
- Modify (generated): `src/data/skills.json`

**Interfaces:**
- Produces v3 `src/data/skills.json`: `{ scales: {L1:[...],L2:[...]}, skills: [{id, level, category, name, standard, l1Standard?, optional}] }`.

- [ ] **Step 1: Create `tools/build-skills-v3.mjs`**

```js
// One-shot: transform the v2 skills.json ({levels:[...]}) into v3
// ({scales, skills[]}). Flattens both levels into one progressively-ordered
// list, tags each skill with its level, adds the L2 'l1' scale option, and
// attaches l1Standard (the referenced L1 skill's standard) to dual L2 skills.
import { readFile, writeFile } from 'node:fs/promises';
const PATH = new URL('../src/data/skills.json', import.meta.url).pathname;
const v2 = JSON.parse(await readFile(PATH, 'utf8'));

const L1 = v2.levels.find(l => l.id === 'L1');
const L2 = v2.levels.find(l => l.id === 'L2');

// scales: L1 unchanged; L2 gains the dual-only 'l1' tier after 'below'.
const scales = {
  L1: L1.scale.map(o => ({ ...o, requiresFeedback: !!o.requiresFeedback })),
  L2: [
    { value: 'below', label: 'Below', requiresFeedback: true },
    { value: 'l1', label: 'L1', requiresFeedback: true, dualOnly: true },
    { value: 'meets', label: 'Meets', requiresFeedback: false },
    { value: 'exceeds', label: 'Exceeds', requiresFeedback: false },
  ],
};

// dual L2 skill id -> equivalent L1 skill id (its standard becomes l1Standard).
const DUAL_MAP = {
  'l2-forward': 'l1-forward-straight', 'l2-reverse': 'l1-reverse', 'l2-stopping': 'l1-stop',
  'l2-draw': 'l1-draw', 'l2-sweep': 'l1-turn-stationary', 'l2-turning-move': 'l1-turn-moving',
  'l2-rotate-360': 'l1-turn-stationary', 'l2-wet-exit': 'l1-wet-exit',
  'l2-assisted-rescue': 'l1-reentry', 'l2-self-rescue': 'l1-reentry',
  'l2-swim-rescue': 'l1-swim-with-gear', 'l2-swimmer-tows': 'l1-swimmer-tow',
  'l2-move-capsized': 'l1-bulldozing', 'l2-launch-land': 'l1-launch',
  'l2-lift-carry': 'l1-lift-carry', 'l2-secure-rack': 'l1-secure-transport',
  'l2-float-plan': 'l1-float-plan', 'l2-cold-water-shock': 'l1-cold-water',
  'l2-thermal': 'l1-cold-water', 'l2-equipment': 'l1-equipment',
  'l2-nautical-rules': 'l1-nav-rules', 'l2-awareness': 'l1-group-awareness',
  'l2-signaling': 'l1-signals', 'l2-forecasts': 'l1-weather-hazards',
};

// index every skill by id (for l1Standard lookup) and by (level,category).
const byId = {};
const catSkills = { L1: {}, L2: {} };
for (const [lvl, L] of [['L1', L1], ['L2', L2]]) {
  for (const c of L.categories) {
    catSkills[lvl][c.name] = c.skills;
    for (const s of c.skills) byId[s.id] = s;
  }
}

// interleaved dry -> wet themes; within each, L1 categories then L2 categories.
const THEMES = [
  { L1: ['Preparing to Depart'], L2: ['Core: Incident Prevention and Management'] },
  { L1: ['Maneuvers & Strokes'], L2: ['Core: Strokes', 'Core: Maneuvers', 'Core: Edging and Support'] },
  { L1: ['Technical Knowledge'], L2: ['Core: Awareness and Seamanship', 'Core: Trip Planning and Navigation'] },
  { L1: ['Safety and Rescue', 'Swimming and Wading Skills'], L2: [] },
  { L1: ['Kayak-based Rescues'], L2: ['Core: Rescues and Towing'] },
  { L1: [], L2: ['Venue (Developing): Currents', 'Venue (Developing): Wind and Waves', 'Venue (Developing): Rocky Shorelines'] },
];

const skills = [];
const emit = (lvl, s) => {
  const out = { id: s.id, level: lvl, category: s.category, name: s.name,
    standard: s.standard, optional: !!s.optional };
  if (lvl === 'L2' && DUAL_MAP[s.id] && byId[DUAL_MAP[s.id]]) out.l1Standard = byId[DUAL_MAP[s.id]].standard;
  skills.push(out);
};
for (const t of THEMES) {
  for (const cat of t.L1) for (const s of (catSkills.L1[cat] || [])) emit('L1', s);
  for (const cat of t.L2) for (const s of (catSkills.L2[cat] || [])) emit('L2', s);
}

await writeFile(PATH, JSON.stringify({ scales, skills }, null, 2) + '\n');
console.log(`v3 skills.json: ${skills.length} skills (${skills.filter(s => s.level === 'L1').length} L1, ${skills.filter(s => s.level === 'L2').length} L2, ${skills.filter(s => s.l1Standard).length} dual)`);
```

- [ ] **Step 2: Run the transform**

Run: `node tools/build-skills-v3.mjs`
Expected: prints e.g. `v3 skills.json: 98 skills (43 L1, 55 L2, 24 dual)` (43 L1 core; L2 = 36 core + 19 optional = 55; ~24 dual). Every L1 core skill appears; every L2 core+optional appears.

- [ ] **Step 3: Sanity-check the output**

Run:
```bash
node -e "const d=require('./src/data/skills.json'); const c=d.skills.filter(s=>!s.optional); console.log('L1 core', c.filter(s=>s.level==='L1').length, '| L2 core', c.filter(s=>s.level==='L2').length, '| dual', d.skills.filter(s=>s.l1Standard).length, '| scales', Object.keys(d.scales)); console.log('has l1 tier:', d.scales.L2.some(o=>o.value==='l1'&&o.dualOnly));"
```
Expected: `L1 core 43 | L2 core 36 | dual 24 | scales [ 'L1', 'L2' ]` and `has l1 tier: true`.

- [ ] **Step 4: Commit**

```bash
git add tools/build-skills-v3.mjs src/data/skills.json
git commit -m "feat: v3 skills.json — unified scales + flat interleaved skills with l1Standard duals"
```

---

### Task 2: `skills.js` v3 — loader + `optionsForSkill`

**Files:**
- Modify: `src/lib/skills.js` (full rewrite)
- Modify: `tests/skills.test.js` (replace v2 tests)

**Interfaces:**
- Produces:
  - `loadConfig(raw): Config` where `Config = { scales: {L1,L2}, skills: Skill[] }`. Validates: `scales.L1`/`scales.L2` non-empty arrays of `{value,label,requiresFeedback}`; `skills` non-empty; each skill has `id`(unique), `level`∈{L1,L2}, `category`, `name`, `standard`; normalizes `optional`→bool and `dualOnly`→bool. Throws `Error` on bad shape.
  - `allSkills(config): Skill[]` — `config.skills`.
  - `optionsForSkill(config, skill): ScaleOption[]` — `skill.level==='L1'` → `scales.L1`; `level==='L2'` without `l1Standard` → `scales.L2` filtered to drop `dualOnly` options; `level==='L2'` with `l1Standard` → full `scales.L2`.

- [ ] **Step 1: Write the failing test** — replace `tests/skills.test.js`

```js
import { expect, test } from 'vitest';
import { loadConfig, allSkills, optionsForSkill } from '../src/lib/skills.js';
import raw from '../src/data/skills.json';

const cfg = loadConfig(raw);

test('loadConfig accepts the real v3 data', () => {
  expect(cfg.scales.L1.length).toBeGreaterThan(0);
  expect(cfg.scales.L2.some(o => o.value === 'l1' && o.dualOnly)).toBe(true);
  expect(allSkills(cfg).length).toBeGreaterThan(50);
});

test('loadConfig rejects a skill with a bad level', () => {
  expect(() => loadConfig({ scales: raw.scales, skills: [{ id: 'x', level: 'L3', category: 'c', name: 'n', standard: 's' }] }))
    .toThrow(/level/i);
});

test('optionsForSkill: L1 skill -> L1 scale', () => {
  const s = allSkills(cfg).find(s => s.level === 'L1');
  expect(optionsForSkill(cfg, s).map(o => o.value)).toEqual(['no', 'pass', 'dno']);
});

test('optionsForSkill: dual L2 skill -> Below/L1/Meets/Exceeds', () => {
  const s = allSkills(cfg).find(s => s.level === 'L2' && s.l1Standard);
  expect(optionsForSkill(cfg, s).map(o => o.value)).toEqual(['below', 'l1', 'meets', 'exceeds']);
});

test('optionsForSkill: L2-only skill drops the dualOnly l1 tier', () => {
  const s = allSkills(cfg).find(s => s.level === 'L2' && !s.l1Standard);
  expect(optionsForSkill(cfg, s).map(o => o.value)).toEqual(['below', 'meets', 'exceeds']);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/skills.test.js`
Expected: FAIL — `allSkills`/`optionsForSkill` not exported (v2 exports differ).

- [ ] **Step 3: Rewrite `src/lib/skills.js`**

```js
const LEVELS = ['L1', 'L2'];

function normOption(o, ctx) {
  if (!o || typeof o.value !== 'string' || typeof o.label !== 'string') throw new Error(`bad scale option in ${ctx}`);
  return { value: o.value, label: o.label, requiresFeedback: !!o.requiresFeedback, dualOnly: !!o.dualOnly };
}

export function loadConfig(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('skills.json must be an object');
  const scales = {};
  for (const lvl of LEVELS) {
    const arr = raw.scales && raw.scales[lvl];
    if (!Array.isArray(arr) || arr.length === 0) throw new Error(`scales.${lvl} must be a non-empty array`);
    scales[lvl] = arr.map((o, i) => normOption(o, `scales.${lvl}[${i}]`));
  }
  if (!Array.isArray(raw.skills) || raw.skills.length === 0) throw new Error('skills must be a non-empty array');
  const seen = new Set();
  const skills = raw.skills.map((s, i) => {
    if (!s || typeof s.id !== 'string' || !s.id) throw new Error(`skill[${i}] missing id`);
    if (seen.has(s.id)) throw new Error(`duplicate skill id ${s.id}`);
    seen.add(s.id);
    if (!LEVELS.includes(s.level)) throw new Error(`skill ${s.id} has invalid level ${s.level}`);
    for (const f of ['category', 'name', 'standard']) if (typeof s[f] !== 'string' || !s[f]) throw new Error(`skill ${s.id} missing ${f}`);
    const out = { id: s.id, level: s.level, category: s.category, name: s.name, standard: s.standard, optional: !!s.optional };
    if (typeof s.l1Standard === 'string' && s.l1Standard) out.l1Standard = s.l1Standard;
    return out;
  });
  return { scales, skills };
}

export function allSkills(config) {
  return config.skills;
}

export function optionsForSkill(config, skill) {
  const scale = config.scales[skill.level] || [];
  if (skill.level === 'L2' && !skill.l1Standard) return scale.filter(o => !o.dualOnly);
  return scale;
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run tests/skills.test.js`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/skills.js tests/skills.test.js
git commit -m "feat: v3 skills loader with per-skill option resolution"
```

---

### Task 3: `session.js` v3 — per-candidate targets

**Files:**
- Modify: `src/lib/session.js` (rewrite the model bits; keep localStorage helpers)
- Modify: `tests/session.test.js` (replace v2 tests)

**Interfaces:**
- Consumes: `allSkills`, `optionsForSkill` from `skills.js`.
- Produces:
  - `createSession({ id, createdAt, config, location = '', paddlers })` where `paddlers` is `[{ name, target }]`. Builds `session = { id, createdAt, location, scales, paddlers:[{id,name,target}], skills: config.skills, results }`. `results` = one `{paddlerId, skillId, rating:null, feedback:''}` per (paddler × skill where `skill.level === paddler.target`). Paddlers with a blank name are dropped.
  - `getResult(session, paddlerId, skillId)`, `skillById(session, skillId)`.
  - `optionsForSkillInSession(session, skill)` — same rule as `optionsForSkill` but reads `session.scales`.
  - `optionFor(session, skill, rating)` — the option object for a rating within a skill's option set (or undefined).
  - `setRating(session, paddlerId, skillId, rating)` — new session; clears feedback to `''` unless the new rating's option has `requiresFeedback`.
  - `setFeedback(...)`; `saveSession/loadSession/clearSession` (unchanged, key `aca-assessment:session`).

- [ ] **Step 1: Write the failing test** — replace `tests/session.test.js`

```js
import { expect, test, beforeEach } from 'vitest';
import { createSession, getResult, setRating, setFeedback, optionFor, saveSession, loadSession, clearSession } from '../src/lib/session.js';

beforeEach(() => {
  const store = new Map();
  globalThis.localStorage = { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
});

const cfg = {
  scales: {
    L1: [{ value: 'no', label: 'No', requiresFeedback: true }, { value: 'pass', label: 'Pass', requiresFeedback: false }, { value: 'dno', label: 'DNO', requiresFeedback: false }],
    L2: [{ value: 'below', label: 'Below', requiresFeedback: true }, { value: 'l1', label: 'L1', requiresFeedback: true, dualOnly: true }, { value: 'meets', label: 'Meets', requiresFeedback: false }, { value: 'exceeds', label: 'Exceeds', requiresFeedback: false }],
  },
  skills: [
    { id: 'a1', level: 'L1', category: 'c', name: 'A1', standard: 's', optional: false },
    { id: 'b1', level: 'L2', category: 'c', name: 'B1', standard: 's', optional: false, l1Standard: 'l1 std' },
    { id: 'b2', level: 'L2', category: 'c', name: 'B2', standard: 's', optional: false },
  ],
};

function base() {
  return createSession({ id: 's1', createdAt: 't', config: cfg, paddlers: [{ name: 'Alex', target: 'L2' }, { name: 'Sam', target: 'L1' }] });
}

test('createSession rates each paddler only on their target level', () => {
  const s = base();
  const alex = s.paddlers[0].id, sam = s.paddlers[1].id;
  // Alex (L2) -> b1,b2 ; Sam (L1) -> a1
  expect(s.results.filter(r => r.paddlerId === alex).map(r => r.skillId).sort()).toEqual(['b1', 'b2']);
  expect(s.results.filter(r => r.paddlerId === sam).map(r => r.skillId)).toEqual(['a1']);
});

test('setRating clears feedback unless the option requires it', () => {
  let s = base();
  const alex = s.paddlers[0].id;
  s = setRating(s, alex, 'b1', 'l1');           // l1 requires feedback -> keep
  s = setFeedback(s, alex, 'b1', 'met L1 only');
  expect(getResult(s, alex, 'b1').feedback).toBe('met L1 only');
  s = setRating(s, alex, 'b1', 'meets');         // meets -> clear
  expect(getResult(s, alex, 'b1').feedback).toBe('');
});

test('optionFor resolves within a skill option set (l1 only on dual)', () => {
  const s = base();
  const b1 = s.skills.find(x => x.id === 'b1'), b2 = s.skills.find(x => x.id === 'b2');
  expect(optionFor(s, b1, 'l1').requiresFeedback).toBe(true);
  expect(optionFor(s, b2, 'l1')).toBeUndefined();   // l1 not available on L2-only
});

test('save/load/clear round-trips', () => {
  saveSession(base()); expect(loadSession().id).toBe('s1'); clearSession(); expect(loadSession()).toBeNull();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/session.test.js`
Expected: FAIL (v2 `createSession` signature/behavior differ).

- [ ] **Step 3: Rewrite `src/lib/session.js`**

```js
import { optionsForSkill } from './skills.js';

const KEY = 'aca-assessment:session';
let seq = 0;
function pid() { return `p${++seq}`; }

export function createSession({ id, createdAt, config, location = '', paddlers }) {
  const people = paddlers.map(p => ({ name: (p.name || '').trim(), target: p.target })).filter(p => p.name);
  const withIds = people.map(p => ({ id: pid(), name: p.name, target: p.target }));
  const results = [];
  for (const p of withIds) {
    for (const sk of config.skills) {
      if (sk.level === p.target) results.push({ paddlerId: p.id, skillId: sk.id, rating: null, feedback: '' });
    }
  }
  return { id, createdAt, location, scales: config.scales, paddlers: withIds, skills: config.skills, results };
}

export function getResult(session, paddlerId, skillId) {
  return session.results.find(r => r.paddlerId === paddlerId && r.skillId === skillId);
}
export function skillById(session, skillId) {
  return session.skills.find(s => s.id === skillId);
}
export function optionsForSkillInSession(session, skill) {
  return optionsForSkill({ scales: session.scales }, skill);
}
export function optionFor(session, skill, rating) {
  return optionsForSkillInSession(session, skill).find(o => o.value === rating);
}
function mapResult(session, paddlerId, skillId, fn) {
  return { ...session, results: session.results.map(r => (r.paddlerId === paddlerId && r.skillId === skillId ? fn(r) : r)) };
}
export function setRating(session, paddlerId, skillId, rating) {
  const skill = skillById(session, skillId);
  const opt = skill && optionFor(session, skill, rating);
  const keep = !!(opt && opt.requiresFeedback);
  return mapResult(session, paddlerId, skillId, r => ({ ...r, rating, feedback: keep ? r.feedback : '' }));
}
export function setFeedback(session, paddlerId, skillId, feedback) {
  return mapResult(session, paddlerId, skillId, r => ({ ...r, feedback }));
}
export function saveSession(session) { localStorage.setItem(KEY, JSON.stringify(session)); }
export function loadSession() {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw);
    // v3 sessions have per-paddler `target`; discard a v2-shaped session.
    if (!s || !Array.isArray(s.paddlers) || (s.paddlers.length > 0 && !('target' in s.paddlers[0]))) { clearSession(); return null; }
    return s;
  } catch { clearSession(); return null; }
}
export function clearSession() { localStorage.removeItem(KEY); }
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run tests/session.test.js`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/session.js tests/session.test.js
git commit -m "feat: v3 session model with per-candidate targets and v2 discard on load"
```

---

### Task 4: `validation.js` v3

**Files:**
- Modify: `src/lib/validation.js`
- Modify: `tests/validation.test.js`

**Interfaces:**
- Consumes: `skillById`, `optionFor` from `session.js`.
- Produces: `resultNeedsFeedback(session, result)` — true iff the result's skill is not optional, its rating's option (within that skill) has `requiresFeedback`, and `feedback.trim() === ''`. `invalidResults(session)`. `isSessionComplete(session)` — every non-optional result has a non-null rating AND no invalid results.

- [ ] **Step 1: Write the failing test** — replace `tests/validation.test.js`

```js
import { expect, test } from 'vitest';
import { resultNeedsFeedback, invalidResults, isSessionComplete } from '../src/lib/validation.js';

const session = {
  scales: {
    L1: [{ value: 'no', label: 'No', requiresFeedback: true }, { value: 'pass', label: 'Pass', requiresFeedback: false }],
    L2: [{ value: 'below', label: 'Below', requiresFeedback: true }, { value: 'l1', label: 'L1', requiresFeedback: true, dualOnly: true }, { value: 'meets', label: 'Meets', requiresFeedback: false }],
  },
  skills: [
    { id: 'd', level: 'L2', optional: false, l1Standard: 'x' },
    { id: 'o', level: 'L2', optional: true, l1Standard: 'x' },
  ],
  results: [],
};
const withResults = rs => ({ ...session, results: rs });

test('l1 rating with empty feedback needs feedback (dual skill)', () => {
  expect(resultNeedsFeedback(withResults([]), { skillId: 'd', rating: 'l1', feedback: ' ' })).toBe(true);
  expect(resultNeedsFeedback(withResults([]), { skillId: 'd', rating: 'l1', feedback: 'note' })).toBe(false);
  expect(resultNeedsFeedback(withResults([]), { skillId: 'd', rating: 'meets', feedback: '' })).toBe(false);
});

test('optional skill never needs feedback', () => {
  expect(resultNeedsFeedback(withResults([]), { skillId: 'o', rating: 'below', feedback: '' })).toBe(false);
});

test('isSessionComplete requires all core rated and no invalid', () => {
  expect(isSessionComplete(withResults([{ skillId: 'd', rating: 'meets', feedback: '' }]))).toBe(true);
  expect(isSessionComplete(withResults([{ skillId: 'd', rating: null, feedback: '' }]))).toBe(false);
  expect(isSessionComplete(withResults([{ skillId: 'd', rating: 'below', feedback: '' }]))).toBe(false);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/validation.test.js`
Expected: FAIL (v2 signatures differ).

- [ ] **Step 3: Rewrite `src/lib/validation.js`**

```js
import { skillById, optionFor } from './session.js';

export function resultNeedsFeedback(session, result) {
  const skill = skillById(session, result.skillId);
  if (!skill || skill.optional) return false;
  const opt = optionFor(session, skill, result.rating);
  return !!(opt && opt.requiresFeedback) && result.feedback.trim() === '';
}
export function invalidResults(session) {
  return session.results.filter(r => resultNeedsFeedback(session, r));
}
export function isSessionComplete(session) {
  const core = session.results.filter(r => { const s = skillById(session, r.skillId); return s && !s.optional; });
  return core.every(r => r.rating !== null) && invalidResults(session).length === 0;
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run tests/validation.test.js`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/validation.js tests/validation.test.js
git commit -m "feat: v3 validation — per-skill option-driven feedback (incl. l1 tier)"
```

---

### Task 5: `landing.js` — per-candidate landing

**Files:**
- Create: `src/lib/landing.js`
- Test: `tests/landing.test.js`

**Interfaces:**
- Consumes: `skillById` from `session.js`.
- Produces: `landingFor(session, paddlerId): { landing: 'L2'|'L1'|'did_not_meet_L1'|'pending', pendingCount: number }`, per the Global Constraints landing rules. Considers only the paddler's non-optional results.

- [ ] **Step 1: Write the failing test** — `tests/landing.test.js`

```js
import { expect, test } from 'vitest';
import { landingFor } from '../src/lib/landing.js';

// dual L2 skill has l1Standard; l2-only does not.
const skills = [
  { id: 'dual', level: 'L2', optional: false, l1Standard: 'x' },
  { id: 'only', level: 'L2', optional: false },
  { id: 'l1a', level: 'L1', optional: false },
];
function s(target, rs) {
  return { skills, paddlers: [{ id: 'p', target }], results: rs.map(([skillId, rating]) => ({ paddlerId: 'p', skillId, rating, feedback: '' })) };
}

test('L2: all meets/exceeds -> L2', () => {
  expect(landingFor(s('L2', [['dual', 'meets'], ['only', 'exceeds']]), 'p').landing).toBe('L2');
});
test('L2: an l1 mark (no below) -> L1', () => {
  expect(landingFor(s('L2', [['dual', 'l1'], ['only', 'meets']]), 'p').landing).toBe('L1');
});
test('L2: an L2-only below (no dual below) -> L1', () => {
  expect(landingFor(s('L2', [['dual', 'meets'], ['only', 'below']]), 'p').landing).toBe('L1');
});
test('L2: a dual below -> did_not_meet_L1', () => {
  expect(landingFor(s('L2', [['dual', 'below'], ['only', 'meets']]), 'p').landing).toBe('did_not_meet_L1');
});
test('L2: an unrated core -> pending', () => {
  const r = landingFor(s('L2', [['dual', 'meets'], ['only', null]]), 'p');
  expect(r.landing).toBe('pending'); expect(r.pendingCount).toBe(1);
});
test('L1: all pass -> L1; a no -> did_not_meet_L1; a dno -> pending', () => {
  expect(landingFor(s('L1', [['l1a', 'pass']]), 'p').landing).toBe('L1');
  expect(landingFor(s('L1', [['l1a', 'no']]), 'p').landing).toBe('did_not_meet_L1');
  expect(landingFor(s('L1', [['l1a', 'dno']]), 'p').landing).toBe('pending');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/landing.test.js`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `src/lib/landing.js`**

```js
import { skillById } from './session.js';

export function landingFor(session, paddlerId) {
  const paddler = session.paddlers.find(p => p.id === paddlerId);
  const target = paddler ? paddler.target : null;
  const rows = session.results.filter(r => {
    if (r.paddlerId !== paddlerId) return false;
    const s = skillById(session, r.skillId);
    return s && !s.optional;
  });
  const pendingCount = rows.filter(r => r.rating === null || (target === 'L1' && r.rating === 'dno')).length;
  if (pendingCount > 0) return { landing: 'pending', pendingCount };

  if (target === 'L1') {
    return { landing: rows.every(r => r.rating === 'pass') ? 'L1' : 'did_not_meet_L1', pendingCount: 0 };
  }
  // L2
  if (rows.every(r => r.rating === 'meets' || r.rating === 'exceeds')) return { landing: 'L2', pendingCount: 0 };
  const dualBelow = rows.some(r => { const s = skillById(session, r.skillId); return s && s.l1Standard && r.rating === 'below'; });
  return { landing: dualBelow ? 'did_not_meet_L1' : 'L1', pendingCount: 0 };
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run tests/landing.test.js`
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/landing.js tests/landing.test.js
git commit -m "feat: per-candidate landing computation (L2/L1/did-not-meet-L1/pending)"
```

---

### Task 6: `summary.js` v3 — per-paddler summary with landing

**Files:**
- Modify: `src/lib/summary.js`
- Modify: `tests/summary.test.js`

**Interfaces:**
- Consumes: `skillById`, `optionFor` from `session.js`; `landingFor` from `landing.js`.
- Produces: `paddlerSummary(session, paddlerId): { name, target, landing, pendingCount, coreTotal, counts: {<ratingValue>: n}, unrated, flagged: SummaryItem[], optionalItems: SummaryItem[] }` where `SummaryItem = {skillId, name, category, rating, ratingLabel, feedback}`. `counts` keyed by every option value in the paddler's target scale (0 if none). `flagged` = core results whose rating's option `requiresFeedback` (the `no`/`below`/`l1` items — the ones to talk through). Optional skills excluded from counts/flagged; listed in `optionalItems` when rated.

- [ ] **Step 1: Write the failing test** — replace `tests/summary.test.js`

```js
import { expect, test } from 'vitest';
import { paddlerSummary } from '../src/lib/summary.js';

const session = {
  scales: {
    L1: [{ value: 'no', label: 'No', requiresFeedback: true }, { value: 'pass', label: 'Pass', requiresFeedback: false }, { value: 'dno', label: 'DNO', requiresFeedback: false }],
    L2: [{ value: 'below', label: 'Below', requiresFeedback: true }, { value: 'l1', label: 'L1', requiresFeedback: true, dualOnly: true }, { value: 'meets', label: 'Meets', requiresFeedback: false }, { value: 'exceeds', label: 'Exceeds', requiresFeedback: false }],
  },
  paddlers: [{ id: 'p', name: 'Alex', target: 'L2' }],
  skills: [
    { id: 'd', level: 'L2', category: 'Strokes', name: 'Fwd', standard: 's', optional: false, l1Standard: 'x' },
    { id: 'm', level: 'L2', category: 'Strokes', name: 'Stop', standard: 's', optional: false },
    { id: 'opt', level: 'L2', category: 'Venue', name: 'Currents', standard: 's', optional: true },
  ],
  results: [
    { paddlerId: 'p', skillId: 'd', rating: 'l1', feedback: 'met L1 only' },
    { paddlerId: 'p', skillId: 'm', rating: 'meets', feedback: '' },
    { paddlerId: 'p', skillId: 'opt', rating: 'below', feedback: '' },
  ],
};

test('paddlerSummary reports landing, counts, and flagged items', () => {
  const s = paddlerSummary(session, 'p');
  expect(s).toMatchObject({ name: 'Alex', target: 'L2', landing: 'L1', coreTotal: 2 });
  expect(s.counts).toEqual({ below: 0, l1: 1, meets: 1, exceeds: 0 });
  expect(s.flagged.map(f => f.skillId)).toEqual(['d']);
  expect(s.flagged[0].ratingLabel).toBe('L1');
  expect(s.optionalItems.map(o => o.skillId)).toEqual(['opt']);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/summary.test.js`
Expected: FAIL (v2 shape differs).

- [ ] **Step 3: Rewrite `src/lib/summary.js`**

```js
import { skillById, optionFor } from './session.js';
import { landingFor } from './landing.js';

export function paddlerSummary(session, paddlerId) {
  const paddler = session.paddlers.find(p => p.id === paddlerId);
  const target = paddler ? paddler.target : null;
  const scale = (session.scales[target] || []);
  const counts = {};
  for (const o of scale) counts[o.value] = 0;
  const rows = session.results.filter(r => r.paddlerId === paddlerId);
  const { landing, pendingCount } = landingFor(session, paddlerId);
  const item = (r, s) => ({ skillId: r.skillId, name: s.name, category: s.category, rating: r.rating, ratingLabel: (scale.find(o => o.value === r.rating) || {}).label || '', feedback: r.feedback });
  let coreTotal = 0, unrated = 0;
  const flagged = [], optionalItems = [];
  for (const r of rows) {
    const s = skillById(session, r.skillId);
    if (!s) continue;
    if (s.optional) { if (r.rating !== null) optionalItems.push(item(r, s)); continue; }
    coreTotal++;
    if (r.rating === null) { unrated++; continue; }
    if (r.rating in counts) counts[r.rating]++;
    const opt = optionFor(session, s, r.rating);
    if (opt && opt.requiresFeedback) flagged.push(item(r, s));
  }
  return { name: paddler ? paddler.name : '', target, landing, pendingCount, coreTotal, counts, unrated, flagged, optionalItems };
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run tests/summary.test.js`
Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/summary.js tests/summary.test.js
git commit -m "feat: v3 per-paddler summary with landing, counts, and flagged items"
```

---

### Task 7: `csv.js` v3 — Target + Landing columns

**Files:**
- Modify: `src/lib/csv.js`
- Modify: `tests/csv.test.js`

**Interfaces:**
- Consumes: `skillById`, `optionFor` from `session.js`; `landingFor` from `landing.js`.
- Produces: `sessionToCsv(session): string`. Header exactly `Paddler,Target,Landing,Category,Skill,Optional,Rating,Feedback`. One row per result. `Target` = paddler.target; `Landing` = `landingFor(session, paddlerId).landing`; `Rating` = the option label for the result's rating (via the skill's option set), '' if null; `Optional` = `yes`/''. RFC-4180 escaping unchanged.

- [ ] **Step 1: Write the failing test** — replace `tests/csv.test.js`

```js
import { expect, test } from 'vitest';
import { sessionToCsv } from '../src/lib/csv.js';

const session = {
  scales: { L1: [], L2: [{ value: 'below', label: 'Below', requiresFeedback: true }, { value: 'l1', label: 'L1', requiresFeedback: true, dualOnly: true }, { value: 'meets', label: 'Meets', requiresFeedback: false }, { value: 'exceeds', label: 'Exceeds', requiresFeedback: false }] },
  paddlers: [{ id: 'p', name: 'Alex', target: 'L2' }],
  skills: [{ id: 'd', level: 'L2', category: 'Strokes', name: 'Fwd', optional: false, l1Standard: 'x' }],
  results: [{ paddlerId: 'p', skillId: 'd', rating: 'l1', feedback: 'said "hi", ok' }],
};

test('CSV header + row includes Target, Landing, and the rating label', () => {
  const lines = sessionToCsv(session).split('\n');
  expect(lines[0]).toBe('Paddler,Target,Landing,Category,Skill,Optional,Rating,Feedback');
  expect(lines[1]).toBe('Alex,L2,L1,Strokes,Fwd,,L1,"said ""hi"", ok"');
});
```

(One L2 skill rated `l1` → that candidate's landing is `L1`, so the row's Landing is `L1`.)

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/csv.test.js`
Expected: FAIL.

- [ ] **Step 3: Rewrite `src/lib/csv.js`**

```js
import { skillById, optionFor } from './session.js';
import { landingFor } from './landing.js';

function esc(field) {
  const s = String(field ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function sessionToCsv(session) {
  const paddlerById = new Map(session.paddlers.map(p => [p.id, p]));
  const landingById = new Map(session.paddlers.map(p => [p.id, landingFor(session, p.id).landing]));
  const rows = [['Paddler', 'Target', 'Landing', 'Category', 'Skill', 'Optional', 'Rating', 'Feedback']];
  for (const r of session.results) {
    const p = paddlerById.get(r.paddlerId) || { name: r.paddlerId, target: '' };
    const sk = skillById(session, r.skillId) || { category: '', name: r.skillId, optional: false };
    const opt = sk.category !== undefined ? optionFor(session, sk, r.rating) : null;
    rows.push([p.name, p.target, landingById.get(r.paddlerId) || '', sk.category, sk.name, sk.optional ? 'yes' : '', opt ? opt.label : '', r.feedback]);
  }
  return rows.map(cols => cols.map(esc).join(',')).join('\n');
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run tests/csv.test.js`
Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/csv.js tests/csv.test.js
git commit -m "feat: v3 CSV with Target and Landing columns"
```

---

### Task 8: `pdf.js` v3 — target + landing in the per-paddler PDF

**Files:**
- Modify: `src/lib/pdf.js`

**Interfaces:**
- Consumes: `paddlerSummary` (v3 shape). No test (jsPDF is browser-only; verified via build + manual).

- [ ] **Step 1: Read `src/lib/pdf.js`, then update `downloadPaddlerPdf(session, paddlerId)`**

Replace the summary/counts rendering to use the v3 `paddlerSummary` fields. Concretely:
- Title line: `ACA Assessment — ${summary.name}`.
- Add a prominent line: `Target: ${summary.target}    Landing: ${LANDING_LABEL[summary.landing]}` where
  ```js
  const LANDING_LABEL = { L2: 'Level 2', L1: 'Level 1', did_not_meet_L1: 'Did not meet Level 1', pending: `Pending (${summary.pendingCount} not yet assessed)` };
  ```
- Counts line: map over the target's scale labels using `summary.counts` (e.g. `Below x  L1 y  Meets z  Exceeds w`), plus `Unrated ${summary.unrated}`.
- Heading "Skills to review:" then each `summary.flagged` item as `• ${name} (${category}) — ${ratingLabel}` followed by the wrapped `feedback`. If empty: "None flagged."
- If `summary.optionalItems.length`, an "Optional (developing) skills assessed:" section listing `• ${name}: ${ratingLabel}`.
- Filename `aca-${summary.target}-${safeName}.pdf`.
Keep the existing page-overflow handling.

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: build succeeds (jsPDF bundles).

- [ ] **Step 3: Run tests + commit**

Run: `npm test` (should stay green)
```bash
git add src/lib/pdf.js
git commit -m "feat: v3 PDF — target, landing, flagged skills"
```

---

### Task 9: `session-summary.js` — v3 + v2 backward compat for `/sessions`

**Files:**
- Modify: `src/lib/session-summary.js`
- Modify: `tests/session-summary.test.js`

**Interfaces:**
- Consumes: `landingFor` from `landing.js` (v3 only).
- Produces: `sessionSummary(session): { id, createdAt, participants: string[], targets: string[], landings: string[], level: string|null, counts: {core,rated} }`.
  - **v3** session (paddlers have `target`): `participants` = names; `targets` = per-paddler target; `landings` = per-paddler landing; `level` = `''`.
  - **v2** session (has `levelName`/no per-paddler target): `participants` = names; `targets` = `[]`; `landings` = `[]`; `level` = `session.levelName`. Must not throw.
  - `counts.core` = # non-optional skills; `counts.rated` = # non-optional skills where every applicable result is non-null (best-effort; for v2, all results).

- [ ] **Step 1: Write the failing test** — replace `tests/session-summary.test.js`

```js
import { expect, test } from 'vitest';
import { sessionSummary } from '../src/lib/session-summary.js';

const v3 = {
  id: 's3', createdAt: 't',
  paddlers: [{ id: 'p', name: 'Alex', target: 'L2' }],
  skills: [{ id: 'd', level: 'L2', optional: false, l1Standard: 'x' }],
  results: [{ paddlerId: 'p', skillId: 'd', rating: 'meets', feedback: '' }],
};
const v2 = { id: 's2', createdAt: 't', levelId: 'L2', levelName: 'Level 2', paddlers: [{ id: 'p', name: 'Sam' }], skills: [{ id: 'x', optional: false }], results: [{ paddlerId: 'p', skillId: 'x', rating: 'meets' }] };

test('v3 summary has targets + landings, no level', () => {
  const s = sessionSummary(v3);
  expect(s.participants).toEqual(['Alex']);
  expect(s.targets).toEqual(['L2']);
  expect(s.landings).toEqual(['L2']);
  expect(s.level).toBe('');
});
test('v2 summary degrades: level set, no landings, no throw', () => {
  const s = sessionSummary(v2);
  expect(s.participants).toEqual(['Sam']);
  expect(s.level).toBe('Level 2');
  expect(s.landings).toEqual([]);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/session-summary.test.js`
Expected: FAIL.

- [ ] **Step 3: Rewrite `src/lib/session-summary.js`**

```js
import { landingFor } from './landing.js';

function coreCounts(session) {
  const core = (session.skills || []).filter(s => !s.optional);
  const coreIds = new Set(core.map(s => s.id));
  const rated = (session.results || []).filter(r => coreIds.has(r.skillId) && r.rating !== null).length;
  return { core: core.length, rated };   // rough progress hint: # core skills, # non-null core results
}

export function sessionSummary(session) {
  const paddlers = session.paddlers || [];
  const isV3 = paddlers.length > 0 && 'target' in paddlers[0];
  const base = {
    id: session.id, createdAt: session.createdAt,
    participants: paddlers.map(p => p.name),
    counts: coreCounts(session),
  };
  if (isV3) {
    return { ...base, targets: paddlers.map(p => p.target), landings: paddlers.map(p => landingFor(session, p.id).landing), level: '' };
  }
  return { ...base, targets: [], landings: [], level: session.levelName || '' };
}
```
(Keep `counts` simple: `core` = # non-optional skills, `rated` = # non-null core results. The `/sessions` page shows it as a rough progress hint.)

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run tests/session-summary.test.js`
Expected: 2 passed.

- [ ] **Step 5: Update the `/sessions` page to show targets/landings (Pi server)**

In `pi/sync-server.mjs`'s `sessionsPage()` client script, the row currently shows `x.levelName` and `x.paddlers`. Update it to use the new summary shape: show participants with their landing when present, e.g. build the Participants cell as `x.participants.map((n,i)=> x.landings[i] ? n+' ('+x.landings[i]+')' : n).join(', ')`, and a Level/Mode cell that shows `x.level || (x.targets.length ? 'L1/L2' : '')`. Keep using `textContent`/`createElement` (no innerHTML of user data). Adjust the `/api/sessions` consumer keys accordingly (`x.participants` instead of `x.paddlers`, etc.). Verify with the curl flow: `npm run build && node pi/sync-server.mjs &`, POST a v3 session and an old v2-shaped session, `curl /api/sessions` shows both, `/sessions` returns 200; then `pkill -f sync-server.mjs` and clean seed files.

- [ ] **Step 6: Run tests + commit**

Run: `npm test`
```bash
git add src/lib/session-summary.js tests/session-summary.test.js pi/sync-server.mjs
git commit -m "feat: v3 session summary with targets/landings + v2 backward-compat; update /sessions page"
```

---

### Task 10: `Setup.jsx` — per-paddler target selector

**Files:**
- Modify: `src/screens/Setup.jsx`

**Interfaces:**
- Consumes: `loadConfig` (v3), `createSession({id,createdAt,config,location,paddlers:[{name,target}]})`.

- [ ] **Step 1: Read `src/screens/Setup.jsx`, then rewrite it**

Replace the single Level `<select>` with a per-paddler row: each of the 5 rows has a **name input** and an **L1/L2 target `<select>`** (default `L2`). State: `paddlers` = array of 5 `{ name: '', target: 'L2' }`. On Start, call:
```jsx
const session = createSession({
  id: `sess-${Date.now()}`, createdAt: new Date().toISOString(),
  config: CONFIG, location, paddlers,
});
if (session.paddlers.length === 0) { setError('Add at least one paddler name.'); return; }
onStart(session);
```
`CONFIG = loadConfig(rawSkills)` at module load (unchanged import). Keep the location field, the private "Past assessments →" link (`import.meta.env.VITE_PRIVATE`), and the up-to-5 limit. Remove `levelIds/getLevel` usage (no level dropdown).

- [ ] **Step 2: Verify build + tests**

Run: `npm run build && npm test`
Expected: build succeeds; tests green.

- [ ] **Step 3: Commit**

```bash
git add src/screens/Setup.jsx
git commit -m "feat: v3 setup — assign a target level per paddler"
```

---

### Task 11: `Rate.jsx` — combined list filtered per target, tiered chips, dual standards

**Files:**
- Modify: `src/screens/Rate.jsx`

**Interfaces:**
- Consumes: `getResult`, `setRating`, `setFeedback`, `optionsForSkillInSession`, `skillById` from `session.js`; `resultNeedsFeedback` from `validation.js`; lessons glob (unchanged).

- [ ] **Step 1: Read `src/screens/Rate.jsx`, then update the render**

Key changes (keep the collapsible teaching lesson + always-shown standard from the prior work):
- The skill list is `session.skills` (combined). For the current skill, compute the applicable paddlers: `const rowPaddlers = session.paddlers.filter(p => p.target === skill.level);`. If `rowPaddlers.length === 0`, auto-skip this skill (advance past it) — a skill with no candidate at its level isn't shown.
- Chips come from `optionsForSkillInSession(session, skill)` (per-skill option set: L1 → No/Pass/DNO; dual L2 → Below/L1/Meets/Exceeds; L2-only → Below/Meets/Exceeds). Render a chip per option; `aria-pressed` on the selected; onClick `onChange(setRating(session, p.id, skill.id, opt.value))`.
- Danger styling: style an option chip whose `requiresFeedback` is true as the danger color when selected (covers `no`, `below`, `l1`); others positive. (Reuse the existing chip CSS keyed on the selected rating; ensure `l1` gets a distinct/danger-ish style — add a CSS rule for the `l1` value.)
- Standard display: always show `skill.standard`. For a dual L2 skill (`skill.l1Standard`), also show the L1 standard, labelled "L1 standard", beneath it.
- Feedback box: shown when the paddler's current rating's option `requiresFeedback` — enforce via `resultNeedsFeedback`. Blocking/nav logic unchanged (block prev/next while any visible row needs feedback).
- Progress counter: count core skills (non-optional) where every applicable paddler (matching level) has a non-null rating.
- Header label: replace the `{session.levelId} standard` text with just `Standard` (no session-level id anymore); the dual L1 line is labelled `L1 standard`.

- [ ] **Step 2: Verify build + tests**

Run: `npm run build && npm test`
Expected: build succeeds; tests green.

- [ ] **Step 3: Commit**

```bash
git add src/screens/Rate.jsx src/styles.css
git commit -m "feat: v3 rate screen — per-target rows, tiered chips, dual L1/L2 standards"
```

---

### Task 12: `Review.jsx` — landing display

**Files:**
- Modify: `src/screens/Review.jsx`

**Interfaces:**
- Consumes: `paddlerSummary` (v3), `sessionToCsv`, `invalidResults`/`isSessionComplete`, `downloadPaddlerPdf`, `syncSession` (unchanged).

- [ ] **Step 1: Read `src/screens/Review.jsx`, then update the per-paddler card**

- Heading: `Review` (drop `— {session.levelName}`; no session level).
- Each paddler card shows a prominent **landing badge** from `summary.landing`:
  ```jsx
  const LANDING = { L2: 'Lands: Level 2', L1: 'Lands: Level 1', did_not_meet_L1: 'Did not meet Level 1', pending: `Pending — ${summary.pendingCount} not yet assessed` };
  ```
  and the target: `Target: {summary.target}`.
- Counts line: map over the target's scale (from `session.scales[summary.target]`) showing `{label} {summary.counts[value] ?? 0}` + `Unrated {summary.unrated}` (style `requiresFeedback` counts in the danger class).
- Replace the old "belowItems" list with **`summary.flagged`**: `<strong>{name}</strong> ({category}) — {ratingLabel}: {feedback}`.
- Keep `optionalItems`, the per-paddler PDF button, and the actions row (Back / CSV / Start over / Sync[private]) with the outstanding-feedback gating unchanged.

- [ ] **Step 2: Verify build + tests**

Run: `npm run build && npm test`
Expected: build succeeds; tests green.

- [ ] **Step 3: Commit**

```bash
git add src/screens/Review.jsx
git commit -m "feat: v3 review — per-candidate landing badge and flagged skills"
```

---

### Task 13: `app.jsx` — resume guard (v2 discard already in session.js)

**Files:**
- Modify: `src/app.jsx`

**Interfaces:**
- Consumes: `loadSession` (now discards v2-shaped sessions).

- [ ] **Step 1: Confirm `app.jsx` resume logic is correct with v3**

`app.jsx` calls `loadSession()` (which now returns `null` for a v2-shaped stored session, per Task 3). No code change is required if `app.jsx` already routes to `setup` when `session` is null. Read `src/app.jsx` and confirm the init (`const [session] = useState(() => loadSession())` and `screen` init to `'rate'` only when `session` is truthy). If it references any removed field (e.g. `session.levelName`) in a placeholder, remove that reference.

- [ ] **Step 2: Full build + suite + manual trace**

Run: `npm run build && npm test`
Expected: build succeeds; full suite green.
Manual trace (code reading): start a mixed session (Alex L2, Sam L1) → Rate walks combined skills, showing L2 rows on L2 skills and L1 rows on L1 skills → Review shows Alex's and Sam's landings. Reload → since a v3 session is stored, it resumes; a leftover v2 session would be discarded to setup.

- [ ] **Step 3: Commit (if changed)**

```bash
git add src/app.jsx
git commit -m "chore: v3 app resume — rely on loadSession v2 discard"
```

---

## Self-Review

**Spec coverage:**
- v3 `skills.json` (scales + flat skills + l1Standard duals + interleaved order) → Task 1.
- Per-skill option resolution (`optionsForSkill`) → Task 2. Per-candidate targets + rate-only-your-level + feedback-clearing → Task 3. Feedback required on `no`/`below`/`l1`, optional never → Task 4. Landing rules (full truth table) → Task 5. Per-paddler summary + landing + flagged → Task 6. CSV Target/Landing → Task 7. PDF target/landing → Task 8. `/sessions` v3+v2 backward compat → Task 9. Setup per-paddler target → Task 10. Rate combined/tiered/dual-standard → Task 11. Review landing → Task 12. v2 discard on resume → Tasks 3 + 13.
- Backward-compat for old archived sessions → Task 9 (degrade); in-progress v2 localStorage discard → Task 3 `loadSession`.

**Placeholder scan:** No TBD/TODO. The dual mapping + interleave order in Task 1 are seed data the spec flags as Ken-to-confirm; the code is concrete.

**Type consistency:** `optionsForSkill(config, skill)` (Task 2) vs `optionsForSkillInSession(session, skill)` / `optionFor(session, skill, rating)` (Task 3) — consistent, the session variants wrap the config one over `session.scales`. `landingFor(session, paddlerId) → {landing, pendingCount}` used identically in Tasks 6/7/9/12. `paddlerSummary` v3 fields (`name,target,landing,pendingCount,coreTotal,counts,unrated,flagged,optionalItems`) consumed consistently in Tasks 8/12. `createSession({...paddlers:[{name,target}]})` (Task 3) matches Setup's call (Task 10). Session shape (`scales`, `paddlers[{id,name,target}]`, `skills`, `results`) consistent across all tasks.
