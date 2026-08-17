import { skillById, optionFor } from './session.js';
import { skillLabel } from './skills.js';
import { landingFor } from './landing.js';
import { startHere, nextStep, progressionRank } from './progression.js';

export function paddlerSummary(session, paddlerId) {
  const paddler = session.paddlers.find(p => p.id === paddlerId);
  const target = paddler ? paddler.target : null;
  const scale = (session.scales[target] || []);
  const counts = {};
  for (const o of scale) counts[o.value] = 0;
  const rows = session.results.filter(r => r.paddlerId === paddlerId);
  const { landing, pendingCount, belowCount = 0 } = landingFor(session, paddlerId);
  const item = (r, s) => ({ skillId: r.skillId, name: skillLabel(s), category: s.category, standard: s.standard, rating: r.rating, ratingLabel: (scale.find(o => o.value === r.rating) || {}).label || '', feedback: r.feedback });
  let coreTotal = 0, unrated = 0, metCount = 0;
  const flagged = [], optionalItems = [], strengths = [];
  for (const r of rows) {
    const s = skillById(session, r.skillId);
    if (!s) continue;
    if (s.optional) { if (r.rating !== null) optionalItems.push(item(r, s)); continue; }
    coreTotal++;
    if (r.rating === null) { unrated++; continue; }
    if (r.rating in counts) counts[r.rating]++;
    // Strengths and met-count feed the formative "how you're doing" line.
    if (r.rating === 'exceeds') strengths.push(skillLabel(s));
    if (r.rating === 'pass' || r.rating === 'meets' || r.rating === 'exceeds') metCount++;
    const opt = optionFor(session, s, r.rating);
    if (opt && opt.requiresFeedback) flagged.push(item(r, s));
  }
  // Order the gaps foundation-first, so the paddler reads them in the sequence
  // to work them (and the priority next step sits at the top).
  flagged.sort((a, b) => progressionRank(a.skillId) - progressionRank(b.skillId));
  // Formative overlay: point each below-standard skill at the deepest
  // prerequisite the paddler has not met yet — where to start. Data-driven, so
  // it fires only where the progression defines a real prerequisite (L2 today;
  // other levels light up as their prerequisites are refined). Omitted when it
  // would point at the skill itself (no unmet prerequisite).
  for (const f of flagged) {
    const sh = startHere(session, paddlerId, f.skillId);
    if (sh !== f.skillId) {
      const shSkill = skillById(session, sh);
      f.startHere = { skillId: sh, name: shSkill ? skillLabel(shSkill) : sh };
    }
  }
  // The single foundation-first next step across all of the paddler's gaps —
  // the one place to start. Null when nothing is below standard.
  const nextId = nextStep(session, paddlerId);
  const nextSkill = nextId ? skillById(session, nextId) : null;
  const priorityNext = nextId ? { skillId: nextId, name: nextSkill ? skillLabel(nextSkill) : nextId } : null;

  // The landing value that means the paddler met their target level.
  const PASSING = { L1: 'L1', L2: 'L2', L3: 'meets_level', L4: 'meets_level', L5: 'meets_level' };
  const passing = landing === PASSING[target];
  return { name: paddler ? paddler.name : '', target, landing, passing, pendingCount, belowCount, coreTotal, counts, unrated, metCount, strengths, priorityNext, flagged, optionalItems };
}
