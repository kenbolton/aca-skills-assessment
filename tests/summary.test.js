import { expect, test } from 'vitest';
import { paddlerSummary } from '../src/lib/summary.js';

const session = {
  scales: {
    L1: [{ value: 'no', label: 'No', requiresFeedback: true }, { value: 'pass', label: 'Pass', requiresFeedback: false }, { value: 'dno', label: 'DNO', requiresFeedback: false }],
    L2: [{ value: 'below', label: 'Below', requiresFeedback: true }, { value: 'l1', label: 'L1', requiresFeedback: true, dualOnly: true }, { value: 'meets', label: 'Meets', requiresFeedback: false }, { value: 'exceeds', label: 'Exceeds', requiresFeedback: false }],
  },
  paddlers: [{ id: 'p', name: 'Alex', target: 'L2' }],
  skills: [
    { id: 'd', level: 'L2', category: 'Strokes', name: 'Fwd', standard: 's', optional: false, l1Standard: 'x' },
    { id: 'm', level: 'L2', category: 'Strokes', name: 'Stop', standard: 's', optional: false },
    { id: 'opt', level: 'L2', category: 'Venue', name: 'Currents', standard: 's', optional: true },
  ],
  results: [
    { paddlerId: 'p', skillId: 'd', rating: 'l1', feedback: 'met L1 only' },
    { paddlerId: 'p', skillId: 'm', rating: 'meets', feedback: '' },
    { paddlerId: 'p', skillId: 'opt', rating: 'below', feedback: '' },
  ],
};

test('paddlerSummary reports landing, counts, and flagged items', () => {
  const s = paddlerSummary(session, 'p');
  expect(s).toMatchObject({ name: 'Alex', target: 'L2', landing: 'L1', coreTotal: 2 });
  expect(s.counts).toEqual({ below: 0, l1: 1, meets: 1, exceeds: 0 });
  expect(s.flagged.map(f => f.skillId)).toEqual(['d']);
  expect(s.flagged[0].ratingLabel).toBe('L1');
  expect(s.optionalItems.map(o => o.skillId)).toEqual(['opt']);
});
