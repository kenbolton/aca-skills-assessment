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

// Side-effect boundary: injects GoatCounter's external count.js exactly
// once, guarded by a module-level flag. Kept as a named export so it is a
// single, mockable seam.
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
