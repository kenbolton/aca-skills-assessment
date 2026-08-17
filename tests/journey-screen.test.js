import { expect, test } from 'vitest';
import { Journey } from '../src/screens/Journey.jsx';

function text(node) {
  if (node == null || node === false) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(text).join(' ');
  const type = node.type;
  if (typeof type === 'function') return text(type(node.props));
  return text(node.props ? node.props.children : undefined);
}

const journey = {
  key: 'alex', name: 'Alex', latestTarget: 'L2', sessionCount: 2,
  firstAt: '2026-07-01T00:00:00Z', lastAt: '2026-07-20T00:00:00Z',
  metCount: 2, totalSkills: 36,
  strands: [
    { key: 'strokes', name: 'Core: Strokes', met: 2, total: 4 },
    { key: 'rescues', name: 'Core: Rescues and Towing', met: 0, total: 6 },
  ],
  newlyMet: ['Forward Paddling', 'Reverse Paddling'],
  gaps: ['Stopping'],
  next: { skillId: 'l2-stopping', name: 'Stopping', gloss: 'Bring the boat to a stop under control.' },
  due: [{ skillId: 'l2-stopping', name: 'Stopping', overdueDays: 5 }],
  history: [
    { id: 's2', at: '2026-07-20T00:00:00Z', target: 'L2', landing: 'L2' },
    { id: 's1', at: '2026-07-01T00:00:00Z', target: 'L2', landing: 'did_not_meet_L1' },
  ],
};

test('renders the learner header and overall progress', () => {
  const out = text(Journey({ journey, onBack: () => {} }));
  expect(out).toMatch(/Alex/);
  expect(out).toMatch(/2 of 36 skills met/);
});

test('renders strand progress with met/total', () => {
  const out = text(Journey({ journey, onBack: () => {} }));
  expect(out).toMatch(/Core: Strokes/);
  expect(out).toMatch(/2\/4/);
});

test('renders growth, working-on with gloss, due, and history', () => {
  const out = text(Journey({ journey, onBack: () => {} }));
  expect(out).toMatch(/Forward Paddling/);        // growth
  expect(out).toMatch(/Stopping/);                // working on
  expect(out).toMatch(/stop under control/i);     // gloss
  expect(out).toMatch(/re-check/i);               // due section
  expect(out).toMatch(/2026/);                    // history date
});

test('omits empty sections gracefully', () => {
  const bare = { ...journey, newlyMet: [], next: null, due: [] };
  const out = text(Journey({ journey: bare, onBack: () => {} }));
  expect(out).not.toMatch(/Growth/);
  expect(out).not.toMatch(/Working on/);
});
