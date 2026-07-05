import { expect, test } from 'vitest';
import { sessionSummary } from '../src/lib/session-summary.js';

const session = {
  id: 'sess-1', createdAt: '2026-07-09T12:00:00Z', levelId: 'L2', levelName: 'Level 2',
  paddlers: [{ id: 'p1', name: 'Alex' }, { id: 'p2', name: 'Sam' }],
  skills: [
    { id: 'a', optional: false }, { id: 'b', optional: false }, { id: 'c', optional: true },
  ],
  results: [
    { paddlerId: 'p1', skillId: 'a', rating: 'meets' }, { paddlerId: 'p2', skillId: 'a', rating: 'meets' },
    { paddlerId: 'p1', skillId: 'b', rating: 'below' }, { paddlerId: 'p2', skillId: 'b', rating: null },
    { paddlerId: 'p1', skillId: 'c', rating: null }, { paddlerId: 'p2', skillId: 'c', rating: null },
  ],
};

test('sessionSummary projects id/date/level/paddlers and core counts', () => {
  const s = sessionSummary(session);
  expect(s).toMatchObject({ id: 'sess-1', createdAt: '2026-07-09T12:00:00Z', levelId: 'L2', levelName: 'Level 2' });
  expect(s.paddlers).toEqual(['Alex', 'Sam']);
  expect(s.counts).toEqual({ core: 2, rated: 1 }); // 'a' fully rated; 'b' not; 'c' optional excluded
});
