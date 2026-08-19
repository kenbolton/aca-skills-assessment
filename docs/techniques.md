# Top Tips — the technique model

**Status:** the model is in place; the *taxonomy* is provisional and being
developed. This doc captures how it works and the open questions, so the set of
techniques can grow deliberately.

## Why techniques, not per-level skills

A paddling **technique** is universal — a forward stroke is the same motor skill
whether you paddle it in L1 flat water or L4 open water. What changes between
levels is the **conditions** (wave height, current and wind velocity; distance
from shore for L5), not the technique.

So cues attach to a **technique** and are authored **once**, then applied at every
level where the technique appears. Two axes, kept separate:

- **Technique** — *what* you do (forward stroke, wet exit). Universal.
- **Level / conditions** — *where* you do it. Supplies difficulty, not new cues.

## The files

| File | Shape | Role |
|------|-------|------|
| `src/data/techniques.json` | `{ "forward-stroke": { "name": "Forward Stroke" } }` | the technique catalogue |
| `src/data/skill-techniques.json` | `{ "l2-forward": "forward-stroke", … }` | maps each ACA skill to its technique |
| `src/data/top-tips.json` | `{ "forward-stroke": [ { "id", "text" } ] }` | the cues, keyed by technique |
| `src/data/retired-tip-ids.json` | `{ "forward-stroke": ["f12"] }` | ids that must never return |

`tipsFor(skillId)` resolves *skill → technique → cues*, so the Rate panel and
the Review/Journey preview work off a skill id without knowing about techniques.
Mastery is stored **per technique**, so mastering a cue at one level counts at
every level.

The Skills & Tips home is the exception: it lists **techniques**, not skills, and
shows no level at all. Listing skills there would repeat one cue set under every
level that examines it — three "Stopping" rows whose counters all move together,
because mastery is per technique. Level says where a technique is assessed, which
is the assessment screens' job; they already know the level.

## Order is a readiness ladder

Within a technique the cue **order** is developmental: the foundational cue a
beginner needs is first; the hard-won insight that only lands once you've felt,
say, 25 knots of wind against 3 knots of current is last. The app reveals the top
few unmastered cues and a paddler *earns* the later ones by mastering the
earlier. No per-cue "level" tag is needed — the order carries it, and the
progressive reveal is the gate.

How many cues "the top few" means is the paddler's own call: the **whelm meter**
in the Top Tips header runs over (5) → mid (4) → under (3). It is device-wide
(`src/lib/whelm.js`), like tip progress, and defaults to mid.

## Current state

Twelve techniques cover the core boat-handling skills of L1, L2 and L3. Each is
mapped to every level that examines it, which is what makes the cues reusable:

| Technique | Mapped ACA skills |
|-----------|-------------------|
| **stopping** | `l1-stop`, `l2-stopping`, `l3-strokes-and-maneuvers-03` |
| **reverse-stroke** | `l1-reverse`, `l2-reverse`, `l3-strokes-and-maneuvers-02` |
| **draw** | `l1-draw`, `l2-draw`, `l3-strokes-and-maneuvers-07` |
| **spinning** | `l1-turn-stationary`, `l2-rotate-360`, `l3-strokes-and-maneuvers-05` |
| **turning-on-the-move** | `l1-turn-moving`, `l2-turning-move`, `l3-strokes-and-maneuvers-06` |
| **wet-exit** | `l1-wet-exit`, `l2-wet-exit`, `l3-rescues-and-towing-01` |
| **forward-stroke** | `l2-forward`, `l3-strokes-and-maneuvers-01` |
| **sweep** | `l2-sweep`, `l3-strokes-and-maneuvers-04` |
| **stern-rudder** | `l2-stern-rudder`, `l2-stern-rudder-away`, `l3-strokes-and-maneuvers-09` |
| **low-brace-recovery** | `l2-low-brace-recovery`, `l3-edging-and-support-01` |
| **low-brace-turn** | `l2-low-brace-turn`, `l3-edging-and-support-02` |
| **edge-control** | `l2-edge-control`, `l2-turn-control`, `l3-edging-and-support-03` |

Three mapping calls worth recording, because they are judgment, not data:

- **Sweeps are one technique, not two.** The candidate taxonomy below lists
  `forward-sweep` and `reverse-sweep` separately, but the ACA examines them as
  one row and the cues are the same — wide arc, buried blade, edge away, look
  through the turn. One cue-set, so one technique.
- **`l3-strokes-and-maneuvers-09` is "Ruddering (Bow and Stern)"** and maps to
  `stern-rudder`. The stern-rudder cues are the bulk of it. A separate
  `bow-rudder` technique is still to write; when it exists, that skill may want
  to map to both, which the current one-technique-per-skill map cannot express.
- **`l2-turn-control`** ("vary the radius of their turns") maps to
  `edge-control` — varying the arc is an edging problem, and it sits in the
  Edging and Support category.

The map is **seed-then-refine**: seeded by matching skill names, corrected by the
instructor. Everything else is unmapped for now (an unmapped skill simply shows
no tips). Deliberately still unmapped: `l3-strokes-and-maneuvers-08` ("Draw
Sideways on the Move") — a hanging draw is a parked blade, not a repeated
stroke, so it needs its own cues rather than the static-draw set.

The gap is L4 and L5, and the knowledge strands at every level. Rolling, high
brace, the rescues, towing, surf and rock-garden handling all have no cues yet;
whether the judgment and seamanship skills get cues at all is open question 2
below.

## Principles

- **One technique = one distinct cue-set.** If two skills would share the same
  coaching cues, they are the same technique. If they'd need different cues,
  they're different techniques.
- **Partial universality is fine.** A technique appears only at the levels whose
  skills map to it. Some techniques are introduced late (rolling ≈ L4; surf and
  rock-garden handling ≈ L4/L5) and simply have no L1/L2 skills.
- **Stable keys.** A technique key is the tips key and the mastery key. Renaming
  one orphans saved progress and needs a remap — treat keys as permanent.
- **Kebab-case, human name.** Key `low-brace-turn`, name "Low Brace Turn".
- **Universal cues repeat on purpose.** "Sit up" and "rotate from the torso"
  apply to nearly every technique. Repetition across techniques is
  **reinforcement, not redundancy** — motor learning is context specific, and
  rotating in a stern rudder is not the same act as rotating in a forward
  stroke. So a universal is authored **once per technique, in that technique's
  own words**, with its own id and its own mastery state. Do not fold them into
  a shared set, and do not deduplicate them: a paddler meeting "look through the
  turn" on the sweep, the spin and the low brace turn is the point.
- **Name the transfer.** A paddler may need telling that the same thing applies
  in this new context — that is the work the repeat does. So word a universal's
  repeat to point at the context the paddler already knows: "Sit tall, the same
  as going forward" teaches more than "Sit tall" on its own.
- **Similar language, different subtleties.** Repeats read alike, and the small
  differences between them do real work on the reader. "Sit tall — the shaft is
  only vertical if you are" (draw) and "Sit tall as you turn; leaning in is not
  the same as edging" (turning on the move) are one universal, but each names
  the fault that universal prevents *here*. Write the subtlety. Never paste.
- **Retired ids stay retired.** Removing a cue does not free its id. Reusing it
  for a different idea silently transfers anyone's saved mastery from the old cue
  to the new one. Rewording the text under a stable id is different, and is the
  correct way to improve a cue. Retired ids are listed in
  `src/data/retired-tip-ids.json` and `tests/top-tips-data.test.js` fails if one
  comes back, so this rule is enforced rather than remembered.

## Open questions (to think about)

1. **Granularity.** Is `forward-stroke` one technique, or split (catch / rotation
   / exit)? Rule of thumb: split only when the cue-sets genuinely differ.
2. **Motor skill vs knowledge.** Do judgment/knowledge skills (float plan,
   forecasts, navigation, cold-water physiology) get "tips" as techniques, or are
   they out of scope for Top Tips? They have coaching value but aren't motor
   techniques.
3. **Conditions as a first-class thing.** Right now conditions live only on the
   session. Should a technique note *which* conditions raise its difficulty
   (wind-against-current, following seas, surf) — as context, not new cues?
4. **How far to map.** Which of the ~284 skills map to a shared technique, and
   which are genuinely level-specific? This is the instructor's ongoing call.
5. **A skill maps to exactly one technique.** `skill-techniques.json` is
   one-to-one, so a skill that genuinely needs two cue-sets cannot say so. Found
   when the forward stroke grew both low-angle and high-angle cues: splitting it
   would force `l2-forward` to pick one half. Resolved for now by naming the
   style inside the cue ("For a low-angle stroke, …") rather than splitting. The
   fix, when it is needed, is to let a value be a list and have `tipsFor()`
   concatenate the sets; mastery stays keyed per technique, so no migration of
   saved progress is required. Same shape of problem as cross-cutting cues.

## A candidate taxonomy (starting point, not gospel)

Grouped families to seed the thinking — refine names and membership to taste:

- **Strokes & propulsion:** forward-stroke, reverse-stroke, stopping,
  forward-sweep, reverse-sweep, draw, sculling-draw, stern-rudder, bow-rudder.
- **Edging & support:** edge-control, low-brace, high-brace, low-brace-turn,
  sculling-brace.
- **Rescues & recovery:** wet-exit, roll, assisted-rescue, self-rescue,
  swim-rescue, towing, contact-tow.
- **Maneuvering:** turning-on-the-move, spinning, ferrying, eddy-turns.
- **Rough-water (higher levels):** surf-launch-land, surf-handling,
  rock-garden-handling, following-seas.
- **Seamanship / judgment (maybe out of scope — see open question 2):**
  navigation, trip-planning, group-management, incident-management.

## Universal cue coverage

Because universals reinforce (see Principles), their coverage is a real measure
of the cue set, and it is currently uneven:

| Universal | Techniques carrying it |
|-----------|------------------------|
| posture — "sit up", "sit tall" | 3 of 12 — `forward-stroke`, `stopping`, `edge-control` |
| rotation — torso, core, wound up | 5 of 12 — `forward-stroke`, `reverse-stroke`, `sweep`, `stern-rudder`, `low-brace-turn` |

Both want seeding into the techniques that lack them. Seeding is **not**
mechanical: each cue is worded for its own technique, and some techniques do not
want a given universal at all — rotation means nothing in a wet exit. Judge one
technique at a time.

## Signals — the felt check

A cue says what to do. A **signal** says what it feels like when you are doing
it — "pressure between the knuckles of your top hand". It is a check, not an
instruction, and it rides on a cue as an optional `signal` field:

```jsonc
{ "id": "f10",
  "text": "Push, don't pull. The bottom hand gently guides the blade through the water.",
  "signal": "Pressure between the knuckles of your top hand." }
```

- **Never mastered.** A signal takes no id and no slot in the ladder. You do not
  master a sensation, you use it to check yourself. Mastery stays keyed to the
  cue's id, so adding a signal to an existing cue changes no saved progress.
- **Stays visible after mastery.** The panel keeps showing a signal once its cue
  is ticked, because a signal is what a paddler re-checks when they believe they
  already have the cue.
- **Not in the compact preview.** `SkillTipsPreview` — Review's "Start with" and
  the Journey — stays a 3-cue nudge and renders no signals.
- **Optional and sparse.** Most cues have none. Write one only where there is a
  real, checkable sensation. Inventing a feeling is the same defect as inventing
  a criterion (see below): if you cannot name what it feels like, leave the field
  out.

## Cues are instruction, not criteria

The ACA text is **assessment criteria** — it supplies the standard and the fault,
rarely the *how*. So most of a cue's content is original coaching, not a
restatement of the standard. In the draw set, for example, `dr1` traces to "the
paddle shaft is as vertical as possible" and `dr4` to "recoveries are clean",
but the rest is authored.

That is the point of Top Tips, and it carries one obligation: **do not dress an
authored cue as a standard.** Two failure modes to watch, both found in review:

- **Invented precision.** "Hold one edge for ten seconds" reads like a criterion.
  Nothing sources the ten. Write the drill, drop the fake number.
- **Contested technique stated as fact.** Coaches disagree about which way to
  edge a sideways draw, so no cue should assert one direction. Where convention
  splits, leave the cue out or write it as something to explore.

## Growing it

To add tips for a new technique:

1. Add the technique to `techniques.json` (`key` + human `name`).
2. Map the relevant ACA skills to it in `skill-techniques.json` (skill ids live
   in `skills*.json`).
3. Add the ordered cues in `top-tips.json`.

`tests/top-tips-data.test.js` validates all three — unknown technique, unknown
skill, duplicate tip id, or empty text fail the suite (and the deploy gate).

## Contributions

Tip suggestions are currently gathered **via Discord** while the taxonomy
settles. The in-app "Suggest a tip" link and `CONTRIBUTING.md` (GitHub-issue and
PR paths) still work for GitHub users; a Discord/form path for non-GitHub
contributors is a to-do (needs the invite link wired in).
