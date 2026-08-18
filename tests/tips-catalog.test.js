import { expect, test, describe } from 'vitest';
import { tipsCatalog, skillMeta } from '../src/lib/tips-catalog.js';

const cat = tipsCatalog();
const allSkills = cat.levels.flatMap(l => l.strands.flatMap(s => s.skills.map(sk => ({ ...sk, level: l.level }))));
const find = id => allSkills.find(s => s.skillId === id);

describe('tipsCatalog (skills whose technique has tips)', () => {
  test('spans every level a mapped technique appears at', () => {
    // forward-stroke (L2,L3), stopping (L1,L2,L3), wet-exit (L1,L2,L3).
    expect(cat.levels.map(l => l.level)).toEqual(['L1', 'L2', 'L3']);
    expect(cat.skillCount).toBe(8);
  });

  test('the same technique surfaces at each of its levels (universality)', () => {
    const l2 = find('l2-forward');
    const l3 = find('l3-strokes-and-maneuvers-01');
    expect(l2.level).toBe('L2');
    expect(l3.level).toBe('L3');
    expect(l2.tipCount).toBe(6);
    expect(l3.tipCount).toBe(6); // same forward-stroke cues, one authoring
  });

  test('groups by strand with names', () => {
    const l2 = cat.levels.find(l => l.level === 'L2');
    expect(l2.strands.some(s => s.name === 'Core: Strokes')).toBe(true);
  });
});

describe('skillMeta', () => {
  test('resolves a skill id to name/level', () => {
    expect(skillMeta('l2-wet-exit').name).toBe('Capsize & Wet Exit');
    expect(skillMeta('l2-wet-exit').level).toBe('L2');
  });
  test('returns null for an unknown id', () => {
    expect(skillMeta('nope')).toBe(null);
  });
});
