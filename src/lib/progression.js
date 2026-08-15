// Read-only overlay on the L2 skill list: a learning progression of strands and
// prerequisites. It locates a paddler's edge (the zone of proximal development)
// so a below-standard rating can point to a next step instead of a mark.
//
// Every function takes the progression as a last argument, defaulting to the
// committed L2 data. Passing a synthetic progression keeps callers (and tests)
// stable while the real prerequisite graph is refined by hand.

import progressionData from '../data/progression.json';

export const progression = progressionData;

// A skill counts as "met" at L2 when rated meets or exceeds. Below, l1, dno, and
// unrated all count as not met.
const MET_RATINGS = new Set(['meets', 'exceeds']);
// A rating is "below standard" when it is an explicit sub-standard mark. These
// are the L2 ratings that require feedback and drive the Review touchpoint.
const BELOW_RATINGS = new Set(['below', 'l1']);

function metSkillIds(session, paddlerId) {
  const met = new Set();
  for (const r of session.results || []) {
    if (r.paddlerId === paddlerId && MET_RATINGS.has(r.rating)) met.add(r.skillId);
  }
  return met;
}

export function strandOf(skillId, prog = progression) {
  const entry = prog.skills[skillId];
  if (!entry) return null;
  const strand = prog.strands[entry.strand];
  if (!strand) return null;
  return { key: entry.strand, name: strand.name, order: strand.order };
}

export function prereqsOf(skillId, prog = progression) {
  const entry = prog.skills[skillId];
  return entry ? entry.prereqs.slice() : [];
}

// Sort skill ids foundation-first: earlier strand, then lower stage. Unknown
// skills sort last, in id order, so the result stays deterministic.
function orderCmp(prog) {
  return (a, b) => {
    const ea = prog.skills[a];
    const eb = prog.skills[b];
    if (!ea && !eb) return a < b ? -1 : a > b ? 1 : 0;
    if (!ea) return 1;
    if (!eb) return -1;
    const oa = prog.strands[ea.strand]?.order ?? Infinity;
    const ob = prog.strands[eb.strand]?.order ?? Infinity;
    if (oa !== ob) return oa - ob;
    if (ea.stage !== eb.stage) return ea.stage - eb.stage;
    return a < b ? -1 : a > b ? 1 : 0;
  };
}

// The deepest unmet prerequisite reachable from skillId. If every prerequisite
// is met, or the skill is unknown, it returns skillId itself. The `seen` set
// guards against a cycle in a hand-edited graph.
function deepestUnmet(skillId, met, prog, seen) {
  const entry = prog.skills[skillId];
  if (!entry || seen.has(skillId)) return skillId;
  seen.add(skillId);
  const unmet = entry.prereqs.filter(p => !met.has(p));
  if (unmet.length === 0) return skillId;
  const candidates = unmet.map(p => deepestUnmet(p, met, prog, seen));
  candidates.sort(orderCmp(prog));
  return candidates[0];
}

export function startHere(session, paddlerId, skillId, prog = progression) {
  const met = metSkillIds(session, paddlerId);
  return deepestUnmet(skillId, met, prog, new Set());
}

export function nextStep(session, paddlerId, prog = progression) {
  const met = metSkillIds(session, paddlerId);
  const below = (session.results || [])
    .filter(r => r.paddlerId === paddlerId && BELOW_RATINGS.has(r.rating) && prog.skills[r.skillId])
    .map(r => deepestUnmet(r.skillId, met, prog, new Set()));
  if (below.length === 0) return null;
  below.sort(orderCmp(prog));
  return below[0];
}

export function edgeSkills(session, paddlerId, prog = progression) {
  const met = metSkillIds(session, paddlerId);
  const frontier = Object.keys(prog.skills)
    .filter(id => !met.has(id) && prog.skills[id].prereqs.every(p => met.has(p)));
  frontier.sort(orderCmp(prog));
  return frontier.slice(0, 3);
}
