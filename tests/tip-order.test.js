// The reveal order is a readiness ladder, and a ladder deserves to be readable
// as one thing. Order therefore lives as a list of ids, apart from the cue text,
// so reordering is a one-line change and does not collide with rewording.
//
// The list is partial on purpose: a contributor can add a cue and never touch
// it. Unlisted cues follow the listed ones, in file order.
import { expect, test, describe } from 'vitest';
import { applyOrder, validateTipOrder } from '../src/lib/top-tips.js';

const cue = id => ({ id, text: `cue ${id}` });
const ids = cues => cues.map(c => c.id);
const CUES = [cue('a'), cue('b'), cue('c'), cue('d')];

describe('applyOrder puts listed cues first', () => {
  test('follows the listed order, not the file order', () => {
    expect(ids(applyOrder(CUES, ['c', 'a']))).toEqual(['c', 'a', 'b', 'd']);
  });

  test('keeps unlisted cues in file order, after the listed ones', () => {
    expect(ids(applyOrder(CUES, ['d']))).toEqual(['d', 'a', 'b', 'c']);
  });

  test('returns file order when no order is given', () => {
    expect(ids(applyOrder(CUES, undefined))).toEqual(['a', 'b', 'c', 'd']);
    expect(ids(applyOrder(CUES, []))).toEqual(['a', 'b', 'c', 'd']);
  });

  test('ignores a listed id that no longer exists', () => {
    expect(ids(applyOrder(CUES, ['c', 'gone', 'a']))).toEqual(['c', 'a', 'b', 'd']);
  });

  test('never drops or duplicates a cue', () => {
    const out = applyOrder(CUES, ['d', 'd', 'b']);
    expect(ids(out).sort()).toEqual(['a', 'b', 'c', 'd']);
    expect(out).toHaveLength(CUES.length);
  });

  test('does not mutate the cues it is given', () => {
    const before = ids(CUES);
    applyOrder(CUES, ['d', 'c']);
    expect(ids(CUES)).toEqual(before);
  });
});

describe('validateTipOrder catches order mistakes', () => {
  const TIPS = { 'forward-stroke': [cue('f1'), cue('f2')] };

  test('accepts a partial order over real ids', () => {
    expect(validateTipOrder({ 'forward-stroke': ['f2'] }, TIPS)).toEqual([]);
  });

  test('flags an order for a technique that has no cues', () => {
    const errs = validateTipOrder({ 'not-a-technique': ['x'] }, TIPS);
    expect(errs.some(e => /not-a-technique/.test(e))).toBe(true);
  });

  test('flags an id that the technique does not have', () => {
    const errs = validateTipOrder({ 'forward-stroke': ['f1', 'f99'] }, TIPS);
    expect(errs.some(e => /f99/.test(e))).toBe(true);
  });

  test('flags the same id listed twice', () => {
    const errs = validateTipOrder({ 'forward-stroke': ['f1', 'f1'] }, TIPS);
    expect(errs.some(e => /f1/.test(e))).toBe(true);
  });
});
