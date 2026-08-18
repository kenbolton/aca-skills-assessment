import { expect, test, describe } from 'vitest';
import { techniqueCatalog, techniqueMeta, skillMeta } from '../src/lib/tips-catalog.js';

const cat = techniqueCatalog();
const find = t => cat.techniques.find(x => x.technique === t);

describe('techniqueCatalog (one row per technique, no level)', () => {
  test('lists each technique once, not once per level that examines it', () => {
    // stopping and wet-exit are examined at L1, L2 and L3; forward-stroke at L2
    // and L3. Eight skills, three rows.
    expect(cat.techniqueCount).toBe(3);
    expect(cat.techniques.map(t => t.technique).sort())
      .toEqual(['forward-stroke', 'stopping', 'wet-exit']);
  });

  test('carries the technique name and its one cue count', () => {
    expect(find('forward-stroke').name).toBe('Forward Stroke');
    expect(find('forward-stroke').tipCount).toBe(6);
  });

  test('orders foundation first, so no level headings are needed to read it', () => {
    // stopping and wet-exit start at L1, forward-stroke at L2.
    expect(cat.techniques.map(t => t.technique).indexOf('forward-stroke')).toBe(2);
  });

  test('keeps the mapped skills lowest level first', () => {
    expect(find('stopping').skills.map(s => s.level)).toEqual(['L1', 'L2', 'L3']);
    expect(find('stopping').skills[0].skillId).toBe('l1-stop');
  });

  test('exposes no level grouping at all', () => {
    expect(cat.levels).toBeUndefined();
    expect(Object.keys(cat.techniques[0])).not.toContain('level');
  });
});

describe('techniqueMeta', () => {
  test('resolves a technique to its detail row', () => {
    expect(techniqueMeta('wet-exit').name).toBe('Wet Exit');
  });
  test('returns null for an unknown technique', () => {
    expect(techniqueMeta('nope')).toBe(null);
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
