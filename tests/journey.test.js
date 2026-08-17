import { expect, test, describe } from 'vitest';
import { learnerJourney } from '../src/lib/learner.js';

const L2_SCALE = [
  { value: 'below', label: 'Below', requiresFeedback: true },
  { value: 'meets', label: 'Meets' },
  { value: 'exceeds', label: 'Exceeds' },
  { value: 'dno', label: 'DNO' },
];
const mk = (id, cat, name) => ({ id, level: 'L2', category: cat, name, standard: `${name} standard`, optional: false });
const SKILLS = [
  mk('l2-forward', 'Core: Strokes', 'Forward Paddling'),
  mk('l2-reverse', 'Core: Strokes', 'Reverse Paddling'),
  mk('l2-stopping', 'Core: Strokes', 'Stopping'),
];
const r = (paddlerId, skillId, rating) => ({ paddlerId, skillId, rating, feedback: '' });
const mkSession = (id, createdAt, pid, ratings) => ({
  id, createdAt, scales: { L2: L2_SCALE }, skills: SKILLS,
  paddlers: [{ id: pid, name: 'Alex', target: 'L2' }],
  results: SKILLS.map(s => r(pid, s.id, ratings[s.id] ?? null)),
});

const s1 = mkSession('s1', '2026-07-01T00:00:00Z', 'p1', { 'l2-forward': 'below', 'l2-reverse': 'below', 'l2-stopping': 'below' });
const s2 = mkSession('s2', '2026-07-20T00:00:00Z', 'p2', { 'l2-forward': 'meets', 'l2-reverse': 'meets', 'l2-stopping': 'below' });
const sessions = [s1, s2];

describe('learnerJourney', () => {
  const j = learnerJourney(sessions, 'alex', new Date('2026-09-01T00:00:00Z'));

  test('assembles identity and totals', () => {
    expect(j.latestTarget).toBe('L2');
    expect(j.sessionCount).toBe(2);
    expect(j.metCount).toBe(2);
  });
  test('strand progress counts met against the full strand size', () => {
    const strokes = j.strands.find(s => /Strokes/.test(s.name));
    expect(strokes.met).toBe(2);   // forward + reverse met
    expect(strokes.total).toBe(4); // Strokes strand has 4 skills in the progression
  });
  test('growth lists skills newly met, by name', () => {
    expect(j.newlyMet.sort()).toEqual(['Forward Paddling', 'Reverse Paddling']);
  });
  test('gaps and the next step carry names and a plain-language gloss', () => {
    expect(j.gaps).toEqual(['Stopping']);
    expect(j.next.name).toBe('Stopping');
    expect(j.next.gloss).toMatch(/stop/i);
  });
  test('due re-checks are named and present by the future now', () => {
    expect(j.due.length).toBeGreaterThan(0);
    expect(j.due[0]).toHaveProperty('name');
  });
  test('history is the learner sessions, newest first, with a landing', () => {
    expect(j.history.map(h => h.id)).toEqual(['s2', 's1']);
    expect(typeof j.history[0].landing).toBe('string');
  });
  test('returns null for an unknown learner', () => {
    expect(learnerJourney(sessions, 'nobody')).toBe(null);
  });
});
