# ACA Skills Assessment

An offline-first Progressive Web App for running ACA coastal kayaking skills
assessments on the water — for up to **5 paddlers at once** — against the
**Level 1 through Level 5** coastal kayaking standards, from *Introduction to
Kayaking* (L1) to *Advanced Open Water Coastal Kayaking* (L5).

An independent tool built by an ACA-certified instructor. It is **not an official
ACA product** — see [Attribution](#attribution).

Built to be tapped on a phone from a kayak: it works with **zero network
connectivity** once installed. **Nothing you enter about a paddler leaves your
device** — you assess and export locally. A self-hosted build additionally syncs
finished sessions back to a home server (e.g. a Raspberry Pi over Tailscale) when
back in range.

## Try it

**[kenbolton.github.io/aca-skills-assessment](https://kenbolton.github.io/aca-skills-assessment/)**

Open it on your phone and tap **Add to Home Screen** to install. It then runs
fully offline — assess yourself (or a group), and export a PDF or CSV of the
results. Paddler data stays on your device; the public site keeps anonymous
usage counts only, described under [Privacy](#privacy).

## Privacy

Your assessments stay on your device — nothing you enter about a paddler is
uploaded anywhere. The app has no accounts and no cross-site trackers, and every
assessment works with the network off entirely.

Stated precisely, because the difference matters: **paddler data never leaves
your device. Anonymous usage counts do.**

The public website keeps **anonymous, cookieless** counts of page visits, PWA
installs, and assessments started (via [GoatCounter](https://www.goatcounter.com/)).
No personal data and no cookies are collected, and the counter honors your
browser's **Do-Not-Track** setting. Counting is disabled entirely in the
self-hosted build.

## Features

- **Five ACA levels**, each with its own criteria and rating scale:
  - **L1 (Introduction to Kayaking)** — 43 criteria, rated
    *Pass / No / Did Not Observe*.
  - **L2 (Essentials of Kayak Touring)** — 36 core + 19 optional "developing"
    skills, rated *Exceeds / Meets / Below*, with cross-level landing to L1.
  - **L3 (Coastal Kayaking)** — 60 core + 4 optional skills, rated
    *Exceeds / Meets / Below / Did Not Observe*.
  - **L4 (Open Water Coastal Kayaking)** — 74 core + 9 optional skills, same
    scale.
  - **L5 (Advanced Open Water Coastal Kayaking)** — 71 core + 1 optional skill,
    same scale.
- **L1/L2 combined mode**: assign each paddler a target level (L1 or L2) and
  assess the group together; L3–L5 are standalone single-level assessments.
- **Self-assessment mode**: flip one switch to self-review as a single paddler.
- Each skill shows the **ACA standard text** as an on-screen reference.
- **Enforced feedback**: a below-standard rating requires a written note before
  you can move on — dictate it with your phone keyboard's mic. Optional
  developing skills never block and never count against a paddler.
- **Rate by skill**: one skill on screen, a row per paddler — matches how a
  group performs the same skill together.
- **Autosaves every tap** to the browser and resumes after a lock or refresh.
- **Exports**: per-paddler PDF and full-session CSV. The self-hosted build adds
  one-tap sync of finished sessions to a home server.
- **Installable, offline PWA** — the whole app (including the PDF engine) is
  precached by a service worker.

> The skill lists and standards in `src/data/skills*.json` are transcribed from
> the ACA assessment documents (rev. 5/1/2024) and remain the ACA's work — see
> [Attribution](#attribution). Verify against the current official sheets before
> relying on them for a formal assessment.

## Attribution

The skills criteria, level definitions, and standard text in
`src/data/skills*.json` are **transcribed from the American Canoe Association's
coastal kayaking assessment documents (rev. 5/1/2024)**. That material is the
ACA's, not this project's, and no claim of ownership is made over it. "ACA" and
"American Canoe Association" are the ACA's marks, used here nominatively to say
which standards the tool assesses against.

This tool is built and maintained by an ACA-certified instructor. **It was built
independently: the ACA did not author, review, endorse, or approve this software,
and nothing here is an official ACA publication.** Where this app and the current
official ACA sheets disagree, the official sheets govern.

Everything under `lessons-content/` is original work by the maintainer.

**This repository is intentionally unlicensed.** No license is granted for the
material described above, because this project does not own it and cannot grant
rights in it. Please do not redistribute the contents of `src/data/skills*.json`;
refer to the ACA for the current official documents.

## Tech

Vite + Preact, plain CSS, `vite-plugin-pwa`, `jsPDF` (bundled). Assessment
logic is a set of pure, unit-tested modules under `src/lib/`; the Preact
screens under `src/screens/` are thin views over them.

## Develop

Requires **Node 22+** (LTS). CI and the self-hosted Pi both run Node 22.

```bash
npm install
npm run dev      # dev server
npm test         # unit tests (Vitest)
npm run build    # production build to dist/ (generates the service worker)
```

### Usage metrics (optional)

The public site can keep anonymous, cookieless usage counts via GoatCounter.
Copy `.env.example` to `.env` and set `VITE_GOATCOUNTER_CODE` to your GoatCounter
site code, then build. Leaving it unset disables metrics — this is how the
self-hosted Pi build stays completely silent.

## Host + sync (Raspberry Pi or any always-on machine)

`pi/sync-server.mjs` is a tiny dependency-free Node server that serves the built
`dist/` **and** accepts `POST /sync` to archive finished sessions as JSON. A
service worker needs HTTPS, which `tailscale serve` provides on a tailnet.

```bash
VITE_PRIVATE=true npm run build               # enables the Sync button + archive
node pi/sync-server.mjs                        # serves app + /sync on :8787
tailscale serve --https=443 http://localhost:8787
tailscale serve status                         # prints the https URL
```

The **Sync to Pi** button and the **Past assessments** archive exist only in the
`VITE_PRIVATE=true` build — the public GitHub Pages build hides both, so visitors
only ever assess and export locally.

Open the HTTPS URL on your phone, **Add to Home Screen**, and it runs offline
from then on. Because the app and `/sync` share an origin, the in-app **Sync to
Pi** button works with no extra configuration. Full details in
[`pi/README.md`](pi/README.md).

## Project docs

- [`docs/design.md`](docs/design.md) — design & architecture.
- [`docs/data-model.md`](docs/data-model.md) — the per-level data model.
- [`docs/implementation-plan.md`](docs/implementation-plan.md) — build plan.
