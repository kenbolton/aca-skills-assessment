import { skillById } from './session.js';

export function landingFor(session, paddlerId) {
  const paddler = session.paddlers.find(p => p.id === paddlerId);
  const target = paddler ? paddler.target : null;
  const rows = session.results.filter(r => {
    if (r.paddlerId !== paddlerId) return false;
    const s = skillById(session, r.skillId);
    return s && !s.optional;
  });
  const pendingCount = rows.filter(r => r.rating === null || (target === 'L1' && r.rating === 'dno')).length;
  if (pendingCount > 0) return { landing: 'pending', pendingCount };

  if (target === 'L1') {
    return { landing: rows.every(r => r.rating === 'pass') ? 'L1' : 'did_not_meet_L1', pendingCount: 0 };
  }
  // L2
  if (rows.every(r => r.rating === 'meets' || r.rating === 'exceeds')) return { landing: 'L2', pendingCount: 0 };
  const dualBelow = rows.some(r => { const s = skillById(session, r.skillId); return s && s.l1Standard && r.rating === 'below'; });
  return { landing: dualBelow ? 'did_not_meet_L1' : 'L1', pendingCount: 0 };
}
