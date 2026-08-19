# Contributing — Top Tips

Thanks for helping improve the coaching cues. This project welcomes contributions
to **one thing**: the **Top Tips** — short, practical cues shown where a paddler
is working a skill, revealed a few at a time as they master them.

## Easiest way: Discord — no GitHub account needed

Just have a cue in mind? Post it in the **#top-tips** channel on Discord:
**<https://discord.gg/65QRCEbwX4>**. Say which skill it's for and, if you can,
whether it's a beginner cue or one for harder conditions. The maintainer keys it
to a technique and adds it. The rest of this guide is for editing the data
directly via a GitHub pull request, if you prefer.

## What is and isn't open

- ✅ **Top Tips** (`src/data/top-tips.json`) and the **skill→technique map**
  (`src/data/skill-techniques.json`) — original coaching content. **This is what
  to contribute.**
- ⛔ **ACA skills, standards, and criteria** (`src/data/skills*.json`) — these are
  reproduced **verbatim** from the American Canoe Association's documents and are
  the ACA's work, not this project's. Do not edit them here. See
  [Attribution](README.md#attribution).

## Cues attach to a *technique*, not a level

A forward stroke is the same technique whether you paddle it in L1 flat water or
L4 open water — only the *conditions* change. So cues are keyed by **technique**
and authored **once**, then applied at every level where that technique appears.

Three small files work together:

- **`techniques.json`** — the technique catalogue: `{ "forward-stroke": { "name": "Forward Stroke" } }`.
- **`skill-techniques.json`** — which ACA skill is which technique:
  `{ "l2-forward": "forward-stroke", "l3-strokes-and-maneuvers-01": "forward-stroke" }`.
- **`top-tips.json`** — the cues, keyed by technique:

```jsonc
{
  "forward-stroke": [
    { "id": "f1", "text": "Sit tall and relax your grip." },
    { "id": "f2", "text": "Power comes from torso rotation, not the arms." }
  ]
}
```

## Order is a readiness ladder

**Order the cues by readiness, not just importance.** The foundational cue a
beginner needs goes first; the hard-won insight that only lands once you've felt,
say, 25 knots of wind against 3 knots of current goes last. The app reveals the
top few unmastered cues and a paddler *earns* the later ones by mastering the
earlier — so an advanced cue never confuses a beginner, and a strong paddler works
down to it. **Four to six technique-specific cues** is a good target (working
memory holds about four). Universal cues — sit up, rotate from the torso — are
repeated in every technique they apply to, worded for that technique, so a full
set often runs longer than six. The app reveals only 3 to 5 at a time, so the
extra length is more ladder, not more clutter.

Keep each cue short and actionable — one idea, plain imperative voice, glanceable
from a phone on the water.

## The one rule that matters: stable ids

Each tip's `id` is what a paddler's saved "mastered" progress points to (progress
is stored **per technique**, so mastering a cue at one level counts at every
level).

- ✅ Reorder the array freely — order is only the reveal order.
- ✅ A new tip gets a **new id unique within its technique** (any short string).
- ⛔ **Never rename or reuse an existing tip's `id`.** Changing an id orphans the
  progress people have saved against it.
- ⛔ **Removing a cue does not free its id.** Add it to
  `src/data/retired-tip-ids.json` so it can never come back under a different
  cue. The test suite fails if one does.

## Adding tips

- **For an existing technique:** add cues to its array in `top-tips.json`.
- **For a new technique:** add it to `techniques.json`, map the relevant ACA
  skills to it in `skill-techniques.json` (find skill ids in `skills*.json`), then
  add the cues in `top-tips.json`.

## Test before you open a PR

```bash
npm install
npm test
```

`tests/top-tips-data.test.js` validates the data — it rejects an unknown
technique, a duplicate tip id, empty text, and a map entry pointing at a
non-existent skill or technique. The same suite runs on deploy, so valid data is
required to ship.

## Submitting

Open a pull request against `main`. Small, focused PRs (one technique or a few)
are easiest to review. Tips are original content and ship in both the public and
self-hosted builds.
