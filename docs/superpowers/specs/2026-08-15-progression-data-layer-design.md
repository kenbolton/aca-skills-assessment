# Progression Data Layer (L2 slice) — Design

**Date:** 2026-08-15
**Status:** Approved design → ready for implementation plan
**Repo:** kenbolton/aca-skills-assessment (indie project)
**Branch:** worktree-pedagogy-redesign

## Summary

This is sub-project 1 of a larger pedagogical redesign. It turns the flat L2
skill list into a machine-readable **progression**: strands with prerequisite
order. It seeds the progression from the current structure, lets the instructor
refine it as data, and validates it with tests. It then uses the progression for
one visible formative move on the Review screen.

The wider redesign reframes the app as a learning loop — assess → feedback →
practice → reassess — grounded in three ideas: learning progressions with a zone
of proximal development (Vygotsky), formative assessment (Wiliam), and deliberate
practice (Ericsson). This sub-project is the data foundation the rest depends on.
It ships an end-to-end slice on L2 only, so the loop is visible before it
generalizes to other levels.

Architecture decision: additive layer. The fast on-water assess flow stays
intact. The progression is a read-only overlay. No existing screen, verdict, or
stored session changes shape.

## Scope

**In scope (this increment):**

- L2 core skills only.
- A committed progression data file.
- A one-time seeding tool to bootstrap that file.
- A read API: strand lookup, prerequisite lookup, next-step, edge skills.
- One formative touchpoint on the Review screen for L2 paddlers.
- Tests for the data integrity and the read API.

**Out of scope (later sub-projects):**

- Cross-session learner model (sub-project 2).
- Reshaped feedback-for-learning Review (sub-project 3).
- Practice log and spaced re-check (sub-project 4).
- Learner-facing Journey screen (sub-project 5).
- L1 and L3–L5 progressions.
- An in-app progression editor. The instructor edits the JSON file directly.

## Global Constraints

- No new runtime dependencies. The seeding tool uses Node built-ins only.
- Offline-first and phone-first are preserved. The overlay is static data,
  precached like the rest of the app.
- The progression file is public. It encodes pedagogical grouping and order of
  the public ACA skill structure. It holds no private lesson content.
- Drill links stay gated to the private build. The formative touchpoint reuses
  the existing `lessons.json` map and the `VITE_PRIVATE` flag. The public build
  shows the prerequisite skill name with no link.
- The assess flow, landing verdicts, and stored session shape do not change.
  Older archived sessions render unchanged.
- Node ≥ 22, ES modules throughout (matches the app).

## Data model

### File: `src/data/progression.json` (new, committed, public)

```jsonc
{
  "version": 1,
  "strands": {
    "boat-control": { "name": "Boat Control", "order": 1 },
    "rescue":       { "name": "Rescue & Recovery", "order": 2 }
    // …one strand per L2 core category, in category order
  },
  "skills": {
    "l2-forward": { "strand": "boat-control", "stage": 1, "prereqs": [] },
    "l2-sweep":   { "strand": "boat-control", "stage": 2, "prereqs": ["l2-forward"] }
    // …every L2 core skill id
  }
}
```

Field meaning:

- `strand` — the developmental strand the skill belongs to. Seeded from the
  skill's category.
- `stage` — the ordinal of the skill within its strand. Seeded from the skill's
  order within its category (1-based).
- `prereqs` — skill ids that should be met before this skill. Seeded as a linear
  chain within the strand: each skill's only prerequisite is the previous stage
  in the same strand. Stage 1 skills have an empty list.

The linear seed is a deliberate first approximation, not a claim of truth. The
instructor refines `prereqs` by editing the file. This is the "seed" half of the
approved seed-then-refine method.

## Seeding tool

### File: `tools/seed-progression.mjs` (new)

Purpose: bootstrap `progression.json` once. It is not part of the runtime build.

Behavior:

1. Read `src/data/skills.json`.
2. Select L2 core skills (`level === 'L2'`, `optional !== true`), in file order.
3. Map each distinct category to a strand. Strand key is a kebab-case slug of the
   category. Strand `name` is the category text. Strand `order` follows first
   appearance.
4. Within each strand, assign `stage` by appearance order (1-based).
5. Set `prereqs` to the previous stage in the same strand, else an empty list.
6. Print the resulting JSON to stdout.

Flags:

- `--write` — write `src/data/progression.json`. Without it, the tool only
  prints, so a re-run never clobbers hand edits by accident.

The committed file is the source of truth after the first bootstrap. The tool is
kept for reference and for re-seeding a fresh level later.

## Read API

### File: `src/lib/progression.js` (new)

Imports `progression.json`. Pure functions, no side effects.

- `strandOf(skillId)` → strand object `{ key, name, order }` or `null`.
- `prereqsOf(skillId)` → array of prerequisite skill ids (empty if none/unknown).
- `startHere(session, paddlerId, skillId)` → the per-skill "start here". It walks
  the given skill's `prereqs` to the deepest prerequisite the paddler has not met
  and returns that skill. If every prerequisite is met, or the skill is absent
  from the map, it returns the given skill itself. It never throws. The Review
  touchpoint calls this once per below-standard skill.
- `nextStep(session, paddlerId)` → the single global "start here" across the
  paddler's below-standard L2 skills. It runs `startHere` for each below skill,
  then returns the result that sits earliest in progression order (lowest strand
  `order`, then lowest `stage`). Ties on both fall to first skill-id order. It
  returns `null` when no skill is below. This is the foundation-first edge of the
  zone of proximal development, used by later learner-facing sub-projects.
- `edgeSkills(session, paddlerId)` → up to 3 frontier skills: prerequisites met,
  skill not yet met. Ordered by strand order, then stage.

"Met" for L2 means a rating of `meets` or `exceeds`. "Not met" means `below`,
`l1`, unrated, or `dno`. These reuse the existing L2 scale values.

## Visible proof: Review touchpoint

Change the Review screen so each below-standard L2 skill shows a start-here line:

> **Start here:** <deepest unmet prerequisite name> · <drill link, private build>

Rules:

- Applies to L2 paddlers only this increment. Other levels render as today.
- The prerequisite name comes from `startHere(session, paddlerId, skillId)` for
  that below skill. If the start-here skill equals the below skill itself (no
  unmet prerequisite), show the skill's own name. That still tells the learner
  where to focus.
- The drill link reuses `lessons.json` and shows only on the private build, the
  same rule the existing teaching links follow. The public build shows the name
  with no link.
- This is the only UI change. It likely lives in `BelowStandardDetail.jsx`,
  which already renders per-skill below-standard detail on Review.

This one line exercises all three theories at once: progression (the strand
order), zone of proximal development (deepest unmet prerequisite), formative
feedback (a next action, not a mark), and the deliberate-practice link (the
drill).

## Error handling

- A skill absent from `progression.json` degrades: `strandOf` returns `null`,
  `prereqsOf` returns `[]`, `nextStep` returns the skill itself. No throw.
- A `prereqs` entry that references an unknown skill id is a data defect. A test
  catches it. Runtime skips it rather than throwing.
- Older sessions with no matching skills produce an empty `edgeSkills` and a
  no-op touchpoint.

## Testing

### File: `tests/progression.test.js` (new, vitest)

Data integrity:

1. Every L2 core skill id in `skills.json` has an entry in `progression.json`.
2. Every `strand` referenced by a skill exists in `strands`.
3. Every `prereqs` id references a real skill in the progression.
4. `prereqs` respect strand order: a prerequisite is in the same strand at a
   lower stage, or an earlier strand. No cycles.

Read API:

5. `startHere` returns the deepest unmet prerequisite for a constructed session.
6. `nextStep` picks the foundation-first result across several below skills, and
   returns `null` when none are below.
7. `edgeSkills` returns frontier skills only, correctly ordered.
8. A skill absent from the map degrades without throwing.

Slice lock:

9. A paddler rated `below` on a known skill yields the expected start-here id.

The existing suite stays green (125 tests). The new file adds ~9 tests.

## Files

New:

- `src/data/progression.json`
- `tools/seed-progression.mjs`
- `src/lib/progression.js`
- `tests/progression.test.js`

Edit:

- `src/screens/Review.jsx` and/or `src/components/BelowStandardDetail.jsx`
  (render the start-here line).

## Build order

1. Seeding tool → generate the draft data file.
2. Hand-check the data file (instructor pass on strands and prereqs).
3. Read API + its tests.
4. Review touchpoint + slice-lock test.
