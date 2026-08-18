import { beforeEach, expect, test, describe } from 'vitest';
import { WHELM_STEPS, DEFAULT_WHELM, revealFor, readWhelm, writeWhelm } from '../src/lib/whelm.js';

// The vitest `node` environment has no global localStorage; match the shim
// pattern used in tests/store.test.js.
if (typeof globalThis.localStorage === 'undefined') {
  const map = new Map();
  globalThis.localStorage = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
  };
}

beforeEach(() => localStorage.clear());

describe('whelm steps', () => {
  test('runs over to under, revealing 5, 4 then 3 tips', () => {
    expect(WHELM_STEPS.map(s => [s.key, s.reveal]))
      .toEqual([['over', 5], ['mid', 4], ['under', 3]]);
  });

  test('mid is the default, so the panel keeps revealing 4', () => {
    expect(DEFAULT_WHELM).toBe('mid');
    expect(revealFor(DEFAULT_WHELM)).toBe(4);
  });

  test('an unknown step falls back to the default rather than blanking', () => {
    expect(revealFor('sideways')).toBe(4);
    expect(revealFor(undefined)).toBe(4);
  });
});

describe('persistence', () => {
  test('defaults to mid when nothing is stored', () => {
    expect(readWhelm()).toBe('mid');
  });

  test('round-trips a chosen step', () => {
    writeWhelm('under');
    expect(readWhelm()).toBe('under');
    expect(revealFor(readWhelm())).toBe(3);
  });

  test('ignores a stored value that is not a step', () => {
    localStorage.setItem('aca-assessment:whelm', 'drenched');
    expect(readWhelm()).toBe('mid');
  });
});
