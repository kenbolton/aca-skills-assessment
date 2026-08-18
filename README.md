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

The **"Paddlers over time"** view groups a paddler's past assessments by name.
This grouping is computed **on your device** from assessments already stored
there. Your **Top Tips** progress is stored on your device too, keyed by paddler
name. Neither is uploaded; the self-hosted build syncs finished **sessions** only.

The public website keeps **anonymous, cookieless** counts of page visits, PWA
installs, and assessments started (via [GoatCounter](https://www.goatcounter.com/)).
No personal data and no cookies are collected, and the counter honors your
browser's **Do-Not-Track** setting. Counting is disabled entirely in the
self-hosted build.

## Backup & recovery

Your data lives in this browser (or the installed app), not on a server — see
[Privacy](#privacy). Nothing is uploaded, so **you are the backup.**

- **Back up:** open **Past assessments** and tap **Export all** to save a JSON
  bundle of your whole archive. You can also export a single session as JSON or
  CSV, and a per-paddler PDF from the Review screen.
- **Restore:** open **Past assessments → Import** and choose a JSON bundle (or a
  single-session JSON) you exported earlier.
- **Move to a new device or browser:** export a bundle on the old one, import it
  on the new one.
- **Self-hosted build:** finished sessions also **sync to your server**, giving
  you a second copy off the device.

Because the data sits in the browser's storage, **clearing the browser's site
data erases it** — export a bundle first. Export periodically if the assessments
matter.

**If the app is stuck on "Loading…"** it is waiting on the local database, usually
because another tab of the app is open. **Close the other tabs and reload.**

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
- Each skill shows the **ACA standard text** as an on-screen reference, with an
  optional plain-language **"In plain terms"** gloss beneath it for learners.
- **Top Tips**: under the skill navigation, a short progressive checklist of
  coaching cues — the top four show at once; check one off and the next
  surfaces. Progress is saved per paddler across sessions.
- **Feedback for learning** (on Review): each paddler gets a short summary —
  progress toward the level, strengths, and one **"Start with"** priority — and
  every below-standard skill points to the **next step to work** (its deepest
  unmet prerequisite), ordered as a learning path.
- **Paddlers over time**: the archive groups a paddler's assessments (by name,
  on device) into a **Journey** — per-strand progress, skills newly met, what to
  work next, and which skills are **due for a spaced re-check**.
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

Everything under `lessons-content/` is original work by the maintainer. So are
the plain-language glosses (`src/data/plain-language.json`) and the learning
progression (`src/data/progression.json`): these are the maintainer's own
pedagogical additions, kept in **separate files** so the ACA standard text in
`skills*.json` stays reproduced verbatim. A gloss restates a skill in everyday
words for a learner; it is **not** the official standard.

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

## Host + sync (any always-on machine)

`self-host/sync-server.mjs` is a tiny dependency-free Node server that serves the
built `dist/` **and** accepts `POST /sync` to archive finished sessions as JSON.
The hardware is irrelevant — a Raspberry Pi, an old laptop, a NAS, or a VPS you
control all work, as long as it runs Node 22+.

A service worker needs HTTPS, so the server needs a TLS origin. `tailscale serve`
is one way; a reverse proxy with a local certificate is another.

```bash
VITE_PRIVATE=true npm run build                 # enables the Sync button + archive
node self-host/sync-server.mjs                  # serves app + /sync on :8787
tailscale serve --https=443 http://localhost:8787
tailscale serve status                          # prints the https URL
```

The **Sync to server** button exists only in the `VITE_PRIVATE=true` build — the
public GitHub Pages build hides it, so public visitors assess, browse their
**Past assessments**, and export locally, with no server involved.

Open the HTTPS URL on your phone, **Add to Home Screen**, and it runs offline
from then on. Because the app and `/sync` share an origin, the in-app **Sync to
server** button works with no extra configuration. Full details in
[`self-host/README.md`](self-host/README.md).

## Updating

The app **updates itself.** It is a PWA with background auto-update, so a new
version is fetched quietly and applied the next time you fully close and reopen
it (or reload).

- **Apply an update:** close **all** tabs and windows of the app, then reopen it.
  A single reload usually suffices; closing every tab guarantees the new version
  takes effect. Installed to your home screen? Just close and reopen.
- **Storage upgrades:** some updates change the on-device database format. The
  upgrade runs automatically on the next open — but a stale tab left open can
  block it, so close other tabs when updating (see
  [Backup & recovery](#backup--recovery) if it seems stuck).
- **Self-hosted build:** update the server by running the one-command deploy
  **on it** — `self-host/deploy.sh` pulls, runs the tests, builds, restarts the
  service, and health-checks. See [Host + sync](#host--sync-any-always-on-machine).

## Contributing

The **Top Tips** coaching cues are crowdsourced. The easiest way to suggest one
is the **#top-tips** channel on [Discord](https://discord.gg/65QRCEbwX4) — no
GitHub account needed. To edit the data directly, see
[`CONTRIBUTING.md`](CONTRIBUTING.md) for the schema and the one rule that matters
(stable tip ids). The ACA skills and standards themselves are reproduced verbatim
and are not open for edits — see [Attribution](#attribution).

## Project docs

- [`docs/design.md`](docs/design.md) — design & architecture.
- [`docs/data-model.md`](docs/data-model.md) — the per-level data model.
- [`docs/techniques.md`](docs/techniques.md) — the Top Tips technique model and
  the (provisional) technique taxonomy.
- [`docs/implementation-plan.md`](docs/implementation-plan.md) — build plan.
