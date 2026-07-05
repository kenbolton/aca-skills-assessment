# ACA Coastal Kayaking L1/L2 Skills Assessment PWA — Design

**Date:** 2026-07-04
**Author:** Ken Bolton (with Claude)
**Status:** Approved design → ready for implementation plan
**Deadline driver:** Live assessment of 3 paddlers on Thursday 2026-07-09

## Problem

Ken is an ACA instructor performing a Coastal Kayaking Level 1/Level 2 skills
assessment for up to four paddlers at once, **in real time on the water**. He
needs a low-friction way to record, per paddler and per skill, whether the
paddler's performance **Does Not Meet / Meets / Exceeds** the standard, and to
capture dictated feedback whenever a skill does not meet the standard. Cell
coverage on the water is unreliable, so the tool must work with **zero network
connectivity** during the assessment. A Raspberry Pi on the user's tailnet
serves the app and archives finished sessions.

## Goals

- Record ratings for up to 4 paddlers across a configurable list of skills.
- Enforce mandatory feedback on any "Does Not Meet the standard" rating.
- Support the phone's **native keyboard dictation** for that feedback.
- Work **fully offline** once loaded (installable PWA).
- Never lose data: local persistence on every interaction.
- Produce per-paddler outputs: on-screen summary, PDF, CSV, and a sync to the Pi.

## Non-Goals (YAGNI)

- No user accounts, login, or multi-instructor support (single user, tailnet-scoped).
- No cloud database or third-party services.
- No rolling/advanced-skill scoring beyond the L1/L2 skill list.
- No live multi-device collaboration; one phone is the source of truth per session.
- No analytics/history dashboards beyond the raw archived JSON on the Pi.

## Chosen Approach

**Approach A — Offline-first PWA, Pi as home base.** The app is an installable
Progressive Web App that runs entirely in the phone browser. It is loaded once
over Tailscale (with signal), added to the home screen, and thereafter runs with
no network dependency. All state lives in the phone's `localStorage`. The Pi (1)
hosts the built app over Tailscale HTTPS and (2) receives a sync of the finished
session. Neither Pi role is on the critical path during the assessment.

## Architecture

```
Phone (installed PWA, offline)                 Raspberry Pi (on tailnet)
┌─────────────────────────────┐                ┌────────────────────────────┐
│ Preact app (service worker  │  load once     │ tailscale serve (HTTPS)     │
│ precached, runs offline)    │◀───────────────│  → static build of the app  │
│                             │                │                             │
│ localStorage: session state │  POST /sync    │ sync server (small Node):   │
│ jsPDF: per-paddler PDF       │───────────────▶│  writes dated session JSON  │
│ CSV builder                 │  (when in range)│  to ./sessions/*.json        │
└─────────────────────────────┘                └────────────────────────────┘
```

- **Secure context:** service workers require HTTPS or localhost. `tailscale
  serve` provides a valid HTTPS cert at `https://<pi-name>.<tailnet>.ts.net`.
- **Sync auth:** the tailnet is the security boundary; no additional auth.

## Data Model

All data is local JSON. Sizes are tiny (≤ 4 paddlers × ~30 skills).

```ts
type Rating = 'does_not_meet' | 'meets' | 'exceeds';

interface Skill {
  id: string;          // stable slug, e.g. "wet-exit"
  category: string;    // e.g. "Rescues & Safety"
  name: string;        // e.g. "Wet Exit"
  levels: ('L1' | 'L2')[]; // which assessment levels include this skill
  // The ACA performance standard for this skill, keyed by level. Shown on the
  // rate screen as quick reference so Ken assesses against the actual criteria.
  // A level's standard may be absent if the skill is not assessed at that level.
  standard: { L1?: string; L2?: string };
}

interface Paddler {
  id: string;
  name: string;
}

interface SkillResult {
  paddlerId: string;
  skillId: string;
  rating: Rating | null;   // null = not yet rated
  feedback: string;        // REQUIRED (non-empty) iff rating === 'does_not_meet'
}

interface Session {
  id: string;              // generated at session start
  createdAt: string;       // ISO timestamp
  level: 'L1' | 'L2';
  location?: string;
  paddlers: Paddler[];     // up to 4
  skills: Skill[];         // snapshot of skills.json used for this session
  results: SkillResult[];  // one per (paddler, applicable skill)
  syncedAt?: string;       // set when successfully synced to Pi
}
```

- **Skills source:** a checked-in, editable `skills.json` seeded with a DRAFT
  ACA L1/L2 coastal list (below), which Ken corrects against the official ACA
  assessment form before Thursday. Editing `skills.json` requires no code change.
- **Persistence:** the active `Session` is written to `localStorage` on every
  rating/feedback change. On app open, an in-progress session is restored.

### Invariant (core rule)

A `SkillResult` with `rating === 'does_not_meet'` MUST have non-empty
(trimmed) `feedback`. The UI blocks navigation/export while this is violated and
visibly flags the offending entries. This invariant is unit-tested.

## Draft skills.json (Ken to correct against official ACA form)

> **DRAFT — must be verified.** This is a starting list assembled from general
> ACA Coastal Kayaking L1/L2 knowledge, not copied from the official assessment
> sheet. Ken edits names, categories, level tags, and add/remove items before
> Thursday. Level tags: L1 = introductory/protected water, L2 = adds basic
> coastal/moving-water competence.
>
> **Each skill also needs its `standard` text per level**, transcribed from the
> official ACA assessment form — this is what shows on the rate screen. The seed
> file will carry short plain-language placeholder cues clearly marked
> `[VERIFY]`; Ken replaces them with the exact ACA wording. The standards are NOT
> invented here, to avoid presenting fabricated criteria as authoritative.

- **Preparation & Equipment**
  - Personal gear & dress for conditions (L1, L2)
  - PFD fit and use (L1, L2)
  - Boat outfitting & fit (L1, L2)
  - Pre-launch safety check (L1, L2)
- **Launching & Landing**
  - Launch from beach/shore (L1, L2)
  - Land on beach/shore (L1, L2)
  - Seal launch / dock entry as conditions allow (L2)
- **Strokes & Maneuvers**
  - Forward stroke (L1, L2)
  - Reverse stroke & stopping (L1, L2)
  - Forward sweep turn (L1, L2)
  - Reverse sweep turn (L1, L2)
  - Draw stroke (side/T) (L1, L2)
  - Stern rudder (L2)
  - Edging / boat tilt to assist turns (L2)
  - Low brace (L1, L2)
  - High brace (L2)
- **Rescues & Safety**
  - Wet exit (L1, L2)
  - Assisted (T/X) rescue — as rescuer (L1, L2)
  - Assisted (T/X) rescue — as swimmer (L1, L2)
  - Re-entry & boat emptying (L2)
  - Contact tow / short tow (L2)
  - Use of tow system (L2)
- **Group & Judgment**
  - Communication & paddle signals (L1, L2)
  - Group awareness & positioning (L1, L2)
  - Understanding of conditions / trip planning basics (L2)

## Screen Flow

### 1. Start / Session setup
- Choose **level** (L1 or L2) — filters skills to that level's tags.
- Enter up to **4 paddler names**.
- Optional location field.
- "Start / Resume" — if an in-progress session exists in `localStorage`, offer
  to resume it or start fresh (starting fresh archives/clears the old one only
  after confirmation).

### 2. Rate (core on-water screen)
- **One skill at a time.** Header shows the skill name and category, plus the
  **ACA standard for the active level** as quick reference (the `standard[level]`
  text). It is shown by default but collapsible to a one-line summary to save
  screen space once Ken knows it — collapse state is remembered per session.
- Below it, **one row per paddler** (up to 4), each with three large chips:
  **Does Not Meet / Meets / Exceeds**. Chips are sized for wet fingers.
- Selecting **Does Not Meet** expands an **inline feedback text box** directly
  under that paddler's row. Ken taps the on-screen keyboard mic and dictates.
- **Prev / Next** buttons move between skills. A progress indicator shows how
  many skills remain unrated so nothing is missed.
- Navigation away from a skill that has a DNM with empty feedback is blocked
  with a clear inline prompt (the invariant).
- Every change autosaves to `localStorage`.

### 3. Review / Export
- **Per-paddler summary:** each paddler's list of "Does Not Meet" skills with the
  dictated feedback, plus counts (e.g. "Meets/Exceeds 22 of 25; 3 not met").
- Actions:
  - **PDF per paddler** — generated on-device with jsPDF (works offline).
  - **CSV export** — all paddlers × skills × ratings × feedback, downloaded/shared.
  - **Sync to Pi** — POSTs the session JSON; on success sets `syncedAt`. If the
    Pi is unreachable (out of tailnet range), it fails gracefully with a
    "not synced yet — you can retry later" message and no data loss.

## Offline & PWA Behavior

- Built with `vite-plugin-pwa`; the service worker precaches the app shell and
  the bundled jsPDF so the entire app (including PDF export) launches offline.
- Installable: web app manifest with name, icons, standalone display.
- State is durable across app close, phone lock, and accidental refresh via
  `localStorage`.

## Pi Side (minimal)

- **Hosting:** `tailscale serve` points at the static `dist/` build over HTTPS.
- **Sync server:** a small Node HTTP script exposing `POST /sync` that validates
  the payload shape and writes it to `sessions/<session-id>-<createdAt>.json`.
  Idempotent by session id (re-sync overwrites the same file). Exposed on a path
  via `tailscale serve` alongside the static app.
- Setup steps documented in a `pi/README.md` (install Node, run the server,
  `tailscale serve` config).

## Tech Stack

- **App:** Vite + Preact + plain CSS (large tap targets, high-contrast for
  outdoor/glare readability). `vite-plugin-pwa`. `jsPDF` bundled for PDFs.
  CSV assembled by hand (no dependency).
- **Pi:** one small Node script (same runtime as the build) + `tailscale serve`.
- **Dictation:** native OS keyboard microphone — a normal `<textarea>`, no
  custom Web Speech API.

## Error Handling

- **DNM without feedback:** blocked and flagged (the invariant); cannot export
  or finish while violated.
- **Sync failure (offline/unreachable Pi):** non-fatal, clearly reported,
  retryable; PDF/CSV remain available as the durable record.
- **Accidental data loss:** mitigated by autosave to `localStorage` on every
  change and resume-on-open.
- **Skills config error:** app validates `skills.json` shape on load and shows a
  clear message rather than rendering a broken screen.

## Testing

- **Unit tests:**
  - The DNM-requires-feedback invariant (blocks when violated, passes when not).
  - CSV generation (correct rows/columns/escaping).
  - Per-paddler summary computation (counts, DNM list).
  - `skills.json` validation and level filtering.
- **Manual offline dress rehearsal (Wednesday 2026-07-08):** load the app,
  enable airplane mode, run a full mock 4-paddler session, dictate feedback,
  export PDF and CSV, re-enable network, sync to Pi, and confirm the archived
  JSON on the Pi. This is the acceptance gate before Thursday.

## Build Order (risk-first)

1. App shell + `skills.json` load + session setup.
2. **Rate screen** with the DNM-requires-feedback invariant (the only thing
   truly needed on the water). Autosave + resume.
3. Review screen + PDF + CSV (durable outputs; independent of the Pi).
4. PWA/offline packaging and install; offline dress rehearsal.
5. Pi hosting + sync endpoint (least critical; graceful if incomplete).

Even if step 5 is unfinished by Thursday, PDF/CSV export guarantees no data loss.

## Open Items for Ken

- Correct `skills.json` against the official ACA L1/L2 coastal assessment form,
  including the exact **`standard` text per level** for each skill (replacing the
  `[VERIFY]` placeholder cues shown on the rate screen).
- Confirm the Pi's Tailscale hostname and that `tailscale serve` is available.
- Decide whether L1 and L2 are ever assessed in the same session (current design:
  one level per session; can be revisited if mixed sessions are needed).
