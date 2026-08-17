import { expect, test, describe } from 'vitest';
import { recheckIntervalDays, dueRechecks } from '../src/lib/recheck.js';

const hist = (...ratings) => ratings.map((rating, i) => ({ at: `2026-0${i + 1}-01T00:00:00Z`, target: 'L2', rating }));

describe('recheckIntervalDays', () => {
  test('a gap is due soon (1 week)', () => {
    expect(recheckIntervalDays(hist('below'))).toBe(7);
    expect(recheckIntervalDays(hist('meets', 'l1'))).toBe(7); // latest is the gap
  });
  test('met once → 2 weeks; met twice or more → 6 weeks', () => {
    expect(recheckIntervalDays(hist('below', 'meets'))).toBe(14);
    expect(recheckIntervalDays(hist('below', 'meets', 'meets'))).toBe(42);
  });
  test('exceeds → 3 months', () => {
    expect(recheckIntervalDays(hist('meets', 'exceeds'))).toBe(90);
  });
  test('did-not-observe is not schedulable', () => {
    expect(recheckIntervalDays(hist('dno'))).toBe(null);
    expect(recheckIntervalDays([])).toBe(null);
  });
});

describe('dueRechecks', () => {
  const now = new Date('2026-08-17T00:00:00Z');
  const rec = {
    timeline: [
      // below, last seen 2026-08-07 (10 days ago), interval 7 → overdue by 3
      { skillId: 'l2-stopping', history: hist('below'), currentAt: '2026-08-07T00:00:00Z' },
      // met once, last seen 2026-08-14 (3 days ago), interval 14 → not due
      { skillId: 'l2-forward', history: hist('below', 'meets'), currentAt: '2026-08-14T00:00:00Z' },
      // gap, last seen 2026-08-01 (16 days ago), interval 7 → overdue by 9
      { skillId: 'l2-wet-exit', history: hist('below'), currentAt: '2026-08-01T00:00:00Z' },
    ],
  };
  test('returns only the skills past their interval, most overdue first', () => {
    const due = dueRechecks(rec, now);
    expect(due.map(d => d.skillId)).toEqual(['l2-wet-exit', 'l2-stopping']);
    expect(due[0].overdueDays).toBe(9);
    expect(due[1].overdueDays).toBe(3);
  });
  test('empty when nothing is due', () => {
    expect(dueRechecks({ timeline: [rec.timeline[1]] }, now)).toEqual([]);
  });
});
