import { skillById } from './session.js';

// L3/L4/L5 are standalone: no cross-level landing, just a within-level verdict.
export const STANDALONE_LEVELS = ['L3', 'L4', 'L5'];
export function isStandaloneLevel(level) { return STANDALONE_LEVELS.includes(level); }

export function landingFor(session, paddlerId) {
  const paddler = session.paddlers.find(p => p.id === paddlerId);
  const target = paddler ? paddler.target : null;
  const rows = session.results.filter(r => {
    if (r.paddlerId !== paddlerId) return false;
    const s = skillById(session, r.skillId);
    return s && !s.optional;
  });
  // A required skill that is unrated, or explicitly "Did Not Observe", cannot
  // support a pass — the verdict stays pending until it is actually observed.
  const pendingCount = rows.filter(r => r.rating === null || r.rating === 'dno').length;
  if (pendingCount > 0) return { landing: 'pending', pendingCount };

  if (isStandaloneLevel(target)) {
    // Within-level verdict only: meets the level when every assessed skill is
    // meets/exceeds; otherwise it lists how many fell below the standard.
    const belowCount = rows.filter(r => r.rating === 'below').length;
    return { landing: belowCount === 0 ? 'meets_level' : 'below_level', pendingCount: 0, belowCount };
  }

  if (target === 'L1') {
    return { landing: rows.every(r => r.rating === 'pass') ? 'L1' : 'did_not_meet_L1', pendingCount: 0 };
  }
  // L2
  if (rows.every(r => r.rating === 'meets' || r.rating === 'exceeds')) return { landing: 'L2', pendingCount: 0 };
  const dualBelow = rows.some(r => { const s = skillById(session, r.skillId); return s && s.l1Standard && r.rating === 'below'; });
  return { landing: dualBelow ? 'did_not_meet_L1' : 'L1', pendingCount: 0 };
}
