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
