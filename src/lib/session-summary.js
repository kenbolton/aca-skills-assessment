import { landingFor } from './landing.js';

function coreCounts(session) {
  const core = (session.skills || []).filter(s => !s.optional);
  const coreIds = new Set(core.map(s => s.id));
  const rated = (session.results || []).filter(r => coreIds.has(r.skillId) && r.rating !== null).length;
  return { core: core.length, rated };   // rough progress hint: # core skills, # non-null core results
}

export function sessionSummary(session) {
  const paddlers = session.paddlers || [];
  const isV3 = paddlers.length > 0 && 'target' in paddlers[0];
  const base = {
    id: session.id, createdAt: session.createdAt,
    participants: paddlers.map(p => p.name),
    counts: coreCounts(session),
  };
  if (isV3) {
    return { ...base, targets: paddlers.map(p => p.target), landings: paddlers.map(p => landingFor(session, p.id).landing), level: '' };
  }
  return { ...base, targets: [], landings: [], level: session.levelName || '' };
}
