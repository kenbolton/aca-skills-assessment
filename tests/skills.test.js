import { expect, test } from 'vitest';
import { loadConfig, levelIds, getLevel, scaleForLevel, skillsForLevel } from '../src/lib/skills.js';
import realSkillsData from '../src/data/skills.json';

function goodRaw() {
  return {
    levels: [
      {
        id: 'L1',
        name: 'Level 1',
        scale: [
          { value: 'no', label: 'No', requiresFeedback: true },
          { value: 'pass', label: 'Pass' },
        ],
        categories: [
          {
            name: 'Prep',
            competency: 'Preparation competency',
            skills: [
              { id: 'l1-a', name: 'Skill A', standard: 'Do A' },
              { id: 'l1-b', name: 'Skill B', standard: 'Do B', optional: true },
            ],
          },
          {
            name: 'Rescue',
            skills: [
              { id: 'l1-c', name: 'Skill C', standard: 'Do C' },
            ],
          },
        ],
      },
      {
        id: 'L2',
        name: 'Level 2',
        note: 'L2 note',
        scale: [
          { value: 'below', label: 'Below', requiresFeedback: true },
          { value: 'meets', label: 'Meets' },
        ],
        categories: [
          {
            name: 'Strokes',
            skills: [
              { id: 'l2-a', name: 'Skill A2', standard: 'Do A2' },
            ],
          },
        ],
      },
    ],
  };
}

test('loadConfig accepts valid data and normalizes booleans/blank fields', () => {
  const config = loadConfig(goodRaw());
  expect(config.levels).toHaveLength(2);
  const l1 = config.levels[0];
  expect(l1.note).toBe('');
  expect(l1.categories[0].competency).toBe('Preparation competency');
  expect(l1.categories[1].competency).toBe('');
  expect(l1.scale[0].requiresFeedback).toBe(true);
  expect(l1.scale[1].requiresFeedback).toBe(false);
  expect(l1.categories[0].skills[0].optional).toBe(false);
  expect(l1.categories[0].skills[1].optional).toBe(true);
});

test('loadConfig rejects missing/empty levels array', () => {
  expect(() => loadConfig({})).toThrow(/levels/i);
  expect(() => loadConfig({ levels: [] })).toThrow(/levels/i);
  expect(() => loadConfig({ levels: 'nope' })).toThrow(/levels/i);
});

test('loadConfig rejects a level missing id or name', () => {
  const raw = goodRaw();
  delete raw.levels[0].id;
  expect(() => loadConfig(raw)).toThrow(/id/i);

  const raw2 = goodRaw();
  delete raw2.levels[0].name;
  expect(() => loadConfig(raw2)).toThrow(/name/i);
});

test('loadConfig rejects a missing/empty scale or an option missing value/label', () => {
  const raw = goodRaw();
  raw.levels[0].scale = [];
  expect(() => loadConfig(raw)).toThrow(/scale/i);

  const raw2 = goodRaw();
  delete raw2.levels[0].scale;
  expect(() => loadConfig(raw2)).toThrow(/scale/i);

  const raw3 = goodRaw();
  delete raw3.levels[0].scale[0].value;
  expect(() => loadConfig(raw3)).toThrow(/value/i);

  const raw4 = goodRaw();
  delete raw4.levels[0].scale[0].label;
  expect(() => loadConfig(raw4)).toThrow(/label/i);
});

test('loadConfig rejects categories that are not an array', () => {
  const raw = goodRaw();
  raw.levels[0].categories = 'nope';
  expect(() => loadConfig(raw)).toThrow(/categories/i);
});

test('loadConfig rejects a skill missing id, name, or standard', () => {
  const raw = goodRaw();
  delete raw.levels[0].categories[0].skills[0].id;
  expect(() => loadConfig(raw)).toThrow(/id/i);

  const raw2 = goodRaw();
  delete raw2.levels[0].categories[0].skills[0].name;
  expect(() => loadConfig(raw2)).toThrow(/name/i);

  const raw3 = goodRaw();
  delete raw3.levels[0].categories[0].skills[0].standard;
  expect(() => loadConfig(raw3)).toThrow(/standard/i);
});

test('loadConfig rejects a skill id duplicated across the whole config (even across levels)', () => {
  const raw = goodRaw();
  raw.levels[1].categories[0].skills[0].id = 'l1-a'; // duplicate of L1's skill
  expect(() => loadConfig(raw)).toThrow(/duplicate/i);
});

test('levelIds returns level ids in order', () => {
  const config = loadConfig(goodRaw());
  expect(levelIds(config)).toEqual(['L1', 'L2']);
});

test('getLevel finds a level by id, undefined when missing', () => {
  const config = loadConfig(goodRaw());
  expect(getLevel(config, 'L2').name).toBe('Level 2');
  expect(getLevel(config, 'L9')).toBeUndefined();
});

test('scaleForLevel returns the level scale, [] when level not found', () => {
  const config = loadConfig(goodRaw());
  expect(scaleForLevel(config, 'L1').map(o => o.value)).toEqual(['no', 'pass']);
  expect(scaleForLevel(config, 'L9')).toEqual([]);
});

test('skillsForLevel flattens categories in order, carrying category name and competency', () => {
  const config = loadConfig(goodRaw());
  const skills = skillsForLevel(config, 'L1');
  expect(skills.map(s => s.id)).toEqual(['l1-a', 'l1-b', 'l1-c']);
  expect(skills[0].category).toBe('Prep');
  expect(skills[0].competency).toBe('Preparation competency');
  expect(skills[2].category).toBe('Rescue');
  expect(skills[2].competency).toBe('');
  expect(skills[1].optional).toBe(true);
});

test('skillsForLevel returns [] for unknown level', () => {
  const config = loadConfig(goodRaw());
  expect(skillsForLevel(config, 'L9')).toEqual([]);
});

test('loadConfig accepts the real skills.json and skillsForLevel returns non-empty lists for L1/L2', () => {
  const config = loadConfig(realSkillsData);
  expect(skillsForLevel(config, 'L1').length).toBeGreaterThan(0);
  expect(skillsForLevel(config, 'L2').length).toBeGreaterThan(0);
});
