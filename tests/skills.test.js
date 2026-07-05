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
  expect(optionsForSkill(cfg, s).map(o => o.value)).toEqual(['below', 'l1', 'meets', 'exceeds']);
});

test('optionsForSkill: L2-only skill drops the dualOnly l1 tier', () => {
  const s = allSkills(cfg).find(s => s.level === 'L2' && !s.l1Standard);
  expect(optionsForSkill(cfg, s).map(o => o.value)).toEqual(['below', 'meets', 'exceeds']);
});
