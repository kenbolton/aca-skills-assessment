import { expect, test } from 'vitest';
import { LearnerSummary } from '../src/components/LearnerSummary.jsx';

function text(node) {
  if (node == null || node === false) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(text).join(' ');
  const type = node.type;
  if (typeof type === 'function') return text(type(node.props));
  return text(node.props ? node.props.children : undefined);
}

const rows = [{
  key: 'alex', name: 'Alex', sessionCount: 2, latestTarget: 'L2',
  firstAt: '2026-08-01T10:00:00Z', lastAt: '2026-08-10T10:00:00Z',
  newlyMetCount: 2, belowCount: 1, metCount: 2, nextName: 'Stopping',
}];

test('renders a row per learner with sessions, growth, and the working edge', () => {
  const out = text(LearnerSummary({ rows }));
  expect(out).toMatch(/Alex/);
  expect(out).toMatch(/2 sessions/);
  expect(out).toMatch(/2 skills newly met/);
  expect(out).toMatch(/Working on:/);
  expect(out).toMatch(/Stopping/);
});

test('renders nothing when there are no learners', () => {
  expect(LearnerSummary({ rows: [] })).toBe(null);
  expect(LearnerSummary({ rows: null })).toBe(null);
});

test('omits the working-edge line when there is no current gap', () => {
  const done = [{ ...rows[0], belowCount: 0, nextName: null, newlyMetCount: 0 }];
  const out = text(LearnerSummary({ rows: done }));
  expect(out).not.toMatch(/Working on:/);
});
