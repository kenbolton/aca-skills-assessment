import { optionsForSkill } from './skills.js';

const KEY = 'aca-assessment:session';
let seq = 0;
function pid() { return `p${++seq}`; }

export function createSession({ id, createdAt, config, location = '', paddlers }) {
  const people = paddlers.map(p => ({ name: (p.name || '').trim(), target: p.target })).filter(p => p.name);
  const withIds = people.map(p => ({ id: pid(), name: p.name, target: p.target }));
  const results = [];
  for (const p of withIds) {
    for (const sk of config.skills) {
      if (sk.level === p.target) results.push({ paddlerId: p.id, skillId: sk.id, rating: null, feedback: '' });
    }
  }
  return { id, createdAt, location, scales: config.scales, paddlers: withIds, skills: config.skills, results };
}

export function getResult(session, paddlerId, skillId) {
  return session.results.find(r => r.paddlerId === paddlerId && r.skillId === skillId);
}
export function skillById(session, skillId) {
  return session.skills.find(s => s.id === skillId);
}
export function optionsForSkillInSession(session, skill) {
  return optionsForSkill({ scales: session.scales }, skill);
}
export function optionFor(session, skill, rating) {
  return optionsForSkillInSession(session, skill).find(o => o.value === rating);
}
function mapResult(session, paddlerId, skillId, fn) {
  return { ...session, results: session.results.map(r => (r.paddlerId === paddlerId && r.skillId === skillId ? fn(r) : r)) };
}
export function setRating(session, paddlerId, skillId, rating) {
  const skill = skillById(session, skillId);
  const opt = skill && optionFor(session, skill, rating);
  const keep = !!(opt && opt.requiresFeedback);
  return mapResult(session, paddlerId, skillId, r => ({ ...r, rating, feedback: keep ? r.feedback : '' }));
}
export function setFeedback(session, paddlerId, skillId, feedback) {
  return mapResult(session, paddlerId, skillId, r => ({ ...r, feedback }));
}
export function saveSession(session) { localStorage.setItem(KEY, JSON.stringify(session)); }
export function loadSession() {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw);
    // v3 sessions have per-paddler `target`; discard a v2-shaped session.
    if (!s || !Array.isArray(s.paddlers) || (s.paddlers.length > 0 && !('target' in s.paddlers[0]))) { clearSession(); return null; }
    return s;
  } catch { clearSession(); return null; }
}
export function clearSession() { localStorage.removeItem(KEY); }
