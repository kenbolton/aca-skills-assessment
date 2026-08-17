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
