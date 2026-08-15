import { expect, test, describe } from 'vitest';
import skillsRaw from '../src/data/skills.json';
import realProgression from '../src/data/progression.json';
import {
  strandOf,
  prereqsOf,
  startHere,
  nextStep,
  edgeSkills,
} from '../src/lib/progression.js';

// A small synthetic progression keeps the logic tests stable even after the
// real prerequisite graph is refined by hand. Two strands, a three-stage chain
// in strand A and a single stage in strand B.
const prog = {
  version: 1,
  strands: { a: { name: 'A', order: 1 }, b: { name: 'B', order: 2 } },
  skills: {
    a1: { strand: 'a', stage: 1, prereqs: [] },
    a2: { strand: 'a', stage: 2, prereqs: ['a1'] },
    a3: { strand: 'a', stage: 3, prereqs: ['a2'] },
    b1: { strand: 'b', stage: 1, prereqs: [] },
  },
};

// Build a one-paddler L2 session from a { skillId: rating } map.
function session(ratings) {
  return {
    id: 's', createdAt: 't',
    paddlers: [{ id: 'p', name: 'Alex', target: 'L2' }],
    skills: [],
    results: Object.entries(ratings).map(([skillId, rating]) => ({ paddlerId: 'p', skillId, rating, feedback: '' })),
  };
}

describe('strandOf / prereqsOf', () => {
  test('strandOf returns the strand with its key, name, order', () => {
    expect(strandOf('a2', prog)).toEqual({ key: 'a', name: 'A', order: 1 });
  });
  test('strandOf returns null for an unknown skill', () => {
    expect(strandOf('zzz', prog)).toBe(null);
  });
  test('prereqsOf returns the prerequisite ids, or [] when unknown', () => {
    expect(prereqsOf('a2', prog)).toEqual(['a1']);
    expect(prereqsOf('zzz', prog)).toEqual([]);
  });
});

describe('startHere (per-skill deepest unmet prerequisite)', () => {
  test('walks to the foundation when nothing is met', () => {
    expect(startHere(session({ a3: 'below' }), 'p', 'a3', prog)).toBe('a1');
  });
  test('stops at the first unmet stage above what is met', () => {
    expect(startHere(session({ a1: 'meets', a3: 'below' }), 'p', 'a3', prog)).toBe('a2');
  });
  test('returns the skill itself when every prerequisite is met', () => {
    expect(startHere(session({ a1: 'meets', a2: 'exceeds', a3: 'below' }), 'p', 'a3', prog)).toBe('a3');
  });
  test('degrades to the skill itself when it is absent from the map', () => {
    expect(startHere(session({ zzz: 'below' }), 'p', 'zzz', prog)).toBe('zzz');
  });
});

describe('nextStep (global foundation-first edge)', () => {
  test('picks the foundation-most start-here across several below skills', () => {
    // Below on a3 (→ a1) and b1 (→ b1). a1 sorts first (strand order 1).
    expect(nextStep(session({ a3: 'below', b1: 'below' }), 'p', prog)).toBe('a1');
  });
  test('returns null when no skill is below standard', () => {
    expect(nextStep(session({ a1: 'meets' }), 'p', prog)).toBe(null);
  });
});

describe('edgeSkills (frontier: prerequisites met, not yet met)', () => {
  test('lists the stage-1 skills of each strand when nothing is met', () => {
    expect(edgeSkills(session({}), 'p', prog)).toEqual(['a1', 'b1']);
  });
  test('advances the frontier as prerequisites are met', () => {
    expect(edgeSkills(session({ a1: 'meets' }), 'p', prog)).toEqual(['a2', 'b1']);
  });
});

describe('real progression.json integrity', () => {
  const l2core = skillsRaw.skills.filter(s => s.level === 'L2' && !s.optional);

  test('every L2 core skill has a progression entry', () => {
    const missing = l2core.map(s => s.id).filter(id => !realProgression.skills[id]);
    expect(missing).toEqual([]);
  });
  test('every referenced strand exists', () => {
    for (const [id, e] of Object.entries(realProgression.skills)) {
      expect(realProgression.strands[e.strand], `skill ${id} strand ${e.strand}`).toBeTruthy();
    }
  });
  test('every prerequisite id references a real skill', () => {
    for (const [id, e] of Object.entries(realProgression.skills)) {
      for (const p of e.prereqs) {
        expect(realProgression.skills[p], `skill ${id} prereq ${p}`).toBeTruthy();
      }
    }
  });
  test('prerequisites respect strand order and are acyclic', () => {
    const skills = realProgression.skills;
    const strands = realProgression.strands;
    // Order rule: a prerequisite sits in an earlier strand, or the same strand
    // at a lower stage. This ordering also forbids cycles.
    for (const [id, e] of Object.entries(skills)) {
      const here = strands[e.strand];
      for (const p of e.prereqs) {
        const pe = skills[p];
        const there = strands[pe.strand];
        const earlier = there.order < here.order || (there.order === here.order && pe.stage < e.stage);
        expect(earlier, `prereq ${p} must precede ${id}`).toBe(true);
      }
    }
  });
});
