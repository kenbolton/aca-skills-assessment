import { landingFor, isStandaloneLevel } from './landing.js';

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
    selfAssessment: !!session.selfAssessment,
    counts: coreCounts(session),
  };
  if (isV3) {
    const targets = paddlers.map(p => p.target);
    // A standalone session shares one L3/L4/L5 level across all paddlers; surface it
    // so the archive list can label it (e.g. "L3") instead of the L1/L2 fallback.
    const uniq = [...new Set(targets)];
    const level = uniq.length === 1 && isStandaloneLevel(uniq[0]) ? uniq[0] : '';
    return { ...base, targets, landings: paddlers.map(p => landingFor(session, p.id).landing), level };
  }
  return { ...base, targets: [], landings: [], level: session.levelName || '' };
}
