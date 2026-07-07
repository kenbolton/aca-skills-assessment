// tests/competency.test.js
import { expect, test } from 'vitest';
import { targetLevelNum, skillLevelValue, competencyRadars } from '../src/lib/competency.js';

test('targetLevelNum maps L1..L5 and unknown', () => {
  expect(targetLevelNum('L1')).toBe(1);
  expect(targetLevelNum('L4')).toBe(4);
  expect(targetLevelNum('L5')).toBe(5);
  expect(targetLevelNum('X')).toBe(0);
});

test('skillLevelValue: L3/L4/L5 map below/meets/exceeds to T-1/T/T+0.5', () => {
  expect(skillLevelValue('L4', 'below')).toBe(3);
  expect(skillLevelValue('L4', 'meets')).toBe(4);
  expect(skillLevelValue('L4', 'exceeds')).toBe(4.5);
  expect(skillLevelValue('L3', 'below')).toBe(2);
  expect(skillLevelValue('L5', 'exceeds')).toBe(5.5);
});

test('skillLevelValue: L2 has the l1 landing rung', () => {
  expect(skillLevelValue('L2', 'below')).toBe(0);
  expect(skillLevelValue('L2', 'l1')).toBe(1);
  expect(skillLevelValue('L2', 'meets')).toBe(2);
  expect(skillLevelValue('L2', 'exceeds')).toBe(2.5);
});

test('skillLevelValue: L1 is no/pass, and DNO/unrated/unknown are gaps', () => {
  expect(skillLevelValue('L1', 'no')).toBe(0);
  expect(skillLevelValue('L1', 'pass')).toBe(1);
  expect(skillLevelValue('L4', 'dno')).toBe(null);
  expect(skillLevelValue('L4', null)).toBe(null);
  expect(skillLevelValue('L4', 'bogus')).toBe(null);
});

test('competencyRadars groups core target-level skills by category with per-skill levels', () => {
  const session = {
    paddlers: [{ id: 'p', name: 'A', target: 'L3' }],
    skills: [
      { id: 's1', level: 'L3', category: 'Strokes', optional: false },
      { id: 's2', level: 'L3', category: 'Strokes', optional: false },
      { id: 's3', level: 'L3', category: 'Rescues', optional: false },
      { id: 'opt', level: 'L3', category: 'Strokes', optional: true },   // excluded (optional)
      { id: 'other', level: 'L2', category: 'Strokes', optional: false }, // excluded (level)
    ],
    results: [
      { paddlerId: 'p', skillId: 's1', rating: 'exceeds' },
      { paddlerId: 'p', skillId: 's2', rating: 'dno' },
      // s3 has no result -> unrated -> null
    ],
  };
  expect(competencyRadars(session, 'p')).toEqual([
    { category: 'Strokes', levels: [3.5, null] },
    { category: 'Rescues', levels: [null] },
  ]);
});
