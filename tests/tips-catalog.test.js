import { expect, test, describe } from 'vitest';
import { techniqueCatalog, techniqueMeta, skillMeta } from '../src/lib/tips-catalog.js';
import { tipsFor } from '../src/lib/top-tips.js';
import skillTechniques from '../src/data/skill-techniques.json';

const cat = techniqueCatalog();
const find = t => cat.techniques.find(x => x.technique === t);
const rows = cat.techniques.map(t => t.technique);
// Every technique that has cues, derived from the data rather than the catalog.
const withCues = new Set(
  Object.entries(skillTechniques)
    .filter(([skillId]) => tipsFor(skillId).length > 0)
    .map(([, technique]) => technique),
);

describe('techniqueCatalog (one row per technique, no level)', () => {
  test('lists each technique once, not once per level that examines it', () => {
    // stopping is examined at L1, L2 and L3 — three skills, one row.
    expect(find('stopping').skills).toHaveLength(3);
    expect(rows.filter(t => t === 'stopping')).toHaveLength(1);
    // No technique repeats, and every technique that has cues is listed.
    expect(new Set(rows).size).toBe(rows.length);
    expect(new Set(rows)).toEqual(withCues);
    expect(cat.techniqueCount).toBe(withCues.size);
  });

  test('carries the technique name and its one cue count', () => {
    expect(find('forward-stroke').name).toBe('Forward Stroke');
    expect(find('forward-stroke').tipCount).toBe(6);
  });

  test('orders foundation first, so no level headings are needed to read it', () => {
    // stopping and wet-exit start at L1, forward-stroke at L2.
    expect(rows.indexOf('stopping')).toBeLessThan(rows.indexOf('forward-stroke'));
    expect(rows.indexOf('wet-exit')).toBeLessThan(rows.indexOf('forward-stroke'));
    // Generally: the lowest level a technique is examined at decides its place,
    // so the levels never interleave down the list.
    const firstLevels = rows.map(t => find(t).skills[0].level);
    expect([...firstLevels].sort()).toEqual(firstLevels);
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
