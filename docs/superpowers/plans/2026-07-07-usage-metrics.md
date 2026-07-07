# Usage Metrics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add privacy-respecting, cookieless usage metrics (traffic + install + assessment-started) for the public GitHub Pages site, plus a plain-language privacy statement, without weakening the app's offline/privacy guarantees.

**Architecture:** A single wrapper module (`src/lib/metrics.js`) is the only code that knows GoatCounter exists. It short-circuits (no network) on Do-Not-Track, offline, or missing site code, and lazily injects GoatCounter's external `count.js` (never precached by the service worker). `main.jsx` fires page-view + `appinstalled`; `Setup.handleStart()` fires the level-tagged assessment-started event. A new `PrivacyStatement` component and a README section disclose the behavior.

**Tech Stack:** Vite + Preact, Vitest (`environment: node`), `vite-plugin-pwa` (Workbox), GoatCounter (external, cookieless).

## Global Constraints

- **Node 22+** (LTS) — CI and the Pi both run Node 22.
- **Metrics must never throw into the app** — every metrics call is fire-and-forget and cannot break an offline assessment.
- **No PII, no cookies** — only anonymous page/event counts.
- **Honor Do-Not-Track** — suppress all counting when DNT is set.
- **Offline-safe** — no network attempt when `navigator.onLine === false`; the external `count.js` must NOT be added to `vite.config.js` `workbox.globPatterns`.
- **Config-gated** — site code from `import.meta.env.VITE_GOATCOUNTER_CODE`; when unset, metrics are fully disabled (this keeps the private Pi build silent).
- **Test env is `node`** (see `vite.config.js` `test.environment`); tests mock `navigator`/`document`, they do not use a DOM environment.
- **Preact** — components import from `preact`/`preact/hooks`; no React.

---

### Task 1: `metrics.js` — DNT / offline / config guards (no network)

Build the guard logic first, fully unit-tested, before any script injection. In this task `loadGoatCounter` is a stubbed side-effect boundary so the guards are testable in the `node` env.

**Files:**
- Create: `src/lib/metrics.js`
- Test: `tests/metrics.test.js`

**Interfaces:**
- Consumes: `import.meta.env.VITE_GOATCOUNTER_CODE` (string | undefined); globals `navigator`, `document`, `window`.
- Produces:
  - `metricsEnabled(): boolean` — true only when a site code is set, DNT is not set, and online.
  - `countPageView(): void` — records a page view when enabled; never throws.
  - `countEvent(path: string, title: string): void` — records a custom event when enabled; never throws.

**Notes for the implementer:**
- GoatCounter's client API is `window.goatcounter.count({ path, title, event: true })` for events, and `{ path, title }` for a page view. The script is loaded from `//gc.zgo.at/count.js` with `data-goatcounter="https://<CODE>.goatcounter.com/count"` and `async`.
- Do-Not-Track detection must cover the three historical spellings: `navigator.doNotTrack`, `window.doNotTrack`, `navigator.msDoNotTrack`. Treat the string `'1'` or `'yes'` as opted-out.
- Read the site code via `import.meta.env.VITE_GOATCOUNTER_CODE`. Vitest exposes `import.meta.env`; tests set it with `vi.stubEnv('VITE_GOATCOUNTER_CODE', 'aca-skills')`.

- [ ] **Step 1: Write the failing tests**

```js
// tests/metrics.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// A minimal fake browser environment for the node test env.
function fakeEnv({ dnt = undefined, online = true } = {}) {
  const calls = [];
  globalThis.navigator = { doNotTrack: dnt, onLine: online };
  globalThis.window = { goatcounter: { count: (arg) => calls.push(arg) } };
  return calls;
}

describe('metrics guards', () => {
  beforeEach(() => { vi.resetModules(); });
  afterEach(() => { vi.unstubAllEnvs(); delete globalThis.navigator; delete globalThis.window; });

  it('is disabled when no site code is configured', async () => {
    vi.stubEnv('VITE_GOATCOUNTER_CODE', '');
    fakeEnv();
    const m = await import('../src/lib/metrics.js');
    expect(m.metricsEnabled()).toBe(false);
  });

  it('is disabled when Do-Not-Track is set', async () => {
    vi.stubEnv('VITE_GOATCOUNTER_CODE', 'aca-skills');
    fakeEnv({ dnt: '1' });
    const m = await import('../src/lib/metrics.js');
    expect(m.metricsEnabled()).toBe(false);
  });

  it('is disabled when offline', async () => {
    vi.stubEnv('VITE_GOATCOUNTER_CODE', 'aca-skills');
    fakeEnv({ online: false });
    const m = await import('../src/lib/metrics.js');
    expect(m.metricsEnabled()).toBe(false);
  });

  it('is enabled with a site code, no DNT, and online', async () => {
    vi.stubEnv('VITE_GOATCOUNTER_CODE', 'aca-skills');
    fakeEnv();
    const m = await import('../src/lib/metrics.js');
    expect(m.metricsEnabled()).toBe(true);
  });

  it('countEvent and countPageView never throw when disabled', async () => {
    vi.stubEnv('VITE_GOATCOUNTER_CODE', '');
    fakeEnv();
    const m = await import('../src/lib/metrics.js');
    expect(() => m.countPageView()).not.toThrow();
    expect(() => m.countEvent('/start/L3/group', 'Assessment started')).not.toThrow();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/metrics.test.js`
Expected: FAIL — cannot resolve `../src/lib/metrics.js` (module does not exist).

- [ ] **Step 3: Write the minimal implementation (guards only; injection stubbed)**

```js
// src/lib/metrics.js
// The ONLY module that knows the app reports anything. Everything here is
// fire-and-forget and must never throw into the app or touch the network
// when the user has opted out (Do-Not-Track), is offline, or no site code
// is configured (which is how the private Pi build stays silent).

const SITE_CODE = import.meta.env.VITE_GOATCOUNTER_CODE || '';

function dntEnabled() {
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  const win = typeof window !== 'undefined' ? window : undefined;
  const raw = (nav && nav.doNotTrack) || (win && win.doNotTrack) || (nav && nav.msDoNotTrack);
  return raw === '1' || raw === 'yes';
}

function online() {
  return typeof navigator === 'undefined' ? false : navigator.onLine !== false;
}

export function metricsEnabled() {
  return Boolean(SITE_CODE) && !dntEnabled() && online();
}

// Side-effect boundary: overridden in Task 2 to inject the real script.
// Kept as a named export so it is a single, mockable seam.
export function loadGoatCounter() {
  // Task 1: no-op. Task 2 replaces this body with real injection.
}

function send(arg) {
  if (!metricsEnabled()) return;
  try {
    loadGoatCounter();
    const gc = typeof window !== 'undefined' ? window.goatcounter : undefined;
    if (gc && typeof gc.count === 'function') gc.count(arg);
  } catch {
    // Never let telemetry break the app.
  }
}

export function countPageView() {
  send({ path: location.pathname + location.search, title: document.title });
}

export function countEvent(path, title) {
  send({ path, title, event: true });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/metrics.test.js`
Expected: PASS (5 tests). `countPageView`/`countEvent` use `location`/`document`, but the "never throw when disabled" test short-circuits in `send` before touching them, so it passes in the `node` env.

- [ ] **Step 5: Commit**

```bash
git add src/lib/metrics.js tests/metrics.test.js
git commit -m "feat(metrics): add guarded GoatCounter wrapper (DNT/offline/config)"
```

---

### Task 2: Real script injection + emitted-argument tests

Replace the stubbed `loadGoatCounter` with real one-time script injection, and assert that when enabled the correct `goatcounter.count` argument is emitted for both a page view and an event.

**Files:**
- Modify: `src/lib/metrics.js`
- Test: `tests/metrics.test.js` (add cases)

**Interfaces:**
- Consumes: Task 1 exports (`metricsEnabled`, `countPageView`, `countEvent`, `loadGoatCounter`).
- Produces: same public API; `loadGoatCounter` now injects `//gc.zgo.at/count.js` exactly once (guarded by a module-level flag) with `data-goatcounter` pointing at the configured site.

- [ ] **Step 1: Write the failing tests (add to `tests/metrics.test.js`)**

```js
describe('metrics emission', () => {
  beforeEach(() => { vi.resetModules(); });
  afterEach(() => { vi.unstubAllEnvs(); delete globalThis.navigator; delete globalThis.window; delete globalThis.document; delete globalThis.location; });

  function fakeDom() {
    const created = [];
    globalThis.navigator = { doNotTrack: undefined, onLine: true };
    globalThis.location = { pathname: '/aca-skills-assessment/', search: '' };
    globalThis.document = {
      title: 'ACA Skills Assessment',
      querySelector: () => null,
      createElement: () => { const el = { setAttribute(k, v) { this[k] = v; } }; created.push(el); return el; },
      head: { appendChild: () => {} },
    };
    const calls = [];
    globalThis.window = { goatcounter: { count: (arg) => calls.push(arg) } };
    return { calls, created };
  }

  it('emits an event arg with event:true and the given path/title', async () => {
    vi.stubEnv('VITE_GOATCOUNTER_CODE', 'aca-skills');
    const { calls, created } = fakeDom();
    const m = await import('../src/lib/metrics.js');
    m.countEvent('/start/L1-L2/group', 'Assessment started');
    expect(calls).toEqual([{ path: '/start/L1-L2/group', title: 'Assessment started', event: true }]);
    expect(created.length).toBe(1); // script injected once
  });

  it('injects the script only once across multiple calls', async () => {
    vi.stubEnv('VITE_GOATCOUNTER_CODE', 'aca-skills');
    const { created } = fakeDom();
    const m = await import('../src/lib/metrics.js');
    m.countPageView();
    m.countEvent('/install', 'App installed');
    expect(created.length).toBe(1);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/metrics.test.js`
Expected: FAIL — `created.length` is `0` because Task 1's `loadGoatCounter` is a no-op (no script element is created).

- [ ] **Step 3: Replace `loadGoatCounter` with real injection**

Replace the `loadGoatCounter` function body in `src/lib/metrics.js` with:

```js
let injected = false;
export function loadGoatCounter() {
  if (injected) return;
  if (typeof document === 'undefined') return;
  injected = true;
  // Ensure the global exists before count.js loads so early calls are queued
  // by GoatCounter's own no-op shim (it replaces window.goatcounter on load).
  if (typeof window !== 'undefined' && !window.goatcounter) window.goatcounter = { no_onload: true };
  const s = document.createElement('script');
  s.setAttribute('src', '//gc.zgo.at/count.js');
  s.setAttribute('async', 'true');
  s.setAttribute('data-goatcounter', `https://${SITE_CODE}.goatcounter.com/count`);
  document.head.appendChild(s);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/metrics.test.js`
Expected: PASS (7 tests total).

- [ ] **Step 5: Commit**

```bash
git add src/lib/metrics.js tests/metrics.test.js
git commit -m "feat(metrics): inject GoatCounter count.js once, emit page/event counts"
```

---

### Task 3: Wire page-view + `appinstalled` in `main.jsx`

**Files:**
- Modify: `src/main.jsx`
- Test: `tests/main-metrics.test.js` (create) — unit-test the install-handler wiring via a small exported helper, since `main.jsx`'s `render` needs a DOM the `node` env lacks.

**Interfaces:**
- Consumes: `countPageView`, `countEvent` from `src/lib/metrics.js`.
- Produces: `src/lib/install-metric.js` exporting `registerInstallMetric(win)` — attaches an `appinstalled` listener to `win` that calls `countEvent('/install', 'App installed')`.

**Why a helper module:** `main.jsx` calls Preact `render` against `#app`, which does not exist in the `node` test env. Extracting the listener wiring into `src/lib/install-metric.js` keeps it testable without a DOM and keeps `main.jsx` a thin entry point (matches the repo's "thin views over pure libs" convention).

- [ ] **Step 1: Write the failing test**

```js
// tests/main-metrics.test.js
import { describe, it, expect, vi } from 'vitest';
import { registerInstallMetric } from '../src/lib/install-metric.js';

describe('registerInstallMetric', () => {
  it('counts an install event when appinstalled fires', () => {
    const handlers = {};
    const win = { addEventListener: (type, fn) => { handlers[type] = fn; } };
    const count = vi.fn();
    registerInstallMetric(win, count);
    expect(typeof handlers.appinstalled).toBe('function');
    handlers.appinstalled();
    expect(count).toHaveBeenCalledWith('/install', 'App installed');
  });

  it('does nothing when win has no addEventListener', () => {
    expect(() => registerInstallMetric(undefined, vi.fn())).not.toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/main-metrics.test.js`
Expected: FAIL — cannot resolve `../src/lib/install-metric.js`.

- [ ] **Step 3: Create the helper module**

```js
// src/lib/install-metric.js
// Wire the PWA appinstalled event to a metrics counter. `count` is injected
// for testability and defaults to the real countEvent.
import { countEvent } from './metrics.js';

export function registerInstallMetric(win, count = countEvent) {
  if (!win || typeof win.addEventListener !== 'function') return;
  win.addEventListener('appinstalled', () => count('/install', 'App installed'));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/main-metrics.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Wire it into `main.jsx`**

Replace the contents of `src/main.jsx` with:

```jsx
import { render } from 'preact';
import { App } from './app.jsx';
import { countPageView } from './lib/metrics.js';
import { registerInstallMetric } from './lib/install-metric.js';
import './styles.css';

countPageView();
registerInstallMetric(typeof window !== 'undefined' ? window : undefined);

render(<App />, document.getElementById('app'));
```

- [ ] **Step 6: Run the full test suite**

Run: `npx vitest run`
Expected: PASS (all existing tests + the new metrics/install tests).

- [ ] **Step 7: Commit**

```bash
git add src/main.jsx src/lib/install-metric.js tests/main-metrics.test.js
git commit -m "feat(metrics): count page view on boot and PWA install event"
```

---

### Task 4: Fire the level-tagged "assessment started" event in `Setup.jsx`

The `level` value (`L1/L2`, `L3`, `L4`, `L5`) is not on the session object; it lives as `Setup`'s `level` state. Fire the event in `handleStart()` immediately before `onStart(session)`, sanitizing the slash so `L1/L2` → `L1-L2`.

**Files:**
- Modify: `src/screens/Setup.jsx` (import + one call inside `handleStart`)
- Test: `tests/setup-metric.test.js` (create) — unit-test a small extracted pure helper for the event path, avoiding a full Preact render.

**Interfaces:**
- Consumes: `countEvent` from `src/lib/metrics.js`.
- Produces: `src/lib/start-metric.js` exporting `startEventPath(level, selfAssessment): string` → e.g. `('L1/L2', false)` ⇒ `'/start/L1-L2/group'`, `('L3', true)` ⇒ `'/start/L3/self'`.

**Why a helper:** the path-building rule (slash sanitization + self/group suffix) is the only logic worth testing; the `countEvent` call itself is a one-liner. Keeping the rule in a pure function tests it in the `node` env without rendering `Setup`.

- [ ] **Step 1: Write the failing test**

```js
// tests/setup-metric.test.js
import { describe, it, expect } from 'vitest';
import { startEventPath } from '../src/lib/start-metric.js';

describe('startEventPath', () => {
  it('sanitizes the L1/L2 slash and marks group', () => {
    expect(startEventPath('L1/L2', false)).toBe('/start/L1-L2/group');
  });
  it('keeps a standalone level and marks self', () => {
    expect(startEventPath('L3', true)).toBe('/start/L3/self');
  });
  it('handles L4/L5 group', () => {
    expect(startEventPath('L5', false)).toBe('/start/L5/group');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/setup-metric.test.js`
Expected: FAIL — cannot resolve `../src/lib/start-metric.js`.

- [ ] **Step 3: Create the helper module**

```js
// src/lib/start-metric.js
// Build the anonymous, aggregate GoatCounter path for an assessment-started
// event. The L1/L2 combined mode contains a slash, which would create a nested
// path segment, so it is replaced with a dash.
export function startEventPath(level, selfAssessment) {
  return '/start/' + String(level).replace('/', '-') + (selfAssessment ? '/self' : '/group');
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/setup-metric.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Wire it into `Setup.jsx`**

Add the imports near the top of `src/screens/Setup.jsx` (beside the existing `createSession` import):

```jsx
import { countEvent } from '../lib/metrics.js';
import { startEventPath } from '../lib/start-metric.js';
```

In `handleStart()`, replace the closing lines:

```jsx
    setError('');
    onStart(session);
```

with:

```jsx
    setError('');
    countEvent(startEventPath(level, selfAssessment), 'Assessment started');
    onStart(session);
```

- [ ] **Step 6: Run the full test suite**

Run: `npx vitest run`
Expected: PASS (all tests).

- [ ] **Step 7: Commit**

```bash
git add src/screens/Setup.jsx src/lib/start-metric.js tests/setup-metric.test.js
git commit -m "feat(metrics): count level-tagged assessment-started events"
```

---

### Task 5: Privacy statement component

A short, plain-language privacy statement rendered on the Setup screen. Covers the whole app's stance so it reads as a genuine statement, not an afterthought.

**Files:**
- Create: `src/components/PrivacyStatement.jsx`
- Modify: `src/screens/Setup.jsx` (render it near the existing `Attribution` footer)
- Test: `tests/privacy-statement.test.js` (create) — assert the rendered text mentions the key promises.

**Interfaces:**
- Consumes: nothing (static content).
- Produces: `PrivacyStatement()` Preact component (default-free named export, matching `Attribution`).

**Testing note:** the repo's Vitest env is `node`, so render the component to a string with `preact-render-to-string`. Check `package.json` first: if `preact-render-to-string` is not already a dependency, do NOT add one — instead test the text by calling the component and asserting on its returned VNode children, OR keep the copy in an exported constant and test that. Use the constant approach below (no new dependency, deterministic).

- [ ] **Step 1: Write the failing test**

```js
// tests/privacy-statement.test.js
import { describe, it, expect } from 'vitest';
import { PRIVACY_TEXT } from '../src/components/PrivacyStatement.jsx';

describe('privacy statement copy', () => {
  it('states that assessment data stays on the device', () => {
    expect(PRIVACY_TEXT.join(' ')).toMatch(/stays on (your|this) device/i);
  });
  it('discloses anonymous, cookieless counting and Do-Not-Track', () => {
    const all = PRIVACY_TEXT.join(' ');
    expect(all).toMatch(/anonymous/i);
    expect(all).toMatch(/cookieless|no cookies/i);
    expect(all).toMatch(/do[- ]not[- ]track/i);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/privacy-statement.test.js`
Expected: FAIL — cannot resolve `../src/components/PrivacyStatement.jsx`.

- [ ] **Step 3: Create the component**

```jsx
// src/components/PrivacyStatement.jsx
// A plain-language privacy statement. The app's core promise is that paddler
// data never leaves the device except to the owner's own server; the only
// telemetry is anonymous, cookieless page/event counts on the public site.
export const PRIVACY_TEXT = [
  'Your assessments stay on your device. Nothing you enter about a paddler is uploaded anywhere.',
  'You can optionally sync a finished session to your own private home server; it is never sent to anyone else.',
  'The public website keeps anonymous, cookieless counts of page visits, installs, and assessments started — no personal data, no cookies, and it honors your browser’s Do-Not-Track setting.',
];

export function PrivacyStatement() {
  return (
    <section className="privacy-statement" aria-label="Privacy">
      <h2>Privacy</h2>
      {PRIVACY_TEXT.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </section>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/privacy-statement.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Render it on the Setup screen**

In `src/screens/Setup.jsx`, add the import beside the other component imports:

```jsx
import { PrivacyStatement } from '../components/PrivacyStatement.jsx';
```

Find where `Setup` renders the existing `Attribution` footer (search for `Attribution`). Render `PrivacyStatement` immediately before it, e.g.:

```jsx
      <PrivacyStatement />
      <Attribution />
```

If `Setup.jsx` does not currently render `<Attribution />`, add both together at the end of the screen's returned markup, just before the closing `</main>` tag.

- [ ] **Step 6: Add minimal styling**

Append to `src/styles.css`:

```css
.privacy-statement {
  margin: 1.5rem 0 0;
  padding: 0.75rem 1rem;
  border-top: 1px solid #d7e3e5;
  color: #4a5a5d;
  font-size: 0.85rem;
}
.privacy-statement h2 {
  font-size: 0.9rem;
  margin: 0 0 0.4rem;
  color: #14323a;
}
.privacy-statement p { margin: 0 0 0.4rem; }
```

- [ ] **Step 7: Run the full test suite**

Run: `npx vitest run`
Expected: PASS (all tests).

- [ ] **Step 8: Commit**

```bash
git add src/components/PrivacyStatement.jsx src/screens/Setup.jsx src/styles.css tests/privacy-statement.test.js
git commit -m "feat(privacy): add plain-language privacy statement to setup screen"
```

---

### Task 6: README privacy section + offline/SW-safety verification

Document the privacy stance in the README and verify the two non-negotiable safety properties: the external script is not precached, and a production build succeeds.

**Files:**
- Modify: `README.md`
- Verify only (no edit expected): `vite.config.js` `workbox.globPatterns`

- [ ] **Step 1: Add a Privacy section to `README.md`**

Insert after the "Try it" section:

```markdown
## Privacy

Your assessments stay on your device — nothing you enter about a paddler is
uploaded anywhere. You can optionally sync a finished session to your own
private home server (e.g. a Raspberry Pi over Tailscale); it is never sent to
anyone else.

The public website keeps **anonymous, cookieless** counts of page visits, PWA
installs, and assessments started (via [GoatCounter](https://www.goatcounter.com/)).
No personal data and no cookies are collected, and the counter honors your
browser's **Do-Not-Track** setting. Counting is disabled entirely in the
self-hosted build.
```

- [ ] **Step 2: Verify the service worker will NOT precache the external script**

Run: `grep -n "globPatterns\|gc.zgo.at\|goatcounter" vite.config.js`
Expected: `globPatterns` lists only local asset extensions (`js,css,html,json,png,svg,woff2`); there is NO reference to `gc.zgo.at` or `goatcounter`. Because `count.js` is loaded from an external origin at runtime and is not a build output, Workbox will not precache it. **No change to `vite.config.js` is required.** If a reference exists, remove it.

- [ ] **Step 3: Verify a production build succeeds**

Run: `npm run build`
Expected: build completes; `dist/` regenerated with a service worker. No error referencing `metrics.js`, `count.js`, or `VITE_GOATCOUNTER_CODE` (an unset env var simply yields an empty site code — a clean, disabled build).

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: document anonymous cookieless usage metrics in README"
```

---

### Task 7: Owner setup note + `.env.example`

Make the one-time GoatCounter setup discoverable without hardcoding a site code.

**Files:**
- Create: `.env.example`
- Modify: `README.md` (Develop section)
- Verify: `.gitignore` ignores `.env` / `.env.local`

- [ ] **Step 1: Create `.env.example`**

```bash
# Public-site usage metrics (optional). Set to your GoatCounter site code to
# enable anonymous, cookieless counting on the PUBLIC build only. Leave unset
# (or empty) to disable metrics entirely — do this for the private/Pi build.
# Create a free site at https://www.goatcounter.com/ ; the code is the
# subdomain, e.g. for https://aca-skills.goatcounter.com use: aca-skills
VITE_GOATCOUNTER_CODE=
```

- [ ] **Step 2: Ensure `.env` files are git-ignored**

Run: `grep -nE '(^|/)\.env' .gitignore`
Expected: `.env` and/or `.env.local` are listed. If NOT present, append these lines to `.gitignore`:

```
.env
.env.local
```

- [ ] **Step 3: Add a build-config note to the README "Develop" section**

Append to the "Develop" section of `README.md`:

```markdown
### Usage metrics (optional)

The public site can keep anonymous, cookieless usage counts via GoatCounter.
Copy `.env.example` to `.env` and set `VITE_GOATCOUNTER_CODE` to your GoatCounter
site code, then build. Leaving it unset disables metrics — this is how the
self-hosted Pi build stays completely silent.
```

- [ ] **Step 4: Run the full test suite one final time**

Run: `npx vitest run`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add .env.example README.md .gitignore
git commit -m "docs: add .env.example and GoatCounter setup note"
```

---

## Manual verification (owner, post-merge)

These require a real browser and a GoatCounter account and cannot be unit-tested:

1. Create a free GoatCounter site; put its code in the public build's `VITE_GOATCOUNTER_CODE`; deploy.
2. Load the public URL in a browser with DNT **off** → confirm a page view appears on the GoatCounter dashboard within a minute.
3. Install the PWA (Add to Home Screen) → confirm an `/install` event appears.
4. Start an assessment at each level → confirm `/start/<level>/<self|group>` events appear.
5. Enable DNT in the browser and reload → confirm **no** new hits are recorded.
6. Load the installed app in airplane mode → confirm the app works normally and the console shows no network errors from `count.js`.

## Self-Review (completed by plan author)

- **Spec coverage:** metrics wrapper (Task 1–2), DNT/offline/config guards (Task 1), page view + install (Task 3), level-tagged start event fired from `Setup.handleStart` per the corrected spec (Task 4), privacy statement component + README (Task 5–6), SW/offline safety verification (Task 6), private-build disablement via unset env (Task 1 guard + Task 7). All spec sections map to a task.
- **Placeholder scan:** no TBD/TODO; every code step shows complete code.
- **Type consistency:** `countEvent(path, title)` / `countPageView()` / `metricsEnabled()` / `loadGoatCounter()` used consistently across Tasks 1–4; `startEventPath(level, selfAssessment)` and `registerInstallMetric(win, count)` signatures match their call sites; `PRIVACY_TEXT` (array) consumed identically in component and test.
