# Usage Metrics — Design Spec

**Date:** 2026-07-07
**Status:** Approved, ready for implementation plan
**Scope:** Add privacy-respecting usage metrics for the public site
(https://kenbolton.github.io/aca-skills-assessment/).

## Goal

Measure the **public-site funnel** — traffic, PWA installs, and
assessment-started engagement — without undercutting the app's core privacy
promise ("nothing is uploaded; all data stays on your device") and without
adding any new attack surface.

## Constraints that shape the design

1. **Privacy brand is non-negotiable.** Whatever is added must be cookieless,
   anonymous, carry no PII, honor Do-Not-Track, and be **disclosed** in-app and
   in the README. No cookie banner should be required.
2. **Offline-first means network analytics inherently undercount.** The app is
   built to be used on the water with zero connectivity. Any network-based
   analytics — hosted or self-hosted — can only observe the *online* moments
   (landing, install). The actual assessing happens offline and will never
   beacon home. This is a fact to design around and disclose, not a bug to fix.
3. **Static GitHub Pages** — no server logs; collection must be client-side.
4. **PWA/offline integrity** — the analytics must never be precached by the
   service worker, never throw into the app, and never affect an offline
   assessment.

## Decisions (locked)

| Decision | Choice |
| --- | --- |
| Metric focus | Site traffic + PWA installs + engagement (NOT assessment content) |
| Backend | **GoatCounter** (open-source, cookieless, free non-commercial, custom events) |
| Data destination | GoatCounter for public layer; existing Pi `sessions/` for deep engagement (no new collection) |
| Events | Landing page view; App installed; Assessment started (tagged with level + self/group) |
| Privacy posture | Disclose in README + in-app note; respect Do-Not-Track; **no** opt-out toggle |

## Architecture — two layers

### Layer 1 — Public online funnel (NEW): GoatCounter

Captures the three online moments the network can actually see. Cookieless,
anonymous, no consent banner.

### Layer 2 — Deep engagement (ALREADY EXISTS): Pi sessions

Completed sessions already sync to `pi/sessions/` over Tailscale. "How many
assessments actually finished" is derivable there privately. **Out of scope to
build** — documented here so it is not double-instrumented. At most, surfacing a
count on the existing "Past Assessments" page is a future, optional nicety.

## Layer 1 components

### 1. `src/lib/metrics.js` (new) — the only file that knows GoatCounter exists

Pure-ish wrapper following the repo's `src/lib/` pattern. Public API:

- `countPageView()`
- `countEvent(path, title)`

Responsibilities / guards (each short-circuits **before** any network attempt):

- **DNT suppression:** no-op if `navigator.doNotTrack === '1'`, or the
  equivalent `window.doNotTrack` / `navigator.msDoNotTrack` legacy flags.
- **Offline suppression:** no-op if `navigator.onLine === false`. Fail silently;
  never queue, never retry.
- **Config gate:** site code comes from `import.meta.env.VITE_GOATCOUNTER_CODE`.
  If unset → metrics are fully disabled. This is how the private/Pi build stays
  silent.
- **Lazy load:** inject GoatCounter `count.js` from its CDN on first use, using
  the configured site code. Because it is loaded at runtime from an external
  origin and is **not** listed in `vite.config.js`'s `workbox.globPatterns`, the
  service worker never precaches it — offline installs and the bundled
  PDF/offline experience are unaffected.
- **Never throws:** every call is fire-and-forget, wrapped so any failure cannot
  break an offline assessment.

### 2. `src/main.jsx`

- Call `countPageView()` once on boot.
- Register an `appinstalled` window listener →
  `countEvent('/install', 'App installed')`.

### 3. `src/screens/Setup.jsx` — `handleStart()`

The `level` value is **not** stored on the session object; it lives only as the
`level` select state inside `Setup` (values: `L1/L2`, `L3`, `L4`, `L5`). So the
"assessment started" event fires here, immediately before `onStart(session)`,
where both `level` and `selfAssessment` are in scope. The slash in `L1/L2` is
sanitized to `L1-L2` so it does not create a nested GoatCounter path:

```js
countEvent('/start/' + level.replace('/', '-') + (selfAssessment ? '/self' : '/group'),
           'Assessment started');
```

Anonymous and aggregate; distinct GoatCounter paths yield the level + self/group
breakdown.

### 4. Disclosure — a privacy statement (brand honesty)

- **`src/components/PrivacyStatement.jsx` (new)** — a short, dedicated privacy
  statement component covering the whole app's stance in plain language:
  assessment data stays on the device; optional sync goes only to the owner's
  private home server; the public site keeps anonymous, cookieless page counts
  via GoatCounter (no personal data, no cookies) and honors Do-Not-Track.
  Rendered on the Setup screen alongside the existing `Attribution` footer.
- `README.md` — a matching **Privacy** section near "Try it".

## Data flow

```
Online boot ─▶ countPageView()            (unless DNT)
Install     ─▶ appinstalled ─▶ countEvent('/install', …)
Start assess─▶ Setup.handleStart() ─▶ countEvent('/start/<level>/<self|group>', …)
Offline     ─▶ every call is a silent no-op; assessment unaffected
Reading data─▶ GoatCounter dashboard (Layer 1); Pi sessions/ (Layer 2)
```

## Error handling / edge cases

- Metrics calls never throw into the app (fire-and-forget, wrapped).
- DNT and offline both short-circuit before any network attempt.
- Missing `VITE_GOATCOUNTER_CODE` → metrics fully disabled (private Pi build).
- SW/offline safety guaranteed by keeping the external script out of
  `globPatterns`.

## Testing

- **Unit** (`src/lib/metrics.js`, Vitest, `environment: node`) against a mocked
  `navigator` / script injection:
  - DNT set → no script load, no event.
  - Offline → no load.
  - Missing site code → no load.
  - Happy path → correct GoatCounter call with expected path/title.
- **Manual:** production build, load the public URL, confirm a hit appears on
  the GoatCounter dashboard; toggle DNT and confirm suppression.

## Prerequisite (owner, one-time)

Create a free GoatCounter site (e.g. `aca-skills`) and set its code in the build
env as `VITE_GOATCOUNTER_CODE`. The implementation leaves a clear placeholder +
note; the account cannot be created programmatically.

## Out of scope (YAGNI)

- Opt-out toggle in settings.
- Self-hosting analytics / exposing the Pi to the public internet.
- Assessment **content** analytics (pass/fail rates, per-skill stats).
- Per-user tracking or any PII.
- Dashboards embedded in the app.
