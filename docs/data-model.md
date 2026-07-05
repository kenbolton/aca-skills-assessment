# ACA Skills Assessment — Data Model v2 (authoritative)

Supersedes the flat-skill model in Tasks 2–4 of the original plan. Reason: the
official ACA L1 and L2 assessments share **no skills** and use **different
rating scales**, and L2 has **optional "Developing" skills** that must never
count against a paddler. This document is the single source of truth for the
`skills.json` shape and the `skills.js` / `session.js` / `validation.js` /
`summary.js` contracts. Rating values are per-level scale `value` strings.

## skills.json shape

```jsonc
{
  "_source": "…provenance…",
  "levels": [
    {
      "id": "L1",                       // string, unique
      "name": "Level 1: Introduction to Kayaking",
      "note": "…optional level-wide note…",
      "scale": [                        // ordered, worst → best for display
        { "value": "no",   "label": "No",              "requiresFeedback": true },
        { "value": "pass", "label": "Pass" },
        { "value": "dno",  "label": "Did Not Observe" }
      ],
      "categories": [
        {
          "name": "Preparing to Depart",
          "competency": "…optional category competency statement…",
          "skills": [
            { "id": "l1-…", "name": "…", "standard": "…", "optional": false }
          ]
        }
      ]
    }
  ]
}
```

- `skill.id` is unique across **all** levels.
- `skill.optional` defaults to `false` when absent.
- Exactly one scale option per level SHOULD have `requiresFeedback: true` (the
  "below standard" band). Loader does not enforce count, but treats missing
  `requiresFeedback` as `false`.

## Types

```ts
type ScaleOption = { value: string; label: string; requiresFeedback: boolean };
type FlatSkill   = { id: string; name: string; standard: string;
                     optional: boolean; category: string; competency: string };
type Level       = { id: string; name: string; note: string;
                     scale: ScaleOption[]; categories: Category[] };
type Config      = { levels: Level[] };
type SkillResult = { paddlerId: string; skillId: string;
                     rating: string | null; feedback: string };
type Session     = { id: string; createdAt: string; levelId: string;
                     levelName: string; location: string;
                     scale: ScaleOption[]; paddlers: {id,name}[];
                     skills: FlatSkill[]; results: SkillResult[];
                     syncedAt?: string };
```

## src/lib/skills.js

- `loadConfig(raw): Config` — validates and normalizes. Throws `Error` with a
  clear message when: `raw.levels` is not a non-empty array; a level is missing
  `id`/`name`; a level `scale` is not a non-empty array or an option is missing
  `value`/`label`; `categories` is not an array; a skill is missing
  `id`/`name`/`standard`; or a `skill.id` is duplicated across the whole config.
  Normalizes each option's `requiresFeedback` to boolean and each skill's
  `optional` to boolean; fills `note`/`competency` with `''` when absent.
- `levelIds(config): string[]` — e.g. `['L1','L2']`.
- `getLevel(config, levelId): Level | undefined`.
- `scaleForLevel(config, levelId): ScaleOption[]` — `[]` if level not found.
- `skillsForLevel(config, levelId): FlatSkill[]` — categories flattened in
  order; each skill carries its `category` and the category's `competency`.

## src/lib/session.js

- `createSession({ id, createdAt, config, levelId, location = '', paddlerNames }): Session`
  - `paddlers`: trimmed non-empty names → `{ id, name }` (ids from an internal
    counter, as in v1).
  - `skills`: `skillsForLevel(config, levelId)` snapshot.
  - `scale`: `scaleForLevel(config, levelId)` snapshot.
  - `levelName`: the level's `name`.
  - `results`: one `{ paddlerId, skillId, rating: null, feedback: '' }` per
    (paddler × snapshot skill).
- `getResult(session, paddlerId, skillId): SkillResult | undefined`.
- `skillById(session, skillId): FlatSkill | undefined`.
- `optionFor(session, rating): ScaleOption | undefined` — find in `session.scale`.
- `setRating(session, paddlerId, skillId, rating): Session` — new session; if the
  new rating's option is absent or has `requiresFeedback === false`, clear that
  result's `feedback` to `''`. (Feedback is retained only for a
  `requiresFeedback` option.)
- `setFeedback(session, paddlerId, skillId, feedback): Session` — new session.
- `saveSession/loadSession/clearSession` — localStorage key `aca-assessment:session`.
- No mutation: every updater returns a new session; nested `results` entries are
  replaced, not mutated.

## src/lib/validation.js

- `resultNeedsFeedback(session, result): boolean` — `true` iff the result's
  skill is **not** optional AND `optionFor(session, result.rating)` has
  `requiresFeedback === true` AND `result.feedback.trim() === ''`.
- `invalidResults(session): SkillResult[]` — results where `resultNeedsFeedback`.
- `isSessionComplete(session): boolean` — every **core** (non-optional) result
  has a non-null rating AND `invalidResults(session).length === 0`. Optional
  skills may remain unrated and never block completeness.

## src/lib/summary.js

- `paddlerSummary(session, paddlerId): PaddlerSummary`

```ts
type SummaryItem = { skillId, name, category, rating, feedback };
type PaddlerSummary = {
  name: string;
  levelId: string; levelName: string;
  scale: ScaleOption[];
  coreTotal: number;                      // # non-optional skills
  counts: Record<string, number>;         // per scale value, CORE skills only
  unrated: number;                        // CORE skills with null rating
  belowItems: SummaryItem[];              // CORE skills whose rating requiresFeedback
  optionalAssessed: number;               // optional skills with non-null rating
  optionalItems: SummaryItem[];           // optional skills that were rated (any value)
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
