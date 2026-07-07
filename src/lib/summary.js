import { skillById, optionFor } from './session.js';
import { skillLabel } from './skills.js';
import { landingFor } from './landing.js';

export function paddlerSummary(session, paddlerId) {
  const paddler = session.paddlers.find(p => p.id === paddlerId);
  const target = paddler ? paddler.target : null;
  const scale = (session.scales[target] || []);
  const counts = {};
  for (const o of scale) counts[o.value] = 0;
  const rows = session.results.filter(r => r.paddlerId === paddlerId);
  const { landing, pendingCount, belowCount = 0 } = landingFor(session, paddlerId);
  const item = (r, s) => ({ skillId: r.skillId, name: skillLabel(s), category: s.category, standard: s.standard, rating: r.rating, ratingLabel: (scale.find(o => o.value === r.rating) || {}).label || '', feedback: r.feedback });
  let coreTotal = 0, unrated = 0;
  const flagged = [], optionalItems = [];
  for (const r of rows) {
    const s = skillById(session, r.skillId);
    if (!s) continue;
    if (s.optional) { if (r.rating !== null) optionalItems.push(item(r, s)); continue; }
    coreTotal++;
    if (r.rating === null) { unrated++; continue; }
    if (r.rating in counts) counts[r.rating]++;
    const opt = optionFor(session, s, r.rating);
    if (opt && opt.requiresFeedback) flagged.push(item(r, s));
  }
  // The landing value that means the paddler met their target level.
  const PASSING = { L1: 'L1', L2: 'L2', L3: 'meets_level', L4: 'meets_level', L5: 'meets_level' };
  const passing = landing === PASSING[target];
  return { name: paddler ? paddler.name : '', target, landing, passing, pendingCount, belowCount, coreTotal, counts, unrated, flagged, optionalItems };
}
