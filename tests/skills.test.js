import { expect, test } from 'vitest';
import { loadConfig, allSkills, optionsForSkill } from '../src/lib/skills.js';
import raw from '../src/data/skills.json';

const cfg = loadConfig(raw);

test('loadConfig accepts the real v3 data', () => {
  expect(cfg.scales.L1.length).toBeGreaterThan(0);
  expect(cfg.scales.L2.some(o => o.value === 'l1' && o.dualOnly)).toBe(true);
  expect(allSkills(cfg).length).toBeGreaterThan(50);
});

test('loadConfig rejects a skill with a bad level', () => {
  expect(() => loadConfig({ scales: raw.scales, skills: [{ id: 'x', level: 'L3', category: 'c', name: 'n', standard: 's' }] }))
    .toThrow(/level/i);
});

test('optionsForSkill: L1 skill -> L1 scale', () => {
  const s = allSkills(cfg).find(s => s.level === 'L1');
  expect(optionsForSkill(cfg, s).map(o => o.value)).toEqual(['no', 'pass', 'dno']);
});

test('optionsForSkill: dual L2 skill -> Below/L1/Meets/Exceeds', () => {
  const s = allSkills(cfg).find(s => s.level === 'L2' && s.l1Standard);
  expect(optionsForSkill(cfg, s).map(o => o.value)).toEqual(['below', 'l1', 'meets', 'exceeds', 'dno']);
});

test('optionsForSkill: L2-only skill drops the dualOnly l1 tier', () => {
  const s = allSkills(cfg).find(s => s.level === 'L2' && !s.l1Standard);
  expect(optionsForSkill(cfg, s).map(o => o.value)).toEqual(['below', 'meets', 'exceeds', 'dno']);
});

test('loadConfig passes belowStandard through (assessor-guide prose)', () => {
  const forward = allSkills(cfg).find(s => s.id === 'l2-forward');
  expect(forward.belowStandard).toMatch(/wobbles or yaws significantly/);
  // Every L2 skill carrying Below prose also carries the Meets bar and Exceeds prose.
  const withBelow = allSkills(cfg).filter(s => s.belowStandard);
  expect(withBelow.length).toBeGreaterThanOrEqual(38);
  for (const s of withBelow) {
    expect(typeof s.standard).toBe('string');
    expect(s.standard.length).toBeGreaterThan(0);
  }
});

test('loadConfig passes a well-formed intro through', () => {
  expect(cfg.intro).toBeTruthy();
  expect(cfg.intro.title).toMatch(/Level 2/);
  expect(cfg.intro.sections.length).toBeGreaterThan(0);
  const venue = cfg.intro.sections.find(s => /venue/i.test(s.heading));
  expect(venue.items.some(it => /knot/i.test(it))).toBe(true);
});

test('loadConfig drops malformed intro sections and empties to no intro', () => {
  const mk = sections => loadConfig({ scales: raw.scales, skills: raw.skills, intro: { title: 'X', sections } });
  // A section with no heading, or with neither body nor items, is dropped.
  const partial = mk([
    { heading: '', body: 'no heading' },
    { heading: 'Empty' },
    { heading: 'Good', items: ['ok', 42, ''] },
  ]);
  expect(partial.intro.sections.map(s => s.heading)).toEqual(['Good']);
  expect(partial.intro.sections[0].items).toEqual(['ok']);
  // Nothing salvageable -> no intro key at all.
  expect('intro' in mk([{ heading: 'x' }])).toBe(false);
  expect('intro' in loadConfig({ scales: raw.scales, skills: raw.skills })).toBe(false);
});

test('loadConfig omits an empty or non-string belowStandard', () => {
  const base = { scales: raw.scales, skills: [
    { id: 'a', level: 'L2', category: 'c', name: 'n', standard: 's', belowStandard: '' },
    { id: 'b', level: 'L2', category: 'c', name: 'n', standard: 's', belowStandard: 42 },
  ] };
  const [a, b] = loadConfig(base).skills;
  expect('belowStandard' in a).toBe(false);
  expect('belowStandard' in b).toBe(false);
});
