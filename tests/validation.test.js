import { expect, test } from 'vitest';
import { resultNeedsFeedback, invalidResults, isSessionComplete, skillStatus } from '../src/lib/validation.js';

const session = {
  scales: {
    L1: [{ value: 'no', label: 'No', requiresFeedback: true }, { value: 'pass', label: 'Pass', requiresFeedback: false }],
    L2: [{ value: 'below', label: 'Below', requiresFeedback: true }, { value: 'l1', label: 'L1', requiresFeedback: true, dualOnly: true }, { value: 'meets', label: 'Meets', requiresFeedback: false }],
  },
  skills: [
    { id: 'd', level: 'L2', optional: false, l1Standard: 'x' },
    { id: 'o', level: 'L2', optional: true, l1Standard: 'x' },
  ],
  results: [],
};
const withResults = rs => ({ ...session, results: rs });

test('l1 rating with empty feedback needs feedback (dual skill)', () => {
  expect(resultNeedsFeedback(withResults([]), { skillId: 'd', rating: 'l1', feedback: ' ' })).toBe(true);
  expect(resultNeedsFeedback(withResults([]), { skillId: 'd', rating: 'l1', feedback: 'note' })).toBe(false);
  expect(resultNeedsFeedback(withResults([]), { skillId: 'd', rating: 'meets', feedback: '' })).toBe(false);
});

test('optional skill never needs feedback', () => {
  expect(resultNeedsFeedback(withResults([]), { skillId: 'o', rating: 'below', feedback: '' })).toBe(false);
});

test('isSessionComplete requires all core rated and no invalid', () => {
  expect(isSessionComplete(withResults([{ skillId: 'd', rating: 'meets', feedback: '' }]))).toBe(true);
  expect(isSessionComplete(withResults([{ skillId: 'd', rating: null, feedback: '' }]))).toBe(false);
  expect(isSessionComplete(withResults([{ skillId: 'd', rating: 'below', feedback: '' }]))).toBe(false);
});

test('isSessionComplete treats a required DNO as incomplete, but an optional DNO is fine', () => {
  expect(isSessionComplete(withResults([{ skillId: 'd', rating: 'dno', feedback: '' }]))).toBe(false);
  expect(isSessionComplete(withResults([
    { skillId: 'd', rating: 'meets', feedback: '' },
    { skillId: 'o', rating: 'dno', feedback: '' },
  ]))).toBe(true);
});

test('skillStatus reflects completion across the paddlers a skill applies to', () => {
  const skill = { id: 'd', level: 'L2', optional: false, l1Standard: 'x' };
  const base = { scales: session.scales, paddlers: [{ id: 'p1', target: 'L2' }, { id: 'p2', target: 'L2' }], skills: [skill] };
  const st = results => skillStatus({ ...base, results }, skill);
  const r = (p, rating, feedback = '') => ({ paddlerId: p, skillId: 'd', rating, feedback });
  expect(st([r('p1', null), r('p2', null)])).toBe('todo');
  expect(st([r('p1', 'meets'), r('p2', null)])).toBe('todo');
  expect(st([r('p1', 'meets'), r('p2', 'meets')])).toBe('done');
  expect(st([r('p1', 'meets'), r('p2', 'below')])).toBe('warn');
  expect(st([r('p1', 'meets'), r('p2', 'below', 'tippy')])).toBe('done');
});

test('self-assessment waives all required feedback', () => {
  const s = withResults([]);
  expect(resultNeedsFeedback({ ...s, selfAssessment: true }, { skillId: 'd', rating: 'l1', feedback: ' ' })).toBe(false);
  expect(resultNeedsFeedback({ ...s, selfAssessment: true }, { skillId: 'd', rating: 'below', feedback: '' })).toBe(false);
  // control: without the flag the same below rating still needs feedback
  expect(resultNeedsFeedback(s, { skillId: 'd', rating: 'below', feedback: '' })).toBe(true);
});
