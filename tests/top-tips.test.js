import { expect, test, describe } from 'vitest';
import { learnerKey, tipsFor, visibleTips, toggleMastered, masteredIds } from '../src/lib/top-tips.js';

describe('learnerKey', () => {
  test('normalizes name: trim, collapse whitespace, lowercase', () => {
    expect(learnerKey('  Alex   B ')).toBe('alex b');
    expect(learnerKey('ALEX')).toBe('alex');
    expect(learnerKey('')).toBe('');
  });
});

describe('tipsFor', () => {
  test('returns an ordered list of {id,text} for a seeded skill', () => {
    const tips = tipsFor('l2-forward');
    expect(tips.length).toBeGreaterThanOrEqual(4);
    expect(tips[0]).toHaveProperty('id');
    expect(tips[0]).toHaveProperty('text');
  });
  test('returns [] for a skill with no tips', () => {
    expect(tipsFor('nonexistent')).toEqual([]);
  });
});

describe('visibleTips (progressive window)', () => {
  const tips = [
    { id: 't1', text: 'one' }, { id: 't2', text: 'two' }, { id: 't3', text: 'three' },
    { id: 't4', text: 'four' }, { id: 't5', text: 'five' }, { id: 't6', text: 'six' },
  ];
  test('shows the first N unchecked when nothing is mastered', () => {
    const v = visibleTips(tips, [], 4);
    expect(v.visible.map(t => t.id)).toEqual(['t1', 't2', 't3', 't4']);
    expect(v.total).toBe(6);
    expect(v.remaining).toBe(6);
  });
  test('mastering one surfaces the next unchecked tip', () => {
    const v = visibleTips(tips, ['t2'], 4);
    expect(v.visible.map(t => t.id)).toEqual(['t1', 't3', 't4', 't5']);
    expect(v.mastered.map(t => t.id)).toEqual(['t2']);
    expect(v.remaining).toBe(5);
  });
  test('empty visible when all are mastered', () => {
    const v = visibleTips(tips, ['t1', 't2', 't3', 't4', 't5', 't6'], 4);
    expect(v.visible).toEqual([]);
    expect(v.remaining).toBe(0);
  });
});

describe('checks map helpers', () => {
  test('masteredIds reads the array for a skill, or []', () => {
    expect(masteredIds({ 'l2-forward': ['t1'] }, 'l2-forward')).toEqual(['t1']);
    expect(masteredIds({}, 'l2-forward')).toEqual([]);
  });
  test('toggleMastered keys mastery by technique, immutably', () => {
    const c0 = {};
    const c1 = toggleMastered(c0, 'l2-forward', 't1'); // l2-forward → forward-stroke
    expect(c1['forward-stroke']).toEqual(['t1']);
    expect(c0).toEqual({}); // original untouched
    const c2 = toggleMastered(c1, 'l2-forward', 't1');
    expect(c2['forward-stroke']).toEqual([]);
  });
  test('a cue mastered at one level is mastered at another (same technique)', () => {
    // l3-strokes-and-maneuvers-01 is also forward-stroke.
    const c = toggleMastered({}, 'l2-forward', 'f1');
    expect(masteredIds(c, 'l3-strokes-and-maneuvers-01')).toEqual(['f1']);
  });
  test('toggleMastered migrates a legacy skill-keyed entry to the technique', () => {
    const legacy = { 'l2-forward': ['f1'] };
    const migrated = toggleMastered(legacy, 'l2-forward', 'f2');
    expect(migrated['forward-stroke'].sort()).toEqual(['f1', 'f2']);
    expect(migrated['l2-forward']).toBeUndefined();
  });
});
