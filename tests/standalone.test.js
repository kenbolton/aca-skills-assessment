import { expect, test } from 'vitest';
import { loadConfig, allSkills, optionsForSkill, skillLabel } from '../src/lib/skills.js';
import { createSession } from '../src/lib/session.js';
import { landingFor, isStandaloneLevel } from '../src/lib/landing.js';
import { paddlerSummary } from '../src/lib/summary.js';
import { sessionSummary } from '../src/lib/session-summary.js';
import { resultNeedsFeedback } from '../src/lib/validation.js';
import rawL3 from '../src/data/skills-l3.json';
import rawL4 from '../src/data/skills-l4.json';
import rawL5 from '../src/data/skills-l5.json';

const L3 = loadConfig(rawL3);
const L4 = loadConfig(rawL4);
const L5 = loadConfig(rawL5);

test('each standalone data file loads with a single level and Below/Meets/Exceeds scale', () => {
  for (const [lvl, cfg] of [['L3', L3], ['L4', L4], ['L5', L5]]) {
    expect(Object.keys(cfg.scales)).toEqual([lvl]);
    expect(cfg.scales[lvl].map(o => o.value)).toEqual(['below', 'meets', 'exceeds']);
    expect(cfg.scales[lvl].find(o => o.value === 'below').requiresFeedback).toBe(true);
    expect(allSkills(cfg).every(s => s.level === lvl)).toBe(true);
    expect(allSkills(cfg).length).toBeGreaterThan(50);
  }
});

test('loadConfig preserves the per-category competency', () => {
  expect(allSkills(L3).every(s => typeof s.competency === 'string' && s.competency.length > 0)).toBe(true);
});

test('L3 keeps short names; L4/L5 skills carry only the standard as the item', () => {
  expect(allSkills(L3).some(s => s.name)).toBe(true);
  expect(allSkills(L4).every(s => !s.name)).toBe(true);
  expect(allSkills(L5).every(s => !s.name)).toBe(true);
  // skillLabel falls back to the standard when there is no short name
  const l4 = allSkills(L4)[0];
  expect(skillLabel(l4)).toBe(l4.standard);
});

test('optionsForSkill returns the full 3-point scale for a standalone level', () => {
  const s = allSkills(L4)[0];
  expect(optionsForSkill(L4, s).map(o => o.value)).toEqual(['below', 'meets', 'exceeds']);
});

test('isStandaloneLevel flags L3/L4/L5 and not L1/L2', () => {
  expect(['L3', 'L4', 'L5'].every(isStandaloneLevel)).toBe(true);
  expect(['L1', 'L2'].some(isStandaloneLevel)).toBe(false);
});

test('createSession assigns the shared level and rates every skill of that level', () => {
  const s = createSession({ id: 's', createdAt: 't', config: L3, paddlers: [{ name: 'Ada', target: 'L3' }] });
  const pid = s.paddlers[0].id;
  expect(s.paddlers[0].target).toBe('L3');
  expect(s.results.filter(r => r.paddlerId === pid).length).toBe(allSkills(L3).length);
});

function ratedSession(cfg, level, ratingFor) {
  const s = createSession({ id: 's', createdAt: 't', config: cfg, paddlers: [{ name: 'Ada', target: level }] });
  const pid = s.paddlers[0].id;
  return {
    ...s,
    results: s.results.map(r => {
      const sk = cfg.skills.find(x => x.id === r.skillId);
      return { ...r, rating: ratingFor(sk), feedback: 'note' };
    }),
    _pid: pid,
  };
}

test('landingFor: all core meets/exceeds -> meets_level', () => {
  const s = ratedSession(L3, 'L3', sk => (sk.optional ? null : 'meets'));
  expect(landingFor(s, s._pid).landing).toBe('meets_level');
});

test('landingFor: a below among core -> below_level with a count', () => {
  let first = true;
  const s = ratedSession(L3, 'L3', sk => {
    if (sk.optional) return null;
    if (first) { first = false; return 'below'; }
    return 'meets';
  });
  const r = landingFor(s, s._pid);
  expect(r.landing).toBe('below_level');
  expect(r.belowCount).toBe(1);
});

test('landingFor: an unrated core -> pending', () => {
  const s = ratedSession(L3, 'L3', () => null);
  expect(landingFor(s, s._pid).landing).toBe('pending');
});

test('paddlerSummary surfaces belowCount for a standalone session', () => {
  let first = true;
  const s = ratedSession(L4, 'L4', sk => {
    if (sk.optional) return null;
    if (first) { first = false; return 'below'; }
    return 'exceeds';
  });
  expect(paddlerSummary(s, s._pid).belowCount).toBe(1);
});

test('resultNeedsFeedback: a below with no note requires feedback in instructor mode', () => {
  const s = createSession({ id: 's', createdAt: 't', config: L3, paddlers: [{ name: 'Ada', target: 'L3' }] });
  const core = s.skills.find(x => !x.optional);
  const result = { skillId: core.id, rating: 'below', feedback: '' };
  expect(resultNeedsFeedback(s, result)).toBe(true);
  expect(resultNeedsFeedback({ ...s, selfAssessment: true }, result)).toBe(false);
});

test('sessionSummary labels a standalone session with its level', () => {
  const s = createSession({ id: 's', createdAt: 't', config: L5, paddlers: [{ name: 'Ada', target: 'L5' }, { name: 'Bo', target: 'L5' }] });
  expect(sessionSummary(s).level).toBe('L5');
});
