import { expect, test, describe } from 'vitest';
import { normalizeName, learners, learnerRecord, learnerRows } from '../src/lib/learner.js';

const r = (paddlerId, skillId, rating) => ({ paddlerId, skillId, rating, feedback: '' });
const mk = (id, createdAt, paddlers, results) => ({ id, createdAt, paddlers, skills: [], results });

// Alex assessed twice; forward+reverse improve below→meets, stopping stays below.
// The second session's name has stray spaces to exercise normalization.
const A = mk('sA', '2026-08-01T10:00:00Z',
  [{ id: 'p1', name: 'Alex', target: 'L2' }, { id: 'p2', name: 'Sam', target: 'L2' }],
  [r('p1', 'l2-forward', 'below'), r('p1', 'l2-reverse', 'below'), r('p1', 'l2-stopping', 'below'), r('p2', 'l2-forward', 'meets')]);
const B = mk('sB', '2026-08-10T10:00:00Z',
  [{ id: 'q1', name: ' Alex ', target: 'L2' }],
  [r('q1', 'l2-forward', 'meets'), r('q1', 'l2-reverse', 'meets'), r('q1', 'l2-stopping', 'below')]);
const sessions = [A, B];

describe('normalizeName', () => {
  test('trims, collapses whitespace, lowercases', () => {
    expect(normalizeName('  Alex   B ')).toBe('alex b');
    expect(normalizeName('ALEX')).toBe('alex');
    expect(normalizeName('')).toBe('');
  });
});

describe('learners', () => {
  test('groups by normalized name, newest activity first', () => {
    const ls = learners(sessions);
    expect(ls.map(l => l.key)).toEqual(['alex', 'sam']); // alex last active 08-10, sam 08-01
    const alex = ls.find(l => l.key === 'alex');
    expect(alex.sessionCount).toBe(2);
    expect(alex.name).toBe('Alex');        // display trimmed, latest casing
    expect(alex.firstAt).toBe('2026-08-01T10:00:00Z');
    expect(alex.lastAt).toBe('2026-08-10T10:00:00Z');
    expect(alex.latestTarget).toBe('L2');
    expect(ls.find(l => l.key === 'sam').sessionCount).toBe(1);
  });
});

describe('learnerRecord', () => {
  test('current mastery is latest-wins', () => {
    const rec = learnerRecord(sessions, 'alex');
    expect(rec.current['l2-forward']).toBe('meets');
    expect(rec.current['l2-stopping']).toBe('below');
  });
  test('timeline keeps the ordered history per skill', () => {
    const rec = learnerRecord(sessions, 'alex');
    const fwd = rec.timeline.find(t => t.skillId === 'l2-forward');
    expect(fwd.history.map(h => h.rating)).toEqual(['below', 'meets']);
  });
  test('newlyMet lists skills met now but not at first assessment', () => {
    const rec = learnerRecord(sessions, 'alex');
    expect(rec.newlyMet.sort()).toEqual(['l2-forward', 'l2-reverse']);
  });
  test('counts and gaps reflect the latest state', () => {
    const rec = learnerRecord(sessions, 'alex');
    expect(rec.metCount).toBe(2);
    expect(rec.belowCount).toBe(1);
    expect(rec.gaps).toEqual(['l2-stopping']);
  });
  test('next points at the foundation-first gap via the progression', () => {
    const rec = learnerRecord(sessions, 'alex');
    // forward+reverse met, so stopping has no unmet prerequisite → itself.
    expect(rec.next).toBe('l2-stopping');
  });
  test('a single-session learner shows no newlyMet', () => {
    const rec = learnerRecord(sessions, 'sam');
    expect(rec.sessionCount).toBe(1);
    expect(rec.newlyMet).toEqual([]);
    expect(rec.metCount).toBe(1);
  });
  test('next walks to the deepest unmet prerequisite when a foundation is missing', () => {
    const C = mk('sC', '2026-08-05T10:00:00Z',
      [{ id: 'z1', name: 'Kim', target: 'L2' }],
      [r('z1', 'l2-forward', 'below'), r('z1', 'l2-stopping', 'below')]);
    const rec = learnerRecord([C], 'kim');
    expect(rec.next).toBe('l2-forward'); // stopping → reverse/forward unmet → forward
  });
  test('returns null for an unknown learner', () => {
    expect(learnerRecord(sessions, 'nobody')).toBe(null);
  });
});

describe('learnerRows', () => {
  test('builds one row per learner with growth count and named edge', () => {
    const rows = learnerRows(sessions);
    const alex = rows.find(rw => rw.key === 'alex');
    expect(alex.sessionCount).toBe(2);
    expect(alex.newlyMetCount).toBe(2);
    expect(alex.belowCount).toBe(1);
    // No skill objects in these fixtures, so the name falls back to the id.
    expect(alex.nextName).toBe('l2-stopping');
    expect(alex.dueCount).toBe(0); // no `now` → no re-check computed
  });

  test('with a now reference, counts re-checks due and names the most overdue', () => {
    // Latest ratings are from 2026-08-14; by 2026-09-01 all three are due.
    const rows = learnerRows(sessions, new Date('2026-09-01T00:00:00Z'));
    const alex = rows.find(rw => rw.key === 'alex');
    expect(alex.dueCount).toBe(3);
    expect(alex.dueTopName).toBe('l2-stopping'); // below → 7d, most overdue
  });
});
