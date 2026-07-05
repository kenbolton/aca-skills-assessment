import { skillById, optionFor } from './session.js';
import { landingFor } from './landing.js';

function esc(field) {
  const s = String(field ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function sessionToCsv(session) {
  const paddlerById = new Map(session.paddlers.map(p => [p.id, p]));
  const landingById = new Map(session.paddlers.map(p => [p.id, landingFor(session, p.id).landing]));
  const rows = [['Paddler', 'Target', 'Landing', 'Category', 'Skill', 'Optional', 'Rating', 'Feedback']];
  for (const r of session.results) {
    const p = paddlerById.get(r.paddlerId) || { name: r.paddlerId, target: '' };
    const sk = skillById(session, r.skillId) || { category: '', name: r.skillId, optional: false };
    const opt = sk.category !== undefined ? optionFor(session, sk, r.rating) : null;
    rows.push([p.name, p.target, landingById.get(r.paddlerId) || '', sk.category, sk.name, sk.optional ? 'yes' : '', opt ? opt.label : '', r.feedback]);
  }
  return rows.map(cols => cols.map(esc).join(',')).join('\n');
}
