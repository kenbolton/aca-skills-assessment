# Unified L1/L2 Per-Candidate Assessment with Landing — Design

**Date:** 2026-07-05
**Status:** Approved design → ready for implementation plan
**Repo:** kenbolton/aca-skills-assessment
**Supersedes:** the per-level "pick one level" model (v2). This is the **v3**
assessment core.

## Problem

An instructor assesses a mixed group in one session — e.g. three candidates, two
targeting **L2 (Essentials of Kayak Touring)** and one targeting **L1
(Introduction to Kayaking)**. At the end, each candidate must be told **where they
land**. Passing L1 while going for L2 is a fine outcome; missing an L2 skill is not
the same as failing L1. So the app must (a) assess a mixed group in one pass, and
(b) compute each candidate's achieved level.

## Model overview

- A session has up to 5 paddlers; **each paddler is assigned a target level (L1 or
  L2)** at setup (replacing the single session-level dropdown).
- **One combined skill list**, ordered progressively (dry boat-handling → rescues),
  interleaving L1 and L2 items by theme. Each skill is tagged `level: 'L1' | 'L2'`.
- Each candidate is rated **only on skills whose level matches their target**.
- Each L2 skill that has an L1 equivalent carries an **`l1Standard`** (the L1
  standard copy) and gains an **"L1" rating tier** — "met the L1 bar, not the L2
  bar." This is what lets an L2 assessment reveal an L1 landing.
- At review, each candidate gets a computed **landing**: `L2`, `L1`,
  `did_not_meet_L1`, or `pending`.

This replaces the v2 per-level flow entirely. The Pi-only teaching lessons and
past-assessments page carry over unchanged (with a backward-compat note below).

## Data model (v3)

`src/data/skills.json` restructures from `{ levels: [...] }` to:

```jsonc
{
  "scales": {
    "L1": [
      { "value": "no",   "label": "No",              "requiresFeedback": true },
      { "value": "pass", "label": "Pass" },
      { "value": "dno",  "label": "Did Not Observe" }
    ],
    "L2": [
      { "value": "below",   "label": "Below",   "requiresFeedback": true },
      { "value": "l1",      "label": "L1",      "requiresFeedback": true, "dualOnly": true },
      { "value": "meets",   "label": "Meets" },
      { "value": "exceeds", "label": "Exceeds" }
    ]
  },
  "skills": [
    { "id", "level": "L1"|"L2", "category", "name", "standard",
      "l1Standard"?, "optional"? }
    // one flat, progressively-ordered array (dry -> wet), L1 and L2 interleaved
  ]
}
```

- `l1Standard` is present only on L2 skills that have an L1 equivalent ("dual"
  skills). It is the L1 standard copy shown alongside the L2 standard.
- **Per-skill rating options** are derived:
  - `level === 'L1'` → `scales.L1` (No/Pass/Did Not Observe).
  - `level === 'L2'` and **no** `l1Standard` → `scales.L2` minus the `dualOnly`
    `l1` option (Below/Meets/Exceeds).
  - `level === 'L2'` **with** `l1Standard` → full `scales.L2`
    (Below/L1/Meets/Exceeds).
- The **L2↔L1 equivalence + L1 copy is seed data** to be confirmed by Ken (like
  the original skills list). Draft duals (~15): Forward Paddling↔"forward, straight
  line", Reverse↔"reverse", Stopping↔"stop", Draw↔"draw sideways", Sweep/Turning↔L1
  turning, Wet Exit↔"wet exit", Assisted Rescue↔"re-entry/re-mount", Swim
  Rescue↔"swim with equipment", Swimmer Tows↔"swimmer tow options", Move Capsized↔
  "bumping/bulldozing", Launch/Land↔L1 launch+land, Lift & Carry↔"lift & carry",
  Secure to Rack↔"secure for transport", Float Plan↔"float plan knowledge",
  Cold-Water/Thermal↔"cold water / thermal", Equipment↔"equipment knowledge",
  Nautical Rules↔"navigational rules", Awareness↔"group awareness",
  Signaling↔"communication signals", Forecasts↔"weather & hazards". L2-only (no
  L1 tier): ruddering, all edging/bracing, chart use, compass, route finding,
  trip-planning items, comm device, kayak-knowledge.

## Types

```ts
type Target = 'L1' | 'L2';
type ScaleOption = { value: string; label: string; requiresFeedback: boolean; dualOnly?: boolean };
type Skill = { id: string; level: Target; category: string; name: string;
               standard: string; l1Standard?: string; optional: boolean };
type Paddler = { id: string; name: string; target: Target };
type SkillResult = { paddlerId: string; skillId: string; rating: string | null; feedback: string };
type Landing = 'L2' | 'L1' | 'did_not_meet_L1' | 'pending';
type Session = {
  id: string; createdAt: string; location: string;
  scales: { L1: ScaleOption[]; L2: ScaleOption[] };
  paddlers: Paddler[];        // each with a target
  skills: Skill[];            // the full combined ordered list (snapshot)
  results: SkillResult[];     // one per (paddler × skill where skill.level === paddler.target)
};
```

- `createSession` builds a result for each (paddler, skill) pair **where
  `skill.level === paddler.target`** — a candidate is never rated on the other
  level's skills.
- `optionsForSkill(session, skill)` returns the derived option list (above).
- No single `levelId`/`scale` on the session anymore.

## Landing computation

`landingFor(session, paddlerId): { landing: Landing, ... }` per the approved rules.

Let `req` = the paddler's core (non-optional) results.

- **Pending** if any `req` result is unrated (`rating === null`) or, for L1
  candidates, `dno` (Did Not Observe = not yet assessed). Report the count.
- **L1 candidate** (target L1), once not pending:
  - `L1` if every `req` rating is `pass`.
  - else `did_not_meet_L1` (some `no`).
- **L2 candidate** (target L2), once not pending:
  - `L2` if every `req` rating is `meets` or `exceeds`.
  - else `L1` if **no dual-standard skill** (skill has `l1Standard`) is rated
    `below`. (Every L1-equivalent skill is `l1`/`meets`/`exceeds`; L2-only `below`s
    and any `l1` marks are why they are not L2, but they cleared L1 everywhere it
    applies.)
  - else `did_not_meet_L1` (a dual-standard skill is `below`).

The review surfaces the **evidence**: for L2 candidates, the list of `below`
skills (blocked L2/L1) and `l1` skills (met L1 not L2); for L1 candidates, the
`no` skills.

## Validation

`resultNeedsFeedback(session, result)`: true when the rating's option has
`requiresFeedback` (now `no`, `below`, **and** `l1`) and feedback is blank —
unchanged mechanism, driven by the per-skill option's `requiresFeedback`.
Optional skills never require feedback. `isSessionComplete`: every core result
rated (non-null; `dno` counts as rated for L1 completeness but yields `pending`
landing — see above).

## Screens

- **Setup:** the single Level dropdown becomes a **per-paddler target selector**.
  Each paddler row: name + an L1/L2 choice (default L2). At least one named
  paddler required, as today.
- **Rate:** walks the combined ordered skill list. For each skill, render rows
  **only for paddlers whose `target === skill.level`** (a skill with no matching
  candidate is skipped/greyed). Header shows the skill's standard; for dual L2
  skills, also the `l1Standard` copy labelled "L1 standard". Chips come from
  `optionsForSkill`. Feedback box enforced on any `requiresFeedback` rating
  (`no`, `below`, `l1`). Progress counts core skills fully rated for the
  candidates they apply to.
- **Review:** per candidate, show the **landing** prominently (badge: L2 / L1 /
  Did not meet L1 / Pending N) with the supporting breakdown (below list, L1-tier
  list, or No list) and counts. PDF and CSV include each candidate's **target**
  and **landing**.

## Exports & backward compatibility

- CSV adds `Target` and `Landing` columns; the per-paddler PDF states target +
  landing + the breakdown.
- **Past-assessments page (Pi):** old archived sessions are in the v2 shape
  (single `levelId`/`levelName`, no per-paddler target). `sessionSummary` and the
  `/sessions` list must **degrade gracefully** for v2 sessions: show the level and
  participants, and a blank/"—" landing (landing is a v3 concept). New v3 sessions
  show per-candidate landing. No migration of old files.
- The single active-session `localStorage` entry: if a stored session is v2-shaped
  on load after upgrade, `loadSession` discards it (returns null) rather than
  rendering a broken screen — the instructor starts fresh. (v2→v3 in-progress
  sessions are not migrated.)

## Testing

- **Unit:** `optionsForSkill` (three cases); `createSession` builds results only
  for matching level; `landingFor` across the full truth table (L2 all-meets→L2;
  L2 with an `l1`→L1; L2 with a dual `below`→did_not_meet_L1; L2 with only an
  L2-only `below`→L1; L1 all-pass→L1; L1 with a `no`→did_not_meet_L1; any
  unrated→pending); validation feedback required on `l1`; CSV includes
  target/landing; `sessionSummary` degrades on a v2-shaped session.
- **Manual:** a 3-paddler mixed session (2×L2, 1×L1); rate through the interleaved
  list; one L2 candidate marked `l1` on a dual skill and `below` on an L2-only
  skill → lands **L1**; another marked `below` on a dual skill → **did not meet
  L1**; the L1 candidate all `pass` → **L1**. Export PDF/CSV; sync to Pi; verify
  the `/sessions` page shows both old (v2) and new (v3) sessions.

## Open items for Ken

- Confirm the **L2↔L1 dual mapping and the `l1Standard` copy** for each dual skill
  (seed provided; correct against the official L1 sheet).
- Confirm the **combined interleaved order** (dry → wet; L1 and L2 items adjacent
  by theme) — proposed by me, yours to reorder.
- Confirm **Did Not Observe** on an L1 candidate yields `pending` (not a pass/fail).
