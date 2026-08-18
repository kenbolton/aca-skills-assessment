import { expect, test, describe } from 'vitest';
import { tipsCatalog, skillMeta } from '../src/lib/tips-catalog.js';

describe('tipsCatalog (skills that have tips, grouped)', () => {
  const cat = tipsCatalog();

  test('groups by level then strand, in order', () => {
    // The seed tips are all L2, so exactly one level group.
    expect(cat.levels.map(l => l.level)).toEqual(['L2']);
    const strandNames = cat.levels[0].strands.map(s => s.name);
    // Strokes (strand order 2) before Rescues (order 7).
    expect(strandNames.indexOf('Core: Strokes')).toBeLessThan(strandNames.indexOf('Core: Rescues and Towing'));
  });

  test('each skill carries its name and tip count, foundation-first', () => {
    const strokes = cat.levels[0].strands.find(s => s.name === 'Core: Strokes');
    const ids = strokes.skills.map(s => s.skillId);
    expect(ids).toEqual(['l2-forward', 'l2-stopping']); // forward (stage1) before stopping (stage3)
    const forward = strokes.skills.find(s => s.skillId === 'l2-forward');
    expect(forward.name).toBe('Forward Paddling');
    expect(forward.tipCount).toBe(6);
  });

  test('reports totals', () => {
    expect(cat.skillCount).toBe(3);       // forward, stopping, wet-exit
    expect(cat.tipCount).toBe(16);        // 6 + 5 + 5
  });
});

describe('skillMeta', () => {
  test('resolves a skill id to name/level/strand', () => {
    const m = skillMeta('l2-wet-exit');
    expect(m.name).toBe('Capsize & Wet Exit');
    expect(m.level).toBe('L2');
  });
  test('returns null for an unknown id', () => {
    expect(skillMeta('nope')).toBe(null);
  });
});
