# Self-Assessment Mode + Baseline Import — Design

**Date:** 2026-07-05
**Status:** Approved design → ready for implementation plan
**Repo:** kenbolton/aca-skills-assessment
**Builds on:** the v3 per-candidate assessment core (unified L1/L2 with landing).

## Problem

An instructor wants candidates to **self-assess before an in-person session**, so
he has baseline data on each paddler when they arrive (concrete motivating case:
the Clearwater group self-assesses from home, giving Ken a per-paddler baseline he
can reference on the water).

Two needs follow:

1. A **self-assessment mode** a single paddler can run on the public site — one
   person, their target level, no instructor present to justify shortfalls.
2. A **way for those results to reach the instructor**, who then reviews them as
   reference alongside his own separate live assessment.

This is the first of two independent features requested together. The second —
adding L3/L4/L5 standalone assessments — is a separate spec (it needs Notion data
extraction and a data-model generalization) and is **out of scope here**.

## Model overview

- A session gains a boolean **`selfAssessment`** flag (default `false`).
- **Setup** shows a "Self-assessment" checkbox. When checked, the multi-paddler
  list collapses to a **single name field** (defaults to "Me"); the level/target
  selector is unchanged. When unchecked, today's multi-paddler behavior is exact.
- **Self-assessment's only functional effect on rating:** required notes are
  waived. `resultNeedsFeedback` returns `false` for any session with
  `selfAssessment === true`, so Below/No/L1 never block navigation or export.
  Notes remain available everywhere, just never mandatory.
- Everything else is identical: the same Below/Meets/Exceeds (and L1-tier for dual
  L2) scale, the same standards/L1/Exceeds copy, the same landing computation for
  an L1/L2 target, the Skills-nav overlay, and the CSV/PDF exports.

The flag rides in the session object, so it survives save/load, sync, and export
without any new plumbing.

## Baseline handoff (read-only)

The public build has **no Sync button** (it cannot reach the instructor's tailnet
Pi). So the return path is an explicit file the candidate sends:

1. **Candidate exports JSON.** The Review screen gains a **"Download JSON"** button
   that downloads the full session object as `aca-assessment-${session.id}.json`.
   This is available in every build (it is just the portable session file); it is
   the artifact a self-assessor emails to the instructor.
2. **Instructor imports on the Pi.** The private Past Assessments page (`/sessions`)
   gains an **"Import JSON"** control: the instructor picks a `.json` file; the
   page reads it (`FileReader`) and `POST`s its text to the **existing `/sync`
   endpoint**, which already validates (`id` is a string, `results` is an array),
   writes it via `safeSessionPath`, and returns `syncedAt`. The list then reloads
   and the imported session appears like any archived session — viewable, with the
   existing CSV/JSON download and Delete.
3. **Self tag.** In the `/sessions` list, a session with `selfAssessment === true`
   shows a small **"self"** marker next to its participants, so the instructor can
   distinguish emailed baselines from his own synced assessments.

Reusing `/sync` means the import path adds **no new server route** — only a file
picker and a `fetch` on the client page. The instructor uses these baselines as
read-only reference; he runs his own fresh assessment separately. No resume/merge
of a baseline into a live session is in scope (Resume already exists for v3
sessions and is not removed, but is not part of this workflow).

## Data model

```ts
type Session = {
  // ...existing v3 fields...
  selfAssessment?: boolean;   // absent/false = instructor multi-paddler mode
};
```

- `createSession` accepts `selfAssessment` and stores it (default `false`).
- Backward compatibility: existing sessions (no `selfAssessment`) behave exactly
  as today (`falsy` → instructor mode). No migration.
- The imported-baseline JSON is just a v3 session with `selfAssessment: true` and
  one paddler; it flows through `sessionSummary` and the `/sessions` renderer
  unchanged except for the new "self" marker.

## Screens

- **Setup:** a "Self-assessment" checkbox at the top. Checked →
  render a single name row (placeholder "Me") instead of the paddler list; keep
  the target/level selector. At least the one (possibly empty → "Me") paddler is
  started. Unchecked → unchanged multi-paddler UI. The checkbox value is passed to
  `createSession` as `selfAssessment`.
- **Review:** add a **"Download JSON"** button beside the existing CSV/PDF
  actions. In self-assessment mode the "still needs feedback" warnings do not
  appear (nothing is required), and exports are never blocked.
- **Rate:** no structural change. Because `resultNeedsFeedback` is waived, the
  feedback box always renders as the optional (grey) variant and `blocked` is
  always `false`, so Prev/Next/Review are never gated.
- **Past Assessments (`/sessions`, private):** add an **"Import JSON"** file
  control near the header; add a **"self"** marker in rows where
  `selfAssessment` is true.

## Validation

- `resultNeedsFeedback(session, result)`: **first** check
  `if (session.selfAssessment) return false;` then the existing optional-skill and
  requiresFeedback logic. This single seam is the entire behavioral change for
  self-assessment.
- `isSessionComplete` is unchanged (it still requires every core skill rated);
  self-assessors can still export an incomplete session because export is not
  gated on completeness in self-assessment mode — the "Download JSON" and CSV/PDF
  buttons are enabled since `invalidResults` is empty when notes are waived.

## Exports & backward compatibility

- CSV/PDF unchanged in content. A new JSON export (the raw session) is added.
- The Pi `/sync` endpoint is unchanged; import reuses it. Old archived sessions
  (no `selfAssessment`) render with no "self" tag, exactly as now.

## Testing

- **Unit:** `resultNeedsFeedback` returns `false` for a `selfAssessment` session
  even on a Below/No/L1 rating with an empty note; returns its normal result when
  the flag is absent/false. `createSession` stores `selfAssessment` (and defaults
  it to `false`). `invalidResults` is empty for a self-assessment session with
  unjustified Below ratings.
- **Manual:** on the public preview, toggle Self-assessment → single "Me" row →
  pick L2 → rate with a Below and no note → not blocked → Review → Download JSON.
  On the Pi `/sessions`, Import that JSON → it appears with a "self" tag → view it
  and download its CSV. Confirm a normal instructor multi-paddler session still
  requires notes on Below.

## Open items for Ken

- Confirm the exported JSON emailed by candidates is acceptable as the transport
  (vs. a future QR/link handoff) — this spec assumes email of the `.json` file.
- Confirm the "self" marker wording ("self") in the `/sessions` list.
