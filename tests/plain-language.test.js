import { expect, test, describe } from 'vitest';
import skillsRaw from '../src/data/skills.json';
import glosses from '../src/data/plain-language.json';
import { plainFor } from '../src/lib/plain-language.js';

const byId = Object.fromEntries(skillsRaw.skills.map(s => [s.id, s]));

describe('plainFor', () => {
  test('returns the gloss for a skill that has one', () => {
    expect(plainFor('l2-stopping')).toBe(glosses['l2-stopping']);
    expect(typeof plainFor('l2-stopping')).toBe('string');
  });
  test('returns null for a skill with no gloss', () => {
    expect(plainFor('l2-float-plan')).toBe(null);
    expect(plainFor('nonexistent')).toBe(null);
  });
});

describe('plain-language.json integrity', () => {
  test('every gloss key is a real skill id', () => {
    const unknown = Object.keys(glosses).filter(id => !byId[id]);
    expect(unknown).toEqual([]);
  });
  test('every gloss is a non-empty string', () => {
    for (const [id, g] of Object.entries(glosses)) {
      expect(typeof g, id).toBe('string');
      expect(g.trim().length, id).toBeGreaterThan(0);
    }
  });
  test('covers exactly the six lesson-linked L2 skills', () => {
    expect(Object.keys(glosses).sort()).toEqual([
      'l2-assisted-rescue', 'l2-forward', 'l2-reverse', 'l2-stopping', 'l2-sweep', 'l2-wet-exit',
    ]);
  });
});

describe('fidelity: a gloss must not reproduce the ACA standard', () => {
  test('no gloss equals its skill standard text', () => {
    for (const [id, g] of Object.entries(glosses)) {
      const std = byId[id].standard;
      expect(g.trim(), id).not.toBe(std.trim());
    }
  });
});
