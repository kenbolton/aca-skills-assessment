import { expect, test, describe } from 'vitest';
import { validateTopTips, validateSkillTechniques } from '../src/lib/top-tips.js';
import topTips from '../src/data/top-tips.json';
import techniques from '../src/data/techniques.json';
import skillTechniques from '../src/data/skill-techniques.json';
import skills from '../src/data/skills.json';
import skillsL3 from '../src/data/skills-l3.json';
import skillsL4 from '../src/data/skills-l4.json';
import skillsL5 from '../src/data/skills-l5.json';

const SKILL_IDS = new Set(
  [skills, skillsL3, skillsL4, skillsL5].flatMap(f => f.skills).map(s => s.id),
);
const TECHNIQUE_KEYS = new Set(Object.keys(techniques));

describe('committed data (crowdsourcing guard)', () => {
  test('top-tips.json is valid: real techniques, unique tip ids, non-empty text', () => {
    expect(validateTopTips(topTips, TECHNIQUE_KEYS)).toEqual([]);
  });
  test('skill-techniques.json maps real skills to real techniques', () => {
    expect(validateSkillTechniques(skillTechniques, SKILL_IDS, TECHNIQUE_KEYS)).toEqual([]);
  });
});

describe('validateTopTips catches contributor mistakes', () => {
  test('flags an unknown technique', () => {
    const errs = validateTopTips({ 'not-a-technique': [{ id: 'a', text: 'x' }] }, TECHNIQUE_KEYS);
    expect(errs.some(e => /unknown technique/.test(e))).toBe(true);
  });
  test('flags a duplicate tip id', () => {
    const errs = validateTopTips({ 'forward-stroke': [{ id: 'f1', text: 'a' }, { id: 'f1', text: 'b' }] }, TECHNIQUE_KEYS);
    expect(errs.some(e => /duplicate tip id "f1"/.test(e))).toBe(true);
  });
  test('flags empty text', () => {
    const errs = validateTopTips({ 'forward-stroke': [{ id: 'f1', text: '   ' }] }, TECHNIQUE_KEYS);
    expect(errs.some(e => /needs non-empty "text"/.test(e))).toBe(true);
  });
});

describe('validateSkillTechniques catches map mistakes', () => {
  test('flags an unknown skill id', () => {
    const errs = validateSkillTechniques({ 'nope': 'forward-stroke' }, SKILL_IDS, TECHNIQUE_KEYS);
    expect(errs.some(e => /unknown skill id/.test(e))).toBe(true);
  });
  test('flags a mapping to an unknown technique', () => {
    const errs = validateSkillTechniques({ 'l2-forward': 'ghost' }, SKILL_IDS, TECHNIQUE_KEYS);
    expect(errs.some(e => /unknown technique/.test(e))).toBe(true);
  });
});
