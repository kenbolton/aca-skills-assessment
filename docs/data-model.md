# ACA Skills Assessment — Data Model (authoritative)

Single source of truth for the `skills*.json` shape and the `skills.js` /
`session.js` / `store.js` / `landing.js` / `validation.js` / `summary.js`
contracts. Rating values are per-level scale `value` strings.

The official ACA L1 and L2 assessments share **no skills** and use **different
rating scales**; L2 also has **optional "developing" skills** that never count
against a paddler. L1 and L2 live together in `skills.json` and are assessed
**combined**, with a cross-level landing. L3, L4, and L5 each have their own file
(`skills-l3.json` / `skills-l4.json` / `skills-l5.json`) and are **standalone**
single-level assessments.

## skills.json shape (flat)

```jsonc
{
  "scales": {                              // one entry per level in this file
    "L1": [
      { "value": "no",   "label": "No",              "requiresFeedback": true },
      { "value": "pass", "label": "Pass" },
      { "value": "dno",  "label": "Did Not Observe" }
    ],
    "L2": [
      { "value": "below",   "label": "Below",   "requiresFeedback": true },
      { "value": "l1",      "label": "L1",       "requiresFeedback": true, "dualOnly": true },
      { "value": "meets",   "label": "Meets" },
      { "value": "exceeds", "label": "Exceeds" },
      { "value": "dno",     "label": "DNO" }
    ]
  },
  "intro": {                               // optional per-assessment intro page
    "title": "…",
    "sections": [ { "heading": "…", "body": "…", "items": ["…"], "link": { "href", "label" } } ]
  },
  "skills": [                              // flat list; each skill names its level + category
    { "id": "l1-…", "level": "L1", "category": "Preparing to Depart",
      "name": "…", "standard": "…", "optional": false }
  ]
}
```

- `skill.id` is unique across **all** files.
- `skill.optional` defaults to `false` when absent.
- A scale option with `requiresFeedback: true` is the "below standard" band (it
  forces a written note). `dualOnly: true` marks a cross-level landing option
  (the L2 "l1" value: the paddler met L1 but not L2).
- L3–L5 skills often carry only `standard` (used as the on-screen item) plus
  optional `competency`, `l1Standard`, `exceedsStandard`, `belowStandard`.

## Types

```ts
type ScaleOption = { value: string; label: string;
                     requiresFeedback: boolean; dualOnly?: boolean };
type FlatSkill   = { id: string; level: string; category: string;
                     standard: string; optional: boolean;
                     name?: string; competency?: string; l1Standard?: string;
                     exceedsStandard?: string; belowStandard?: string };
type Config      = { scales: Record<string, ScaleOption[]>;   // keyed by level id
                     skills: FlatSkill[]; intro?: Intro };
type Paddler     = { id: string; name: string; target: string };  // target = level id
type SkillResult = { paddlerId: string; skillId: string;
                     rating: string | null; feedback: string };
type Session     = { id: string; createdAt: string; location: string;
                     conditions: Record<string,string>; selfAssessment: boolean;
                     scales: Record<string, ScaleOption[]>; intro: Intro | null;
                     paddlers: Paddler[]; skills: FlatSkill[];
                     results: SkillResult[];
                     actionPlans: Record<string, string> };  // keyed by paddlerId
```

- A session carries **per-paddler `target`**. In an L1/L2 session, paddlers may
  target different levels; a paddler has results only for skills whose
  `level === paddler.target`. In an L3/L4/L5 session every paddler shares the one
  level.
- `selfAssessment` marks a single-paddler self-review (never an ACA assessment).

## src/lib/skills.js

- `loadConfig(raw): Config` — validates and normalizes. Reads `raw.scales`
  (per-level option arrays) and the flat `raw.skills` array; carries `raw.intro`
  through when present. Throws with a clear message when: `scales` defines no
  level; a level scale is not a non-empty array or an option lacks `value`/
  `label`; `skills` is empty; a skill lacks `id`/`category`/`standard`, has an
  unknown `level`, or a duplicate `id`. Normalizes `requiresFeedback`/`optional`
  to booleans.
- `skillLabel(skill): string` — `skill.name` when present, else `skill.standard`.
- `allSkills(config): FlatSkill[]`.
- `optionsForSkill(config, skill): ScaleOption[]` — the scale for the skill's
  level.

## src/lib/session.js

- `createSession({ id, createdAt, config, location, conditions, paddlers, selfAssessment }): Session`
  - `paddlers`: `{ name, target }[]` in → trimmed non-empty → `{ id, name, target }`.
  - `results`: one `{ paddlerId, skillId, rating: null, feedback: '' }` per
    (paddler × skill where `skill.level === paddler.target`).
  - snapshots `config.scales`, `config.skills`, and `config.intro`.
- `getResult` / `skillById` / `optionsForSkillInSession(session, skill)` /
  `optionFor(session, skill, rating)`.
- `setRating(session, paddlerId, skillId, rating): Session` — a note attached to
  a skill is preserved when the rating changes.
- `setFeedback(session, paddlerId, skillId, feedback): Session`.
- `getActionPlan(session, paddlerId)` / `setActionPlan(session, paddlerId, text)`
  — a per-paddler return recommendation (kept in `actionPlans`).
- `isV3Session(s)` — a v3 session has per-paddler `target`.
- `saveSession` / `loadSession` / `clearSession` — a **legacy** single-session
  localStorage key (`aca-assessment:session`); the durable archive is `store.js`.
- No mutation: every updater returns a new session.

## src/lib/store.js — persistence

The archive is the single source of truth, in **IndexedDB** (database
`aca-assessment`):

- object store `sessions`, keyPath `id` — every session, including the open one.
- object store `skillSets`, keyPath `ref` — the shared skill list is stripped out
  and de-duplicated across sessions (a session is stored "slim" with a
  `skillSetRef`, then re-hydrated on read).
- localStorage `aca-assessment:current` — a tiny "which session is open" pointer.
- localStorage `aca-assessment:session` — the legacy single-session key, drained
  into the archive by `migrateLegacy()` on boot.

Key functions: `putSession` / `getSession` / `deleteSession` / `getAllSessions` /
`listSummaries` / `exportBundle` / `importBundle` / `getCurrentId` /
`setCurrentId` / `initStore`.

## src/lib/landing.js

- `landingFor(session, paddlerId): { landing, pendingCount, belowCount? }`.
- `landing` values: `pending` (a required skill unrated or DNO);
  standalone L3–L5 → `meets_level` / `below_level`;
  combined L1/L2 → `L1`, `L2`, or `did_not_meet_L1`.
- `STANDALONE_LEVELS = ['L3','L4','L5']`.

## src/lib/validation.js

- `skillStatus(session, skill)` — per-skill progress marker (done/warn/dno/todo).
- `resultNeedsFeedback(session, result): boolean` — `true` iff the skill is
  **not** optional AND its rating's option has `requiresFeedback` AND the
  feedback is blank.
- `invalidResults(session): SkillResult[]` — results needing feedback.
- `isSessionComplete(session): boolean` — every core (non-optional) result has a
  rating AND `invalidResults` is empty. Optional skills never block completeness.

## src/lib/summary.js

- `paddlerSummary(session, paddlerId): PaddlerSummary`

```ts
type PaddlerSummary = {
  name: string;
  target: string;                          // the paddler's level
  landing: string; passing: boolean;       // from landing.js
  pendingCount: number; belowCount: number;
  coreTotal: number;                       // # non-optional skills for this paddler
  counts: Record<string, number>;          // per scale value, CORE skills only
  unrated: number;                         // CORE skills with null rating
  flagged: SummaryItem[];                  // CORE below-standard items (requiresFeedback), with feedback
  optionalItems: SummaryItem[];            // optional skills that were rated
};
```

- `counts` is keyed by each scale option `value`; a value with zero core results
  still appears with `0`.
- `belowItems` = core skills whose rating maps to a `requiresFeedback` option
  (the "must fix"/"did not meet" list), with feedback.
- Optional skills are summarized separately and never appear in `belowItems`,
  `counts`, or `unrated`.

## Downstream (Tasks 6–12) deltas from the original plan

- **CSV (Task 6):** columns `Level,Paddler,Category,Skill,Optional,Rating,Feedback`.
  `Rating` is the scale `label` (e.g. "Below"), empty when null. `Optional` is
  `yes`/``.
- **Setup (Task 7):** level `<select>` built from `levelIds(config)` /
  `getLevel().name`.
- **Rate (Task 8):** chips built from `session.scale` (label per option). The
  category `competency` shows above the skill when present. Optional skills show
  an "Optional — does not count" badge and never block navigation. The
  requiresFeedback option triggers the inline feedback box.
- **Review/PDF (Task 9):** show `counts` per scale label, the `belowItems` list
  with feedback, and an "Optional skills assessed" subsection. PDF title uses
  `levelName`.
- Tasks 10 (sync), 11 (PWA), 12 (Pi) are unchanged by v2.

## Learning overlays (read-only, additive)

These sit beside `skills*.json` so the ACA standard text stays verbatim.

- `src/data/progression.json` — strands and prerequisites per skill:
  `{ version, strands: { key: {name,order} }, skills: { skillId: {strand,stage,prereqs[]} } }`.
  Prerequisites use `precedes`-style edges; most skills are parallel (empty
  `prereqs`). Read via `src/lib/progression.js`.
- `src/data/plain-language.json` — `{ skillId: "gloss" }`, a learner-facing
  restatement of a skill. Never the official standard. Read via
  `src/lib/plain-language.js`.

## Learner model (derived, not stored)

`src/lib/learner.js` groups the archive by normalized paddler name and computes,
per learner, a per-skill history, current mastery (latest rating wins), skills
newly met, the working edge (via the progression), and spaced re-checks due
(`src/lib/recheck.js`). It is **pure aggregation over existing sessions** — no
new storage, nothing uploaded.

## Top Tips storage (IndexedDB v3)

`store.js` bumps the IndexedDB schema to **version 3** and adds a `tipChecks`
object store, keyed by `learnerKey` (the paddler name, normalized: trimmed,
whitespace-collapsed, lowercased).

```ts
type TipChecks = { learnerKey: string; checks: { [skillId: string]: string[] } };
```

- `checks[skillId]` is the list of mastered tip ids for that skill.
- Progress is per learner **across sessions** — it is not part of a session
  record and is never synced to the server.
- Tip content lives in `src/data/top-tips.json` as `{ [skillId]: {id,text}[] }`,
  an ordered list; checks reference the stable tip `id`, not an array position.
