import { expect, test } from 'vitest';
import { sessionSummary } from '../src/lib/session-summary.js';

const v3 = {
  id: 's3', createdAt: 't',
  paddlers: [{ id: 'p', name: 'Alex', target: 'L2' }],
  skills: [{ id: 'd', level: 'L2', optional: false, l1Standard: 'x' }],
  results: [{ paddlerId: 'p', skillId: 'd', rating: 'meets', feedback: '' }],
};
const v2 = { id: 's2', createdAt: 't', levelId: 'L2', levelName: 'Level 2', paddlers: [{ id: 'p', name: 'Sam' }], skills: [{ id: 'x', optional: false }], results: [{ paddlerId: 'p', skillId: 'x', rating: 'meets' }] };

test('v3 summary has targets + landings, no level', () => {
  const s = sessionSummary(v3);
  expect(s.participants).toEqual(['Alex']);
  expect(s.targets).toEqual(['L2']);
  expect(s.landings).toEqual(['L2']);
  expect(s.level).toBe('');
});
test('v2 summary degrades: level set, no landings, no throw', () => {
  const s = sessionSummary(v2);
  expect(s.participants).toEqual(['Sam']);
  expect(s.level).toBe('Level 2');
  expect(s.landings).toEqual([]);
});
