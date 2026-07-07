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

describe('metrics emission', () => {
  beforeEach(() => { vi.resetModules(); });
  afterEach(() => { vi.unstubAllEnvs(); delete globalThis.navigator; delete globalThis.window; delete globalThis.document; delete globalThis.location; });

  function fakeDom() {
    const created = [];
    Object.defineProperty(globalThis, 'navigator', {
      value: { doNotTrack: undefined, onLine: true },
      configurable: true,
      writable: true,
    });
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
    expect(created[0].src).toBe('//gc.zgo.at/count.js');
    expect(created[0]['data-goatcounter']).toBe('https://aca-skills.goatcounter.com/count');
    expect(created[0].async).toBe('true');
  });

  it('emits a page-view arg with the path/title and no event key', async () => {
    vi.stubEnv('VITE_GOATCOUNTER_CODE', 'aca-skills');
    const { calls } = fakeDom();
    const m = await import('../src/lib/metrics.js');
    m.countPageView();
    expect(calls[0]).toEqual({ path: '/aca-skills-assessment/', title: 'ACA Skills Assessment' });
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
