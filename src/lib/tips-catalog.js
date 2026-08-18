// A browsable index of the TECHNIQUES that have Top Tips, ordered foundation
// first. Powers the standalone "Skills & Tips" screen, separate from any
// assessment.
//
// One row per technique, and no level anywhere. A technique is universal across
// levels and its cues are authored once (see top-tips.js), so listing skills
// would repeat the same cue set under every level that examines it — three
// "Stopping" rows whose counters all move together, because mastery is keyed by
// technique. Level says where a technique is assessed; that belongs on the
// assessment screens, which already know the level, not on a practice index.

import skills from '../data/skills.json';
import skillsL3 from '../data/skills-l3.json';
import skillsL4 from '../data/skills-l4.json';
import skillsL5 from '../data/skills-l5.json';
import skillTechniques from '../data/skill-techniques.json';
import { skillLabel } from './skills.js';
import { strandOf, progressionRank } from './progression.js';
import { tipsFor, techniqueName } from './top-tips.js';

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

// Every technique that has at least one cue and at least one skill mapped to it.
// `skills` stays ordered lowest level first, so callers that need one example
// skill (a plain-language gloss, say) get the plainest one.
export function techniqueCatalog() {
  const byTechnique = new Map();
  for (const [skillId, technique] of Object.entries(skillTechniques)) {
    const s = BY_ID[skillId];
    if (!s) continue;
    const n = tipsFor(skillId).length;
    if (n === 0) continue;
    if (!byTechnique.has(technique)) {
      byTechnique.set(technique, { technique, name: techniqueName(technique), tipCount: n, skills: [] });
    }
    byTechnique.get(technique).skills.push(skillMeta(skillId));
  }
  const techniques = [...byTechnique.values()].map(t => ({
    ...t,
    skills: t.skills.sort((a, b) => {
      const la = LEVEL_ORDER.indexOf(a.level);
      const lb = LEVEL_ORDER.indexOf(b.level);
      return la !== lb ? la - lb : progressionRank(a.skillId) - progressionRank(b.skillId);
    }),
  }));
  // Foundation first: the earliest place a technique is examined decides its
  // position. The order is pedagogical, so the screen needs no level headings
  // to read in a sensible sequence.
  techniques.sort((a, b) => Math.min(...a.skills.map(s => progressionRank(s.skillId)))
    - Math.min(...b.skills.map(s => progressionRank(s.skillId))));
  return {
    techniques,
    techniqueCount: techniques.length,
    tipCount: techniques.reduce((sum, t) => sum + t.tipCount, 0),
  };
}

// Detail metadata for one technique, or null if it has no cues.
export function techniqueMeta(technique) {
  return techniqueCatalog().techniques.find(t => t.technique === technique) || null;
}
