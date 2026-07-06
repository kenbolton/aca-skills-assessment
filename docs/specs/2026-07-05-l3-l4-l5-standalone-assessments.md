# L3 / L4 / L5 Standalone Assessments — Design

**Date:** 2026-07-05
**Status:** Approved → implemented on `feat/l3-l4-l5-assessments`
**Repo:** kenbolton/aca-skills-assessment
**Builds on:** the v3 per-candidate core (combined L1/L2 with landing) and the
self-assessment feature.

## Problem

The instructor wants the ACA **Level 3, 4, and 5** Coastal Kayaking skills
standards available in the same offline app — not to certify at those levels
himself, but to have the standard handy and usable by a qualified assessor who
does run them.

## Source data

Extracted from the three public ACA Notion pages (loadPageChunk API, two chunks
each, all child blocks resolved):

| Level | Assessed | Developing (optional) | Categories |
|---|---|---|---|
| L3 | 60 | 4 | 6 Core + 3 Venue-Specific |
| L4 | 74 | 9 | 5 Core + 4 Venue-Specific |
| L5 | 71 | 1 | 5 Core + 4 Venue-Specific |

Each category carries a **Level Competency** paragraph. Each skill carries its
**standard** (the "Meets" bar). "Developing Skills" map to the existing
`optional` flag (add to a pass, never count against). The public assessment docs
contain no Exceeds/Below prose (that lives in the separate Assessor's Guides), so
the scale is **Below / Meets / Exceeds** where **Meets = the listed standard**.

**Naming:** L3 skills have short labels (`Awareness: …`); L4/L5 skills are
full-sentence standards with no short name. Decision: **use the full standard as
the item** for L4/L5 (no fabricated labels). `skillLabel(skill)` returns
`skill.name || skill.standard`.

## Model

Standalone per-level: each level is its own data file
(`skills-l3.json` / `-l4` / `-l5`), shaped `{ scales: { Lx: [...] }, skills: [...] }`.
A standalone session sets **every paddler's `target` to that one level**, so the
existing per-paddler results engine (`createSession`, `skillStatus`,
`resultNeedsFeedback`, exports) is reused unchanged.

- `loadConfig` is generalized: levels are derived from `scales` keys (not a
  hardcoded L1/L2 list); it passes `competency` through and treats `name` as
  optional.
- **No cross-level landing.** `landingFor` gets a standalone branch returning a
  within-level verdict: `meets_level` when every assessed skill is meets/exceeds,
  else `below_level` (with `belowCount`), else `pending`.

## Screens

- **Setup:** an "Assessment level" selector — `L1/L2 (combined, with landing)`
  keeps today's per-paddler-target behavior; `L3`/`L4`/`L5` are standalone. In
  standalone mode the per-paddler target dropdowns are hidden (all share the
  level). Self-assessment still works (single paddler, notes waived).
- **Rate:** for a skill with no short name (L4/L5), the standard is the heading and
  the standard-box is omitted (it would just repeat). The category competency
  still shows. Below/Meets/Exceeds chips; a Below still requires a note in
  instructor mode.
- **Review:** within-level badge — "Meets L4 standard" (green) or
  "Not yet — N below standard" (red).
- **Past Assessments (`/sessions`, private):** the archive labels a standalone
  session by its level (e.g. "L3"); landing tokens are humanized (meets/below).

## Backward compatibility

The core `skills.json` (L1/L2) and every existing session are untouched — L1/L2
sessions still carry per-paddler targets and the L1/L2 landing. The new levels
are additive: new data files, a generalized loader, and gated landing/verdict
logic.

## Testing

`tests/standalone.test.js` (12 tests): data files load with the right single
level + 3-point scale; competency preserved; L4/L5 have no `name` and
`skillLabel` falls back to the standard; `optionsForSkill` returns the full scale;
`createSession` assigns the shared level and rates every skill; `landingFor`
produces meets_level / below_level+count / pending; `paddlerSummary` surfaces
`belowCount`; a Below with no note requires feedback (waived under
self-assessment); `sessionSummary` labels a standalone session with its level.
Plus an end-to-end data-flow check (create → rate → summary → CSV) and both
private and public production builds.
