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

// `buildArg` is a thunk, not a value: it must only be invoked after the
// `metricsEnabled()` guard so building the payload (which touches
// `location`/`document`) never happens while metrics are disabled.
function send(buildArg) {
  if (!metricsEnabled()) return;
  try {
    loadGoatCounter();
    const gc = typeof window !== 'undefined' ? window.goatcounter : undefined;
    if (gc && typeof gc.count === 'function') gc.count(buildArg());
  } catch {
    // Never let telemetry break the app.
  }
}

export function countPageView() {
  send(() => ({ path: location.pathname + location.search, title: document.title }));
}

export function countEvent(path, title) {
  send(() => ({ path, title, event: true }));
}
