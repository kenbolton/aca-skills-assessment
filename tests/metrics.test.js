import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// A minimal fake browser environment for the node test env.
function fakeEnv({ dnt = undefined, online = true } = {}) {
  const calls = [];
  // Node 22+ defines a built-in getter-only `navigator` accessor on
  // globalThis, so a plain assignment throws on whichever test runs first.
  // Redefine it as a plain writable/configurable data property instead.
  Object.defineProperty(globalThis, 'navigator', {
    value: { doNotTrack: dnt, onLine: online },
    configurable: true,
    writable: true,
  });
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
