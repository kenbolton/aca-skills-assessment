// Top Tips: a per-skill ordered list of short coaching cues, revealed
// progressively. A learner masters the top few, and the next cues surface. The
// mastered set persists per learner across sessions (see store.js tipChecks).
//
// Tips carry stable ids, not array positions, so persisted checks survive
// editing or reordering the list.

import tipsData from '../data/top-tips.json';

// The learner identity for tip progress: the paddler's name, normalized. Kept
// self-contained so this feature stands alone.
export function learnerKey(name) {
  return (name || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function tipsFor(skillId) {
  const t = tipsData[skillId];
  return Array.isArray(t) ? t : [];
}

// The mastered tip ids for a skill, from a learner's checks map.
export function masteredIds(checks, skillId) {
  return checks && Array.isArray(checks[skillId]) ? checks[skillId].slice() : [];
}

// Toggle a tip's mastered state, returning a new checks map (immutable).
export function toggleMastered(checks, skillId, tipId) {
  const current = (checks && checks[skillId]) || [];
  const next = current.includes(tipId)
    ? current.filter(id => id !== tipId)
    : [...current, tipId];
  return { ...(checks || {}), [skillId]: next };
}

// The progressive window: the next `n` unchecked tips, plus the mastered ones.
export function visibleTips(tips, mastered, n = 4) {
  const set = new Set(mastered || []);
  const unchecked = tips.filter(t => !set.has(t.id));
  return {
    visible: unchecked.slice(0, n),
    mastered: tips.filter(t => set.has(t.id)),
    total: tips.length,
    remaining: unchecked.length,
  };
}

// Validate a Top Tips data object against the known skill ids. Returns a list of
// human-readable problems (empty = valid). This guards crowdsourced tips: a bad
// skill id, a duplicate tip id (which would corrupt saved progress), a
// non-array, or empty text all fail loudly in CI / the deploy gate.
export function validateTopTips(data, validSkillIds) {
  const errors = [];
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    errors.push('top-tips.json must be an object keyed by skill id');
    return errors;
  }
  const known = validSkillIds instanceof Set ? validSkillIds : new Set(validSkillIds || []);
  for (const [skillId, tips] of Object.entries(data)) {
    if (!known.has(skillId)) errors.push(`unknown skill id: "${skillId}"`);
    if (!Array.isArray(tips) || tips.length === 0) {
      errors.push(`"${skillId}": tips must be a non-empty array`);
      continue;
    }
    const seen = new Set();
    tips.forEach((tip, i) => {
      if (!tip || typeof tip.id !== 'string' || !tip.id.trim()) {
        errors.push(`"${skillId}"[${i}]: each tip needs a non-empty "id"`);
      } else if (seen.has(tip.id)) {
        errors.push(`"${skillId}": duplicate tip id "${tip.id}"`);
      } else {
        seen.add(tip.id);
      }
      if (!tip || typeof tip.text !== 'string' || !tip.text.trim()) {
        errors.push(`"${skillId}"[${i}]: each tip needs non-empty "text"`);
      }
    });
  }
  return errors;
}
