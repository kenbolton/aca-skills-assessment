import { expect, test, describe } from 'vitest';
import { paddlerSummary } from '../src/lib/summary.js';

const L2_SCALE = [
  { value: 'below', label: 'Below', requiresFeedback: true },
  { value: 'meets', label: 'Meets' },
  { value: 'exceeds', label: 'Exceeds' },
  { value: 'dno', label: 'DNO' },
];
const mk = (id, cat, name) => ({ id, level: 'L2', category: cat, name, standard: `${name} standard`, optional: false });

// Results are given in a scrambled order to prove foundation-first re-ordering.
function sess(ratings) {
  const skills = [
    mk('l2-secure-rack', 'Core: Incident Prevention and Management', 'Securing Kayak to Rack'),
    mk('l2-forward', 'Core: Strokes', 'Forward Paddling'),
    mk('l2-reverse', 'Core: Strokes', 'Reverse Paddling'),
    mk('l2-stopping', 'Core: Strokes', 'Stopping'),
  ];
  const order = ['l2-stopping', 'l2-secure-rack', 'l2-forward', 'l2-reverse'];
  return {
    id: 's', createdAt: 't', scales: { L2: L2_SCALE },
    paddlers: [{ id: 'p', name: 'A', target: 'L2' }], skills,
    results: order.map(id => ({ paddlerId: 'p', skillId: id, rating: ratings[id] ?? null, feedback: ratings[id] === 'below' ? 'n' : '' })),
  };
}

describe('paddlerSummary formative fields', () => {
  test('strengths lists exceeded skills only, by name', () => {
    const s = paddlerSummary(sess({ 'l2-forward': 'exceeds', 'l2-reverse': 'meets' }), 'p');
    expect(s.strengths).toEqual(['Forward Paddling']);
  });

  test('priorityNext is the foundation-first next step across all gaps', () => {
    // Only stopping below; its prerequisites (forward, reverse) unrated → forward.
    const s = paddlerSummary(sess({ 'l2-stopping': 'below' }), 'p');
    expect(s.priorityNext).toEqual({ skillId: 'l2-forward', name: 'Forward Paddling' });
  });

  test('priorityNext is null when there are no gaps', () => {
    const s = paddlerSummary(sess({ 'l2-forward': 'meets', 'l2-reverse': 'meets', 'l2-stopping': 'meets', 'l2-secure-rack': 'meets' }), 'p');
    expect(s.priorityNext).toBe(null);
  });

  test('flagged is ordered foundation-first, not result order', () => {
    // Given below on stopping (Strokes) and secure-rack (Incident Prevention),
    // Incident Prevention sorts first (earlier strand).
    const s = paddlerSummary(sess({ 'l2-stopping': 'below', 'l2-secure-rack': 'below' }), 'p');
    expect(s.flagged.map(f => f.skillId)).toEqual(['l2-secure-rack', 'l2-stopping']);
  });
});
