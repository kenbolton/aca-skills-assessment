# Competency Radars Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-paddler competency radar charts to the Review screen — small multiples, one radar per non-optional category, spokes = that category's skills (unlabeled), radius = the standard level (L1–L5) each skill attained. Current-session only.

**Architecture:** Pure scoring (`competency.js`) and geometry (`radar-geometry.js`) modules with real unit tests; thin SVG view components (`CompetencyRadar`, `CompetencyRadars`) mounted in each Review card. Read-only over the existing session; nothing stored.

**Tech Stack:** Vite + Preact, inline SVG (no chart lib), plain CSS, Vitest (`environment: node`).

## Global Constraints

- **Node 22+**; test env **`node`** (no DOM). Tests cover pure `src/lib` logic only; components/screens are thin views not unit-tested by rendering.
- **No new dependencies** (hand-rolled SVG).
- **Preact** — import from `preact`/`preact/hooks`.
- **Scope:** Review screen + the two new lib modules + two new components only. No change to PDF/CSV/Pi/session storage. Optional/"developing" skills are excluded.
- **No spoke labels** — the category name is the only text per radar; spokes are unlabeled (the value is the shape).
- **Scoring is fixed** (from the spec): `T = targetLevelNum(target)`. L3/L4/L5: below→T−1, meets→T, exceeds→T+½. L2: below→0, l1→1, meets→2, exceeds→2½. L1: no→0, pass→1. DNO/unrated/unknown → `null` (gap).
- **Geometry constants:** viewBox `120×120`, `cx=cy=60`, `r=50`, `max=5.5`, rings at levels 1,2,3,4,5; first spoke at 12 o'clock.
- Test style: `import { expect, test } from 'vitest'` with inline fixtures.

---

### Task 1: `competency.js` — scoring + grouping (pure)

**Files:**
- Create: `src/lib/competency.js`
- Test: `tests/competency.test.js`

**Interfaces:**
- Produces:
  - `targetLevelNum(target: string): number` — `'L1'`→1 … `'L5'`→5, else 0.
  - `skillLevelValue(target: string, rating: string|null): number|null` — the scoring table; `null` for dno/unrated/unknown.
  - `competencyRadars(session, paddlerId): Array<{ category: string, levels: Array<number|null> }>` — the paddler's non-optional target-level skills grouped by category (first-seen order), each category an ordered list of per-skill levels (`null` per unrated/DNO skill).

- [ ] **Step 1: Write the failing tests**

```js
// tests/competency.test.js
import { expect, test } from 'vitest';
import { targetLevelNum, skillLevelValue, competencyRadars } from '../src/lib/competency.js';

test('targetLevelNum maps L1..L5 and unknown', () => {
  expect(targetLevelNum('L1')).toBe(1);
  expect(targetLevelNum('L4')).toBe(4);
  expect(targetLevelNum('L5')).toBe(5);
  expect(targetLevelNum('X')).toBe(0);
});

test('skillLevelValue: L3/L4/L5 map below/meets/exceeds to T-1/T/T+0.5', () => {
  expect(skillLevelValue('L4', 'below')).toBe(3);
  expect(skillLevelValue('L4', 'meets')).toBe(4);
  expect(skillLevelValue('L4', 'exceeds')).toBe(4.5);
  expect(skillLevelValue('L3', 'below')).toBe(2);
  expect(skillLevelValue('L5', 'exceeds')).toBe(5.5);
});

test('skillLevelValue: L2 has the l1 landing rung', () => {
  expect(skillLevelValue('L2', 'below')).toBe(0);
  expect(skillLevelValue('L2', 'l1')).toBe(1);
  expect(skillLevelValue('L2', 'meets')).toBe(2);
  expect(skillLevelValue('L2', 'exceeds')).toBe(2.5);
});

test('skillLevelValue: L1 is no/pass, and DNO/unrated/unknown are gaps', () => {
  expect(skillLevelValue('L1', 'no')).toBe(0);
  expect(skillLevelValue('L1', 'pass')).toBe(1);
  expect(skillLevelValue('L4', 'dno')).toBe(null);
  expect(skillLevelValue('L4', null)).toBe(null);
  expect(skillLevelValue('L4', 'bogus')).toBe(null);
});

test('competencyRadars groups core target-level skills by category with per-skill levels', () => {
  const session = {
    paddlers: [{ id: 'p', name: 'A', target: 'L3' }],
    skills: [
      { id: 's1', level: 'L3', category: 'Strokes', optional: false },
      { id: 's2', level: 'L3', category: 'Strokes', optional: false },
      { id: 's3', level: 'L3', category: 'Rescues', optional: false },
      { id: 'opt', level: 'L3', category: 'Strokes', optional: true },   // excluded (optional)
      { id: 'other', level: 'L2', category: 'Strokes', optional: false }, // excluded (level)
    ],
    results: [
      { paddlerId: 'p', skillId: 's1', rating: 'exceeds' },
      { paddlerId: 'p', skillId: 's2', rating: 'dno' },
      // s3 has no result -> unrated -> null
    ],
  };
  expect(competencyRadars(session, 'p')).toEqual([
    { category: 'Strokes', levels: [3.5, null] },
    { category: 'Rescues', levels: [null] },
  ]);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/competency.test.js`
Expected: FAIL — cannot resolve `../src/lib/competency.js`.

- [ ] **Step 3: Create the module**

```js
// src/lib/competency.js
// Scoring + grouping for the Review-screen competency radars. Assessment is
// progressive: a paddler is assessed at level T because they already met T-1,
// so a skill rated "below" at T sits at T-1, not zero. Each skill maps to a
// "standard level attained" (see the design spec's table).

export function targetLevelNum(target) {
  return { L1: 1, L2: 2, L3: 3, L4: 4, L5: 5 }[target] || 0;
}

export function skillLevelValue(target, rating) {
  if (rating == null || rating === 'dno') return null;
  const T = targetLevelNum(target);
  if (target === 'L1') {
    return rating === 'pass' ? 1 : rating === 'no' ? 0 : null;
  }
  if (target === 'L2') {
    const m = { below: 0, l1: 1, meets: 2, exceeds: 2.5 };
    return rating in m ? m[rating] : null;
  }
  const m = { below: T - 1, meets: T, exceeds: T + 0.5 };
  return rating in m ? m[rating] : null;
}

// The paddler's non-optional target-level skills, grouped by category in
// first-seen order, each category an ordered list of per-skill level values
// (null for an unrated or DNO skill). Consumers pick radar vs gauge by length.
export function competencyRadars(session, paddlerId) {
  const paddler = (session.paddlers || []).find(p => p.id === paddlerId);
  if (!paddler) return [];
  const target = paddler.target;
  const ratingBySkill = new Map(
    (session.results || [])
      .filter(r => r.paddlerId === paddlerId)
      .map(r => [r.skillId, r.rating]));
  const groups = new Map();
  for (const s of session.skills || []) {
    if (s.optional || s.level !== target) continue;
    const rating = ratingBySkill.has(s.id) ? ratingBySkill.get(s.id) : null;
    if (!groups.has(s.category)) groups.set(s.category, []);
    groups.get(s.category).push(skillLevelValue(target, rating));
  }
  return [...groups.entries()].map(([category, levels]) => ({ category, levels }));
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run tests/competency.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Full suite + commit**

Run: `npx vitest run` → all green.

```bash
git add src/lib/competency.js tests/competency.test.js
git commit -m "feat(competency): level-attained scoring + per-category grouping"
```

---

### Task 2: `radar-geometry.js` — SVG geometry (pure)

**Files:**
- Create: `src/lib/radar-geometry.js`
- Test: `tests/radar-geometry.test.js`

**Interfaces:**
- Produces:
  - `radarPoints(values: Array<number|null>, opts: { cx, cy, r, max }): Array<{x,y}|null>` — one entry per value, evenly spaced clockwise from 12 o'clock, radius `r*(value/max)`; `null` passes through as `null`.
  - `ringPolygonPoints(level: number, opts: { cx, cy, r, max, count }): string` — SVG `points` string (`"x,y x,y …"`) for the ring at `level` with `count` vertices.

- [ ] **Step 1: Write the failing tests**

```js
// tests/radar-geometry.test.js
import { expect, test } from 'vitest';
import { radarPoints, ringPolygonPoints } from '../src/lib/radar-geometry.js';

const OPTS = { cx: 60, cy: 60, r: 50, max: 5.5 };

test('radarPoints: one entry per value, first spoke at 12 o\'clock, null passthrough', () => {
  const pts = radarPoints([5.5, null, 5.5, 5.5], OPTS);
  expect(pts).toHaveLength(4);
  // first spoke straight up: x == cx, y == cy - r (value == max)
  expect(pts[0].x).toBeCloseTo(60, 5);
  expect(pts[0].y).toBeCloseTo(10, 5);
  expect(pts[1]).toBe(null);
});

test('radarPoints: radius scales with value/max', () => {
  const [p] = radarPoints([2.75], OPTS); // half of 5.5 -> radius 25 -> y = 60-25
  expect(p.x).toBeCloseTo(60, 5);
  expect(p.y).toBeCloseTo(35, 5);
});

test('ringPolygonPoints: count vertices for the ring', () => {
  const s = ringPolygonPoints(5.5, { ...OPTS, count: 4 });
  expect(s.trim().split(/\s+/)).toHaveLength(4);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/radar-geometry.test.js`
Expected: FAIL — module missing.

- [ ] **Step 3: Create the module**

```js
// src/lib/radar-geometry.js
// Pure geometry for the competency radars. Spokes are evenly spaced clockwise
// starting at 12 o'clock; a point's radius is proportional to value/max.

function angleFor(i, n) {
  return -Math.PI / 2 + (2 * Math.PI * i) / n;
}

export function radarPoints(values, { cx, cy, r, max }) {
  const n = values.length;
  return values.map((v, i) => {
    if (v == null) return null;
    const rad = r * (v / max);
    const a = angleFor(i, n);
    return { x: cx + rad * Math.cos(a), y: cy + rad * Math.sin(a) };
  });
}

export function ringPolygonPoints(level, { cx, cy, r, max, count }) {
  const rad = r * (level / max);
  const pts = [];
  for (let i = 0; i < count; i++) {
    const a = angleFor(i, count);
    pts.push(`${(cx + rad * Math.cos(a)).toFixed(2)},${(cy + rad * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(' ');
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run tests/radar-geometry.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Full suite + commit**

Run: `npx vitest run` → all green.

```bash
git add src/lib/radar-geometry.js tests/radar-geometry.test.js
git commit -m "feat(radar): pure SVG geometry (radar points + ring polygons)"
```

---

### Task 3: `CompetencyRadar` component + styles (thin view)

Renders one category: heading + an SVG radar (`≥3` skills) or a level gauge (`<3`). Not unit-tested by rendering; verified by `npm run build` + the Task 4 manual check.

**Files:**
- Create: `src/components/CompetencyRadar.jsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `radarPoints`, `ringPolygonPoints` from `src/lib/radar-geometry.js`.
- Produces: `CompetencyRadar({ category, levels })` named export.

- [ ] **Step 1: Create the component**

```jsx
// src/components/CompetencyRadar.jsx
// One competency area: a small SVG radar of its skills' attained levels
// (unlabeled spokes; the category name is the only text). Categories with
// fewer than 3 skills can't form a polygon, so they render as a level gauge.
import { radarPoints, ringPolygonPoints } from '../lib/radar-geometry.js';

const GEO = { cx: 60, cy: 60, r: 50, max: 5.5 };
const RINGS = [1, 2, 3, 4, 5];

export function CompetencyRadar({ category, levels }) {
  if (!levels || levels.length === 0) return null;
  return (
    <figure className="competency-radar">
      <figcaption className="cr-title">{category}</figcaption>
      {levels.length >= 3
        ? <RadarSvg levels={levels} />
        : <GaugeSvg levels={levels} />}
    </figure>
  );
}

function RadarSvg({ levels }) {
  const count = levels.length;
  const pts = radarPoints(levels, GEO);
  // The filled shape connects each spoke's point; an unassessed (null) spoke
  // pinches to center so gaps read as "not yet assessed".
  const poly = pts
    .map((p, i) => {
      if (p) return `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
      const a = -Math.PI / 2 + (2 * Math.PI * i) / count;
      return `${(GEO.cx + 0 * Math.cos(a)).toFixed(2)},${(GEO.cy).toFixed(2)}`;
    })
    .join(' ');
  return (
    <svg className="cr-svg" viewBox="0 0 120 120" role="img" aria-label={`competency radar, ${count} skills`}>
      {RINGS.map(lvl => (
        <polygon key={lvl} className="cr-ring" points={ringPolygonPoints(lvl, { ...GEO, count })} />
      ))}
      {/* spokes */}
      {Array.from({ length: count }, (_, i) => {
        const a = -Math.PI / 2 + (2 * Math.PI * i) / count;
        return (
          <line
            key={i}
            className="cr-spoke"
            x1={GEO.cx} y1={GEO.cy}
            x2={(GEO.cx + GEO.r * Math.cos(a)).toFixed(2)}
            y2={(GEO.cy + GEO.r * Math.sin(a)).toFixed(2)}
          />
        );
      })}
      <polygon className="cr-shape" points={poly} />
      {pts.map((p, i) => (p ? <circle key={i} className="cr-dot" cx={p.x.toFixed(2)} cy={p.y.toFixed(2)} r="1.6" /> : null))}
    </svg>
  );
}

function GaugeSvg({ levels }) {
  // A short L1-L5 scale with a dot per skill at its level (label-free).
  const W = 120, H = 28, padX = 8, y = 18;
  const x = lvl => padX + ((W - 2 * padX) * (lvl / 5));
  return (
    <svg className="cr-svg cr-gauge" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="competency level gauge">
      <line className="cr-gauge-axis" x1={padX} y1={y} x2={W - padX} y2={y} />
      {[1, 2, 3, 4, 5].map(l => <line key={l} className="cr-gauge-tick" x1={x(l)} y1={y - 3} x2={x(l)} y2={y + 3} />)}
      {levels.map((lvl, i) => (lvl == null ? null : <circle key={i} className="cr-dot" cx={x(lvl)} cy={y} r="2.4" />))}
    </svg>
  );
}
```

- [ ] **Step 2: Add styles to `src/styles.css`**

```css
.competency-radars { display: flex; flex-wrap: wrap; gap: .75rem; margin: .75rem 0 0; }
.competency-radar { margin: 0; width: 140px; }
.cr-title { font-size: .8rem; font-weight: 600; color: #14323a; margin: 0 0 .2rem; line-height: 1.15; }
.cr-svg { width: 100%; height: auto; display: block; }
.cr-ring { fill: none; stroke: #d7e3e5; stroke-width: .5; }
.cr-spoke { stroke: #e4edee; stroke-width: .5; }
.cr-shape { fill: rgba(0,95,107,.25); stroke: #005f6b; stroke-width: 1.5; }
.cr-dot { fill: #005f6b; }
.cr-gauge-axis, .cr-gauge-tick { stroke: #b7c9cc; stroke-width: 1; }
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: succeeds (component parses; no runtime wiring yet).

- [ ] **Step 4: Commit**

```bash
git add src/components/CompetencyRadar.jsx src/styles.css
git commit -m "feat(review): CompetencyRadar SVG component + styles"
```

---

### Task 4: `CompetencyRadars` + mount in Review (thin view)

**Files:**
- Create: `src/components/CompetencyRadars.jsx`
- Modify: `src/screens/Review.jsx`

**Interfaces:**
- Consumes: `competencyRadars` (`src/lib/competency.js`), `CompetencyRadar` (Task 3).
- Produces: `CompetencyRadars({ session, paddlerId })` named export.

- [ ] **Step 1: Create the grid component**

```jsx
// src/components/CompetencyRadars.jsx
// All of a paddler's competency radars as small multiples, one per category.
import { competencyRadars } from '../lib/competency.js';
import { CompetencyRadar } from './CompetencyRadar.jsx';

export function CompetencyRadars({ session, paddlerId }) {
  const groups = competencyRadars(session, paddlerId);
  if (!groups.length) return null;
  return (
    <div className="competency-radars">
      {groups.map(g => (
        <CompetencyRadar key={g.category} category={g.category} levels={g.levels} />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Mount in `Review.jsx`**

Add the import beside the other component imports:

```jsx
import { CompetencyRadars } from '../components/CompetencyRadars.jsx';
```

In each paddler's card, render it after the `BelowStandardDetail` line (find `<BelowStandardDetail items={summary.flagged} onEditSkill={onEditSkill} />`) — add directly below it:

```jsx
              <CompetencyRadars session={session} paddlerId={paddler.id} />
```

- [ ] **Step 3: Full suite**

Run: `npx vitest run`
Expected: PASS — all tests green (views untested; lib tests unaffected).

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 5: Manual verification**

Run: `npm run dev`. Create an assessment (e.g. an L3 self-assessment), rate a spread of skills across categories with Below / Meets / Exceeds and leave some DNO/unrated, then go to Review. Confirm:
1. Each paddler card shows a row of small radars, one per category, with the category name as the heading.
2. A category's polygon sits at the right rings (all-Meets ≈ ring 3 for L3; Exceeds pushes out toward 3.5; Below pulls in to ring 2; DNO/unrated pinches to center).
3. A category with < 3 skills shows the level-gauge fallback (dots on a short scale), not a broken polygon.
4. No per-spoke text labels appear; the page still renders the existing counts/below-standard detail above the radars.

- [ ] **Step 6: Commit**

```bash
git add src/components/CompetencyRadars.jsx src/screens/Review.jsx
git commit -m "feat(review): show per-paddler competency radars"
```

---

## Self-Review (completed by plan author)

- **Spec coverage:** scoring table + grouping (Task 1); SVG geometry (Task 2); per-category radar with `<3` gauge fallback, unlabeled spokes, category heading (Task 3); small-multiples grid + Review mount (Task 4). Over-time view, per-spoke labels, group comparison, and PDF/CSV/Pi changes all excluded per spec.
- **Placeholder scan:** every step is complete code; no TBDs or dead blocks.
- **Type consistency:** `competencyRadars` returns `{ category, levels }` (Task 1) consumed identically by `CompetencyRadars` (Task 4) and passed as `levels` to `CompetencyRadar` (Task 3); `radarPoints(values, {cx,cy,r,max})` / `ringPolygonPoints(level, {cx,cy,r,max,count})` signatures match their calls in `CompetencyRadar`. `GEO`/`max=5.5`/rings 1–5 constants consistent across the geometry and component.
