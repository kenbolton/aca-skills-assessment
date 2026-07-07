# Competency Radars — Design Spec

**Date:** 2026-07-07
**Status:** Approved, ready for implementation plan
**Scope:** Add per-paddler competency radar charts to the Review screen — small
multiples, **one radar per competency area (category)**, each spoke a skill,
radius = the standard level (L1–L5) that skill attained. Current-session only.

## Goal

Show, at a glance, what standard level a paddler is operating at across each area
of skill — and set up the visual so that, over successive assessments, the
polygons visibly inflate as the paddler climbs levels (the over-time comparison
arrives later with paddler profiles).

## The core idea (agreed in brainstorming)

Assessment is **progressive**: a paddler is assessed at level *T* because they
have already met the *T−1* standard. So a skill rated **Below** at their target
isn't a failure — it means that competency is holding at the **previous** level.
Each skill therefore maps to a **standard level attained** on an L1–L5 grid:

| Target scale | Rating | Level attained (radius) |
| --- | --- | --- |
| L3 / L4 / L5 (`below/meets/exceeds`) | Below | **T − 1** |
| | Meets | **T** |
| | Exceeds | **T + ½** |
| L2 (`below/l1/meets/exceeds`) | Below | **0** (below L1) |
| | L1 (landed) | **1** |
| | Meets | **2** |
| | Exceeds | **2½** |
| L1 (`no/pass`) | No | **0** |
| | Pass | **1** |
| any | DNO / unrated | **gap** (no point; not assessed) |

`T` = the paddler's target level number (`L1`→1 … `L5`→5). The L1/L2 combined
mode has the extra `l1` landing value, so its "below" is a true below-L1 (0)
rather than T−1 — the table encodes this. The radar grid draws rings at levels
**1–5**; the polygon sits wherever the skills land (e.g. an L4 paddler who mostly
Meets sits near ring 4, with Below skills pulled in to ring 3).

## Chart form (agreed)

**Small multiples**, one radar per competency area, rather than one dense
70-spoke chart or a 6-axis category-summary chart:

- **One radar per non-optional category** the paddler was assessed in (their
  target level's categories — `Core:` and `Venue Specific:`; optional/"developing"
  skills are excluded, as they never count against a paddler).
- **Spokes = that category's core skills** (all of them, rated or not), labeled
  with short skill names. Unrated/DNO skills draw as a gap at center.
- **Radius = level attained** per the table above; concentric rings mark L1…L5.
- **One set of radars per paddler**, inside that paddler's existing review card.
- Hand-rolled inline **SVG** (no chart library — fits the offline/precache/jsPDF
  ethos and establishes a reusable charting approach).

### Small-category fallback (`< 3` skills)

A radar needs ≥3 spokes to be a polygon. A category with 1–2 core skills (only
L1's "Safety and Rescue" = 2 in current data, but handle generally) renders
instead as a compact **labeled level readout** — each skill as a row with its
name and attained level (e.g. `Bracing — L3`), not a degenerate 2-spoke chart.

## Architecture

Pure scoring/geometry in `src/lib/`; thin SVG views in `src/components/`.

### 1. `src/lib/competency.js` (new) — scoring + grouping (pure)

- `targetLevelNum(target: string): number` — `'L1'`→1 … `'L5'`→5 (0 if unknown).
- `skillLevelValue(target: string, rating: string|null): number|null` —
  implements the table above; returns `null` for DNO/unrated (a gap). This is
  the semantic core and is exhaustively unit-tested.
- `competencyRadars(session, paddlerId): Array<{ category: string, skills:
  Array<{ id: string, name: string, level: number|null }> }>` — the paddler's
  **non-optional** skills for their target level, grouped by category in skills
  order, each skill carrying its `skillLevelValue`. Categories preserve first-seen
  order. Consumers decide radar vs fallback by `skills.length`.

Reuses existing helpers (`skillById`/`skillLabel`, the paddler's `target`, and
the session `results`). Optional skills and skills for other levels are excluded
(mirrors `paddlerSummary`'s core filtering).

### 2. `src/lib/radar-geometry.js` (new) — geometry (pure)

- `radarPoints(values: Array<number|null>, opts: { cx, cy, r, max }):
  Array<{ x, y } | null>` — evenly spaces `values.length` spokes around the
  circle (first spoke at 12 o'clock), placing each point at radius
  `r * (value / max)`; a `null` value → `null` (rendered as a gap/center mark).
- `ringPolygonPoints(level, { cx, cy, r, max, count }): string` — the SVG
  `points` string for the concentric ring at a given level, for `count` spokes.

`max` = 5.5 (top of the scale, allowing L5 Exceeds = 5½ to reach the edge); rings
drawn at 1,2,3,4,5. Pure math, unit-tested; no DOM.

### 3. `src/components/CompetencyRadar.jsx` (new) — one category (thin view)

Props: `{ category, skills }`. If `skills.length >= 3`, render an SVG radar
(rings at L1–L5, one labeled spoke per skill, a filled polygon through the
points, gaps for `null`); else render the compact labeled level readout. Skills
colored per the category's color. Named export, no default.

### 4. `src/components/CompetencyRadars.jsx` (new) — all of a paddler's radars

Props: `{ session, paddlerId }`. Calls `competencyRadars`, renders a
`CompetencyRadar` per category as a small-multiples grid, with a heading per
category and a legend for the L1–L5 rings. Renders nothing if the paddler has no
core skills.

### 5. `src/screens/Review.jsx` — mount per card

Inside each paddler's card, render `<CompetencyRadars session={session}
paddlerId={paddler.id} />` (below the existing counts / below-standard detail).

### 6. `src/styles.css`

Small-multiples grid layout, radar sizing (fits phone width), ring/spoke/label
styles, category colors, and the fallback readout style.

## Data flow

Review card → `CompetencyRadars(session, paddlerId)` →
`competencyRadars` groups the paddler's core skills by category and scores each
via `skillLevelValue(target, rating)` → each category → `CompetencyRadar` →
`radarPoints`/`ringPolygonPoints` → SVG (or fallback for `<3`). All read-only
over the existing session; nothing is stored.

## Error handling / edge cases

- **DNO / unrated skill** → `skillLevelValue` returns `null` → a gap at center on
  its spoke (visible "not assessed", not silently averaged).
- **Category with < 3 skills** → labeled level readout instead of a radar.
- **Paddler with no core skills** (shouldn't happen for a valid target) →
  `CompetencyRadars` renders nothing.
- **Exceeds at L5** → 5½, capped by `max = 5.5` so it reaches the rim.
- **L1/L2 combined session** → each paddler's radars use *their own* target
  level's skills and scale (an L1 paddler gets L1 categories/Pass-No scaling; an
  L2 paddler gets the L2 categories and below/l1/meets/exceeds scaling).
- Unknown target / unknown rating value → `targetLevelNum` 0 / `skillLevelValue`
  treats an unrecognized rating as a gap (`null`), never throws.

## Testing

- **Unit — `competency.js`:** `targetLevelNum` for L1–L5 and unknown;
  `skillLevelValue` for every row of the table (L3/L4/L5 below/meets/exceeds →
  T−1/T/T+½; L2 below/l1/meets/exceeds → 0/1/2/2½; L1 no/pass → 0/1; dno & null →
  `null`); `competencyRadars` groups a fixture paddler's core skills by category,
  excludes optional and other-level skills, preserves order, and carries `null`
  for unrated skills.
- **Unit — `radar-geometry.js`:** `radarPoints` returns one entry per value with
  the first spoke at 12 o'clock, radius proportional to `value/max`, and `null`
  passthrough for gaps; `ringPolygonPoints` yields `count` vertices for a ring.
- **Thin views** (`CompetencyRadar`, `CompetencyRadars`, `Review`) — not
  unit-tested by rendering (node env, no DOM). Verified by the lib tests plus a
  manual check: a paddler with a spread of Below/Meets/Exceeds/DNO shows one
  radar per category with the polygon at the right rings, gaps for DNO, and the
  small-category fallback for a `<3` category.

## Out of scope (YAGNI)

- The **over-time development view** (heatmap/expanding polygons across past
  assessments) — depends on paddler identity + history (the paddler-profiles
  feature); this spec is current-session only.
- Per-spoke tap/tooltip to identify a skill by name (labels + category headings
  suffice for v1).
- Group/cross-paddler comparison (explicitly de-scoped — this is per-individual).
- Optional/"developing" skills on the radars, and any change to PDF/CSV/Pi.
- Collapsing/paginating the small-multiples (they simply stack per card).
