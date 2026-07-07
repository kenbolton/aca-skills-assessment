import { expect, test } from 'vitest';
import { BEAUFORT, CURRENT_LEVELS, WAVE_HEIGHTS, beaufortSpec } from '../src/data/conditions.js';
import { createSession, conditionsSummary } from '../src/lib/session.js';

test('BEAUFORT has 13 forces F0..F12 in order, each well-formed with a spec', () => {
  expect(BEAUFORT).toHaveLength(13);
  BEAUFORT.forEach((b, i) => {
    expect(b.value.startsWith(`F${i} `)).toBe(true);
    expect(b.value).toMatch(/^F\d{1,2} .+ \(.*kn\)$/);
    expect(b.spec.length).toBeGreaterThan(0);
  });
});

test('current and height tables are non-empty; waves/surf share the height table', () => {
  expect(CURRENT_LEVELS.length).toBeGreaterThan(0);
  expect(WAVE_HEIGHTS.length).toBeGreaterThan(0);
  expect(CURRENT_LEVELS).toContain('1–2 kn');
  expect(WAVE_HEIGHTS).toContain('1–2 ft (0.3–0.6 m)');
});

test('beaufortSpec resolves a stored wind value and is safe on unknown/blank', () => {
  expect(beaufortSpec('F4 Moderate (11–16 kn)')).toBe('Raises dust, loose paper; small branches moved');
  expect(beaufortSpec('12 kn')).toBe('');   // an old free-text value
  expect(beaufortSpec('')).toBe('');
});

test('dropdown strings flow unchanged through createSession -> conditionsSummary', () => {
  const config = { scales: { L2: [] }, skills: [] };
  const s = createSession({
    id: 'c', createdAt: 't', config,
    conditions: { wind: 'F4 Moderate (11–16 kn)', waves: '1–2 ft (0.3–0.6 m)' },
    paddlers: [{ name: 'A', target: 'L2' }],
  });
  expect(s.conditions).toEqual({ wind: 'F4 Moderate (11–16 kn)', waves: '1–2 ft (0.3–0.6 m)' });
  expect(conditionsSummary(s)).toBe('Wind F4 Moderate (11–16 kn) · Waves 1–2 ft (0.3–0.6 m)');
});
