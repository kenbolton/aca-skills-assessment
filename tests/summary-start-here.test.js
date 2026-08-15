import { expect, test } from 'vitest';
import { paddlerSummary } from '../src/lib/summary.js';

// Uses the real L2 progression chain: l2-forward → l2-reverse → l2-stopping.
const L2_SCALE = [
  { value: 'below', label: 'Below', requiresFeedback: true },
  { value: 'l1', label: 'L1', requiresFeedback: true, dualOnly: true },
  { value: 'meets', label: 'Meets' },
  { value: 'exceeds', label: 'Exceeds' },
  { value: 'dno', label: 'DNO' },
];
const L1_SCALE = [
  { value: 'no', label: 'No', requiresFeedback: true },
  { value: 'pass', label: 'Pass' },
  { value: 'dno', label: 'Did Not Observe' },
];
const mk = (id, level, category, name) => ({ id, level, category, name, standard: `${name} standard`, optional: false });

function l2Session(ratings) {
  const skills = [
    mk('l2-forward', 'L2', 'Core: Strokes', 'Forward Paddling'),
    mk('l2-reverse', 'L2', 'Core: Strokes', 'Reverse Paddling'),
    mk('l2-stopping', 'L2', 'Core: Strokes', 'Stopping'),
  ];
  return {
    id: 's', createdAt: 't', scales: { L2: L2_SCALE },
    paddlers: [{ id: 'p', name: 'Alex', target: 'L2' }], skills,
    results: skills.map(s => ({ paddlerId: 'p', skillId: s.id, rating: ratings[s.id] ?? null, feedback: '' })),
  };
}

test('L2 below-standard flagged item carries a start-here to its deepest unmet prerequisite', () => {
  const s = paddlerSummary(l2Session({ 'l2-forward': null, 'l2-reverse': null, 'l2-stopping': 'below' }), 'p');
  const stopping = s.flagged.find(f => f.skillId === 'l2-stopping');
  expect(stopping.startHere).toEqual({ skillId: 'l2-forward', name: 'Forward Paddling' });
});

test('no start-here when every prerequisite is already met (would point at the skill itself)', () => {
  const s = paddlerSummary(l2Session({ 'l2-forward': 'meets', 'l2-reverse': 'meets', 'l2-stopping': 'below' }), 'p');
  const stopping = s.flagged.find(f => f.skillId === 'l2-stopping');
  expect(stopping.startHere).toBeUndefined();
});

test('non-L2 flagged items get no start-here (this increment is L2 only)', () => {
  const skills = [mk('l1-secure-transport', 'L1', 'Preparing to Depart', 'Secure for transport')];
  const session = {
    id: 's', createdAt: 't', scales: { L1: L1_SCALE },
    paddlers: [{ id: 'p', name: 'Sam', target: 'L1' }], skills,
    results: [{ paddlerId: 'p', skillId: 'l1-secure-transport', rating: 'no', feedback: '' }],
  };
  const s = paddlerSummary(session, 'p');
  expect(s.flagged).toHaveLength(1);
  expect(s.flagged[0].startHere).toBeUndefined();
});
