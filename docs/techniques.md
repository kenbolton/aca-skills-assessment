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

`tipsFor(skillId)` resolves *skill → technique → cues*, so the Rate panel, the
Skills & Tips home, and the Review/Journey preview all work off a skill id
without knowing about techniques. Mastery is stored **per technique**, so
mastering a cue at one level counts at every level.

## Order is a readiness ladder

Within a technique the cue **order** is developmental: the foundational cue a
beginner needs is first; the hard-won insight that only lands once you've felt,
say, 25 knots of wind against 3 knots of current is last. The app reveals the top
few unmastered cues and a paddler *earns* the later ones by mastering the
earlier. No per-cue "level" tag is needed — the order carries it, and the
progressive reveal is the gate.

## Current state

Three techniques, with a seeded map proving cross-level reuse:

- **forward-stroke** ← `l2-forward`, `l3-strokes-and-maneuvers-01`
- **stopping** ← `l1-stop`, `l2-stopping`, `l3-strokes-and-maneuvers-03`
- **wet-exit** ← `l1-wet-exit`, `l2-wet-exit`, `l3-rescues-and-towing-01`

The map is **seed-then-refine**: seeded by matching skill names, corrected by the
instructor. Everything else is unmapped for now (an unmapped skill simply shows
no tips).

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
