# xAPI + CASE Interoperability — Design Sketch

**Date:** 2026-08-17
**Status:** Design sketch, spec-verified. Not yet approved to build. Own increment,
separate branch from the learning-loop work.
**Repo:** kenbolton/aca-skills-assessment (indie project)

## Summary

Make the app's data portable using two mature, verified ed-tech standards. Export
each assessment as **xAPI** statements (the events); optionally express the ACA
framework in **1EdTech CASE** (the competency model). No phys-ed-specific data
format exists — these general standards are the right pair.

Both are additive. The assess flow, offline-first behavior, and on-device privacy
do not change. Export is user-controlled: generate on device, sync only when the
instructor chooses (matches the existing Pi sync model).

## Verified standards (2026-08-17)

Facts confirmed against IEEE, 1EdTech, and ADL repositories. Two access caveats
at the end.

- **xAPI: IEEE 9274.1.1-2023** ("xAPI 2.0"), active, IEEE-stewarded.
  Target 2.0 for the data model, but keep statements **1.0.3-shape-compatible**
  (most LRSs and tools still run 1.0.3). Avoid 2.0-only fields (`contextAgents`,
  `contextGroups`) unless the consumer confirms support. Source:
  https://standards.ieee.org/ieee/9274.1.1/7321/
- **xAPI Profiles: ADL spec v1.0** (JSON-LD). Still ADL-stewarded; the IEEE
  successor (P9274.2.1) is a working group, not yet published. Build against
  Profiles 1.0. Source: https://adlnet.github.io/xapi-profiles/
- **Verbs:** the spec reserves exactly one verb, `voided` (retract a prior
  statement). All other verbs are community-defined. No registered verb exists
  for observational rubric rating, so custom verbs in our own namespace are the
  sanctioned practice. Source:
  https://github.com/adlnet/xAPI-Spec/blob/master/xAPI-Data.md
- **CASE: 1EdTech CASE 1.1**, released 2025-01-24. Prerequisite relationship =
  association type **`precedes`** ("comes before in learning progression").
  Source: https://www.imsglobal.org/spec/case/v1p1
- **No phys-ed / sport-specific competency format.** Sport data formats
  (SportsML, IPTC Sport Schema, sailing XRR, swimming SDIF) are results/reporting,
  not skills assessment.

## xAPI profile

Namespace base (the app's own stable URL), called `BASE` below:
`https://kenbolton.github.io/aca-skills-assessment/xapi`

**Verbs (2, custom):**

| Verb | IRI | Use |
|------|-----|-----|
| `assessed` | `BASE/verbs/assessed` | one statement per skill rating |
| `achieved` | `BASE/verbs/achieved` | one per session, the level attained (landing) |

The rating value lives in `result`, not the verb — one verb carries
Exceeds/Meets/Below without a verb explosion. `achieved` (not ADL `passed`)
expresses the cross-level landing honestly: targeted L2, attained L1.

**Activity types (3):** `BASE/activity-types/skill`, `/level`, `/strand`.

**Extensions:** `BASE/extensions/rating` (raw scale value), `/assessment-mode`
(`self` | `instructor`), `/target-level`, `/venue`, `/conditions`.

### Sample statement — one rating

```json
{
  "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "timestamp": "2026-08-17T14:30:00Z",
  "actor": {
    "objectType": "Agent",
    "name": "Alex",
    "account": { "homePage": "https://kenbolton.github.io/aca-skills-assessment/", "name": "alex" }
  },
  "verb": { "id": "BASE/verbs/assessed", "display": { "en-US": "was assessed on" } },
  "object": {
    "objectType": "Activity",
    "id": "BASE/activities/skills/l2-stopping",
    "definition": {
      "type": "BASE/activity-types/skill",
      "name": { "en-US": "Stopping" },
      "description": { "en-US": "Stops the kayak from a good speed (2 to 2.5 knots), in forward and reverse." }
    }
  },
  "result": {
    "success": false,
    "completion": true,
    "response": "Boat still gliding when the stop was called.",
    "extensions": { "BASE/extensions/rating": "below" }
  },
  "context": {
    "contextActivities": {
      "parent":   [{ "id": "BASE/activities/levels/L2" }],
      "grouping": [{ "id": "BASE/activities/strands/l2-core-strokes" }],
      "category": [{ "id": "BASE/profile/v1" }]
    },
    "extensions": {
      "BASE/extensions/assessment-mode": "instructor",
      "BASE/extensions/venue": "Demo Cove",
      "BASE/extensions/conditions": { "wind": "F3", "waves": "0.5 m" }
    }
  }
}
```

(`BASE` is written literally for readability; real statements use the full IRI.)

### Landing statement — one per session

```json
{
  "actor": { "name": "Alex", "account": { "homePage": ".../", "name": "alex" } },
  "verb":  { "id": "BASE/verbs/achieved", "display": { "en-US": "achieved" } },
  "object":{ "id": "BASE/activities/levels/L1",
             "definition": { "name": { "en-US": "L1 — Introduction to Kayaking" } } },
  "result":{ "success": true, "completion": true },
  "context":{ "extensions": {
    "BASE/extensions/target-level": "L2",
    "BASE/extensions/assessment-mode": "instructor"
  } }
}
```

### Corrections applied from spec verification

1. **Profile tagging:** `contextActivities.category` carries the profile version
   IRI (`BASE/profile/v1`). Do **not** hard-code an activity `type` on the
   category activity — the profile spec does not mandate one. Copy the cmi5
   profile's live statements before finalizing.
2. **DNO:** model "Did Not Observe" as `rating: "dno"` with `completion: false`
   and no `success`. Never use the verb `voided` — that means retracting a
   statement, not a non-observation.
3. **Fidelity:** `assessment-mode` makes a self-assessment structurally
   distinct from an instructor assessment. No `context.instructor` by default
   (the app has no assessor identity).
4. **Privacy:** the actor IFI is a local `account` keyed by the normalized-name
   learner id. The `name` field is still PII, so export stays user-controlled
   and offline. Offer a pseudonymized mode that drops `name`.

## CASE mapping (optional, framework export)

Represent the framework as CASE 1.1: a `CFDocument` per level, `CFItem` per
skill, and `CFAssociation` records — `isChildOf` for the level→category→skill
hierarchy, and **`precedes`** for each prerequisite edge from `progression.json`.
This makes the framework itself citable and machine-readable, separate from the
verbatim ACA text.

## App fit

A pure `xapiStatementsFor(session)` beside `csv.js` / `pdf.js`. It emits an array
(N skill statements + 1 landing), downloadable as JSON or POSTed to a Learning
Record Store later. No change to the assess flow; the IRIs are stable strings.

## Caveats (verify before final sign-off)

- `adlnet.gov` was unreachable during research (connection refused). The verb
  IRIs were confirmed via ADL's GitHub code, not the live registry. Browse
  `https://adlnet.gov/expapi/verbs/` to confirm it is still maintained.
- The `CFAssociationType` list came from the CASE Best-Practices guide. Confirm
  the full enum against the CASE 1.1 normative information model before relying
  on any edge value.

## Build order (when approved)

1. xAPI Profile document (JSON-LD) defining the 2 verbs, 3 activity types,
   extensions.
2. `xapiStatementsFor(session)` + tests (one statement per rating, landing,
   DNO handling, self vs instructor mode, pseudonymized mode).
3. Export button (JSON download) on Review, beside CSV/JSON.
4. (Optional, later) CASE framework export from skills + progression.
