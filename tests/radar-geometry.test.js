// tests/radar-geometry.test.js
import { expect, test } from 'vitest';
import { radarPoints, ringPolygonPoints } from '../src/lib/radar-geometry.js';

const OPTS = { cx: 60, cy: 60, r: 50, max: 5.5 };

test('radarPoints: one entry per value, first spoke at 12 o\'clock, null passthrough', () => {
  const pts = radarPoints([5.5, null, 5.5, 5.5], OPTS);
  expect(pts).toHaveLength(4);
  // first spoke straight up: x == cx, y == cy - r (value == max)
  expect(pts[0].x).toBeCloseTo(60, 5);
  expect(pts[0].y).toBeCloseTo(10, 5);
  expect(pts[1]).toBe(null);
});

test('radarPoints: radius scales with value/max', () => {
  const [p] = radarPoints([2.75], OPTS); // half of 5.5 -> radius 25 -> y = 60-25
  expect(p.x).toBeCloseTo(60, 5);
  expect(p.y).toBeCloseTo(35, 5);
});

test('ringPolygonPoints: count vertices for the ring', () => {
  const s = ringPolygonPoints(5.5, { ...OPTS, count: 4 });
  expect(s.trim().split(/\s+/)).toHaveLength(4);
});
