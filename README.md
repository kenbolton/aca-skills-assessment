# ACA Skills Assessment

An offline-first Progressive Web App for running **ACA coastal kayaking skills
assessments** on the water — for up to **5 paddlers at once** — against the
official **Level 1 (Introduction to Kayaking)** and **Level 2 (Essentials of
Kayak Touring)** standards.

Built to be tapped on a phone from a kayak: it works with **zero network
connectivity** once installed, and syncs finished sessions back to a home
server (e.g. a Raspberry Pi over Tailscale) when back in range.

## Try it

**[kenbolton.github.io/aca-skills-assessment](https://kenbolton.github.io/aca-skills-assessment/)**

Open it on your phone and tap **Add to Home Screen** to install. It then runs
fully offline — assess yourself (or a group), and export a PDF or CSV of the
results. Nothing is uploaded; all data stays on your device.

## Privacy

Your assessments stay on your device — nothing you enter about a paddler is
uploaded anywhere.

The public website keeps **anonymous, cookieless** counts of page visits, PWA
installs, and assessments started (via [GoatCounter](https://www.goatcounter.com/)).
No personal data and no cookies are collected, and the counter honors your
browser's **Do-Not-Track** setting. Counting is disabled entirely in the
self-hosted build.

## Features

- **Two official ACA levels**, each with its own rating scale:
  - **L1** — 43 criteria, rated *Pass / No / Did Not Observe*.
  - **L2** — 36 core skills + 19 optional "developing" skills, rated
    *Exceeds / Meets / Below*.
- Each skill shows its **official ACA standard** as an on-screen reference.
- **Enforced feedback**: a below-standard rating requires a written note before
  you can move on — dictate it with your phone keyboard's mic. Optional
  developing skills never block and never count against a paddler.
- **Rate by skill**: one skill on screen, a row per paddler — matches how a
  group performs the same skill together.
- **Autosaves every tap** to the browser and resumes after a lock or refresh.
- **Exports**: per-paddler PDF, full-session CSV, and sync to a home server.
- **Installable, offline PWA** — the whole app (including the PDF engine) is
  precached by a service worker.

> The skill lists and standards in `src/data/skills.json` are transcribed from
> the official ACA assessment documents (rev. 2/25/2025). Verify against the
> current official sheets before relying on them for a formal assessment.

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
npm run build
node pi/sync-server.mjs                       # serves app + /sync on :8787
tailscale serve --https=443 http://localhost:8787
tailscale serve status                        # prints the https URL
```

Open the HTTPS URL on your phone, **Add to Home Screen**, and it runs offline
from then on. Because the app and `/sync` share an origin, the in-app **Sync to
Pi** button works with no extra configuration. Full details in
[`pi/README.md`](pi/README.md).

## Project docs

- [`docs/design.md`](docs/design.md) — design & architecture.
- [`docs/data-model.md`](docs/data-model.md) — the per-level data model.
- [`docs/implementation-plan.md`](docs/implementation-plan.md) — build plan.
