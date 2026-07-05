import { skillById, optionFor } from './session.js';
import { landingFor } from './landing.js';

export function paddlerSummary(session, paddlerId) {
  const paddler = session.paddlers.find(p => p.id === paddlerId);
  const target = paddler ? paddler.target : null;
  const scale = (session.scales[target] || []);
  const counts = {};
  for (const o of scale) counts[o.value] = 0;
  const rows = session.results.filter(r => r.paddlerId === paddlerId);
  const { landing, pendingCount } = landingFor(session, paddlerId);
  const item = (r, s) => ({ skillId: r.skillId, name: s.name, category: s.category, rating: r.rating, ratingLabel: (scale.find(o => o.value === r.rating) || {}).label || '', feedback: r.feedback });
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
  return { name: paddler ? paddler.name : '', target, landing, pendingCount, coreTotal, counts, unrated, flagged, optionalItems };
}
