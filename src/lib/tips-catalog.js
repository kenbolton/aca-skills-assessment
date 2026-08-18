// A browsable index of the skills that have Top Tips, grouped by level then
// strand (from the progression) and ordered foundation-first. Powers the
// standalone "Skills & Tips" screen, separate from any assessment.

import skills from '../data/skills.json';
import skillsL3 from '../data/skills-l3.json';
import skillsL4 from '../data/skills-l4.json';
import skillsL5 from '../data/skills-l5.json';
import skillTechniques from '../data/skill-techniques.json';
import { skillLabel } from './skills.js';
import { strandOf, progressionRank } from './progression.js';
import { tipsFor } from './top-tips.js';

const BY_ID = Object.fromEntries(
  [skills, skillsL3, skillsL4, skillsL5].flatMap(f => f.skills).map(s => [s.id, s]),
);
const LEVEL_ORDER = ['L1', 'L2', 'L3', 'L4', 'L5'];

// Resolve a skill id to display metadata, or null if unknown.
export function skillMeta(skillId) {
  const s = BY_ID[skillId];
  if (!s) return null;
  return { skillId, name: skillLabel(s), level: s.level, category: s.category, standard: s.standard, strand: strandOf(skillId) };
}

export function tipsCatalog() {
  const levels = new Map(); // level -> Map(strandKey -> group)
  let tipCount = 0;
  let skillCount = 0;
  // A skill "has tips" when its technique does; the same technique's cues show
  // under every level's skill that maps to it (universality made visible).
  for (const id of Object.keys(skillTechniques)) {
    const s = BY_ID[id];
    if (!s) continue;
    const n = tipsFor(id).length;
    if (n === 0) continue;
    skillCount++;
    tipCount += n;
    const strand = strandOf(id);
    const key = strand ? strand.key : (s.category || 'other');
    const name = strand ? strand.name : (s.category || 'Other');
    const order = strand ? strand.order : 9999;
    if (!levels.has(s.level)) levels.set(s.level, new Map());
    const strands = levels.get(s.level);
    if (!strands.has(key)) strands.set(key, { key, name, order, skills: [] });
    strands.get(key).skills.push({ skillId: id, name: skillLabel(s), tipCount: n });
  }
  const levelGroups = LEVEL_ORDER.filter(l => levels.has(l)).map(level => ({
    level,
    strands: [...levels.get(level).values()]
      .sort((a, b) => a.order - b.order)
      .map(({ order, ...str }) => ({
        ...str,
        skills: str.skills.sort((a, b) => progressionRank(a.skillId) - progressionRank(b.skillId)),
      })),
  }));
  return { levels: levelGroups, skillCount, tipCount };
}
