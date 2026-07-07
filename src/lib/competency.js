// Scoring + grouping for the Review-screen competency radars. Assessment is
// progressive: a paddler is assessed at level T because they already met T-1,
// so a skill rated "below" at T sits at T-1, not zero. Each skill maps to a
// "standard level attained" (see the design spec's table).

export function targetLevelNum(target) {
  return { L1: 1, L2: 2, L3: 3, L4: 4, L5: 5 }[target] || 0;
}

export function skillLevelValue(target, rating) {
  if (rating == null || rating === 'dno') return null;
  const T = targetLevelNum(target);
  if (target === 'L1') {
    return rating === 'pass' ? 1 : rating === 'no' ? 0 : null;
  }
  if (target === 'L2') {
    const m = { below: 0, l1: 1, meets: 2, exceeds: 2.5 };
    return rating in m ? m[rating] : null;
  }
  const m = { below: T - 1, meets: T, exceeds: T + 0.5 };
  return rating in m ? m[rating] : null;
}

// The paddler's non-optional target-level skills, grouped by category in
// first-seen order, each category an ordered list of per-skill level values
// (null for an unrated or DNO skill). Consumers pick radar vs gauge by length.
export function competencyRadars(session, paddlerId) {
  const paddler = (session.paddlers || []).find(p => p.id === paddlerId);
  if (!paddler) return [];
  const target = paddler.target;
  const ratingBySkill = new Map(
    (session.results || [])
      .filter(r => r.paddlerId === paddlerId)
      .map(r => [r.skillId, r.rating]));
  const groups = new Map();
  for (const s of session.skills || []) {
    if (s.optional || s.level !== target) continue;
    const rating = ratingBySkill.has(s.id) ? ratingBySkill.get(s.id) : null;
    if (!groups.has(s.category)) groups.set(s.category, []);
    groups.get(s.category).push(skillLevelValue(target, rating));
  }
  return [...groups.entries()].map(([category, levels]) => ({ category, levels }));
}
