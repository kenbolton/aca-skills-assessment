import { expect, test, describe } from 'vitest';
import { validateTopTips } from '../src/lib/top-tips.js';
import topTips from '../src/data/top-tips.json';
import skills from '../src/data/skills.json';
import skillsL3 from '../src/data/skills-l3.json';
import skillsL4 from '../src/data/skills-l4.json';
import skillsL5 from '../src/data/skills-l5.json';

// Every skill id across all levels — the valid keys for top-tips.json.
const SKILL_IDS = new Set(
  [skills, skillsL3, skillsL4, skillsL5].flatMap(f => f.skills).map(s => s.id),
);

describe('the committed top-tips.json (crowdsourcing guard)', () => {
  test('is valid: real skill ids, unique tip ids, non-empty text', () => {
    expect(validateTopTips(topTips, SKILL_IDS)).toEqual([]);
  });
});

describe('validateTopTips catches contributor mistakes', () => {
  test('flags an unknown skill id', () => {
    const errs = validateTopTips({ 'l2-not-a-skill': [{ id: 'a', text: 'x' }] }, SKILL_IDS);
    expect(errs.some(e => /unknown skill id/.test(e))).toBe(true);
  });
  test('flags a duplicate tip id within a skill', () => {
    const errs = validateTopTips({ 'l2-forward': [{ id: 'f1', text: 'a' }, { id: 'f1', text: 'b' }] }, SKILL_IDS);
    expect(errs.some(e => /duplicate tip id "f1"/.test(e))).toBe(true);
  });
  test('flags a missing tip id', () => {
    const errs = validateTopTips({ 'l2-forward': [{ text: 'no id here' }] }, SKILL_IDS);
    expect(errs.some(e => /needs a non-empty "id"/.test(e))).toBe(true);
  });
  test('flags empty text', () => {
    const errs = validateTopTips({ 'l2-forward': [{ id: 'f1', text: '   ' }] }, SKILL_IDS);
    expect(errs.some(e => /needs non-empty "text"/.test(e))).toBe(true);
  });
  test('flags a non-array value', () => {
    const errs = validateTopTips({ 'l2-forward': 'nope' }, SKILL_IDS);
    expect(errs.some(e => /non-empty array/.test(e))).toBe(true);
  });
});
