import { expect, test } from 'vitest';
import { sessionToCsv } from '../src/lib/csv.js';

const session = {
  scales: { L1: [], L2: [{ value: 'below', label: 'Below', requiresFeedback: true }, { value: 'l1', label: 'L1', requiresFeedback: true, dualOnly: true }, { value: 'meets', label: 'Meets', requiresFeedback: false }, { value: 'exceeds', label: 'Exceeds', requiresFeedback: false }] },
  paddlers: [{ id: 'p', name: 'Alex', target: 'L2' }],
  skills: [{ id: 'd', level: 'L2', category: 'Strokes', name: 'Fwd', optional: false, l1Standard: 'x' }],
  results: [{ paddlerId: 'p', skillId: 'd', rating: 'l1', feedback: 'said "hi", ok' }],
};

test('CSV header + row includes Target, Landing, and the rating label', () => {
  const lines = sessionToCsv(session).split('\n');
  expect(lines[0]).toBe('Paddler,Target,Landing,Category,Skill,Optional,Rating,Feedback');
  expect(lines[1]).toBe('Alex,L2,L1,Strokes,Fwd,,L1,"said ""hi"", ok"');
});
