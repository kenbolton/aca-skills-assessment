# Contributing — Top Tips

Thanks for helping improve the coaching cues. This project welcomes contributions
to **one thing**: the **Top Tips** — short, practical cues shown under each skill
on the Rate screen, revealed a few at a time as a paddler masters them.

## What is and isn't open

- ✅ **Top Tips** (`src/data/top-tips.json`) — original coaching cues. Add,
  improve, reorder. **This is what to contribute.**
- ⛔ **ACA skills, standards, and criteria** (`src/data/skills*.json`) — these are
  reproduced **verbatim** from the American Canoe Association's documents and are
  the ACA's work, not this project's. Do not edit them here. See
  [Attribution](README.md#attribution).

## The file

All tips live in **`src/data/top-tips.json`**:

```jsonc
{
  "l2-forward": [
    { "id": "f1", "text": "Sit tall and relax your grip." },
    { "id": "f2", "text": "Power comes from torso rotation, not the arms." }
  ]
}
```

- **Key** = a skill `id` from `src/data/skills*.json` (e.g. `l2-forward`,
  `l3-rescues-and-towing-01`). A skill with no entry simply shows no panel, so
  any level and any skill is fair game.
- **Order = reveal order.** Learners see the top four unchecked cues; each check
  reveals the next. Put the most important cues first. **Four to six per skill**
  is a good target — working memory holds about four at once.
- **Keep each cue short and actionable** — one idea, plain imperative voice,
  glanceable from a phone on the water.

## The one rule that matters: stable ids

Each tip's `id` is what a paddler's saved "mastered" checks point to.

- ✅ Reorder the array freely — order is only the display order.
- ✅ A new tip gets a **new id that is unique within that skill** (any short
  string; the existing files use `f1`, `s2`, `w3`, but anything works).
- ⛔ **Never rename or reuse an existing tip's `id`.** Changing an id orphans the
  progress people have already saved against it.

## Finding a skill id

Skill ids are the `id` fields in `src/data/skills.json` (L1 and L2) and
`skills-l3.json` / `skills-l4.json` / `skills-l5.json`. Search a file for the
skill name to find its id.

## Test before you open a PR

```bash
npm install
npm test
```

`tests/top-tips-data.test.js` validates the file — it rejects an unknown skill
id, a duplicate tip id, a missing id, and empty text. The same suite runs on
deploy, so a valid file is required to ship.

## Submitting

Open a pull request against `main`. Small, focused PRs (one skill or a few) are
easiest to review. Tips are original content and ship in both the public and
self-hosted builds.
