import { expect, test } from 'vitest';
import { landingFor } from '../src/lib/landing.js';

// dual L2 skill has l1Standard; l2-only does not.
const skills = [
  { id: 'dual', level: 'L2', optional: false, l1Standard: 'x' },
  { id: 'only', level: 'L2', optional: false },
  { id: 'l1a', level: 'L1', optional: false },
];
function s(target, rs) {
  return { skills, paddlers: [{ id: 'p', target }], results: rs.map(([skillId, rating]) => ({ paddlerId: 'p', skillId, rating, feedback: '' })) };
}

test('L2: all meets/exceeds -> L2', () => {
  expect(landingFor(s('L2', [['dual', 'meets'], ['only', 'exceeds']]), 'p').landing).toBe('L2');
});
test('L2: an l1 mark (no below) -> L1', () => {
  expect(landingFor(s('L2', [['dual', 'l1'], ['only', 'meets']]), 'p').landing).toBe('L1');
});
test('L2: an L2-only below (no dual below) -> L1', () => {
  expect(landingFor(s('L2', [['dual', 'meets'], ['only', 'below']]), 'p').landing).toBe('L1');
});
test('L2: a dual below -> did_not_meet_L1', () => {
  expect(landingFor(s('L2', [['dual', 'below'], ['only', 'meets']]), 'p').landing).toBe('did_not_meet_L1');
});
test('L2: an unrated core -> pending', () => {
  const r = landingFor(s('L2', [['dual', 'meets'], ['only', null]]), 'p');
  expect(r.landing).toBe('pending'); expect(r.pendingCount).toBe(1);
});
test('L1: all pass -> L1; a no -> did_not_meet_L1; a dno -> pending', () => {
  expect(landingFor(s('L1', [['l1a', 'pass']]), 'p').landing).toBe('L1');
  expect(landingFor(s('L1', [['l1a', 'no']]), 'p').landing).toBe('did_not_meet_L1');
  expect(landingFor(s('L1', [['l1a', 'dno']]), 'p').landing).toBe('pending');
});
