import { optionsForSkill } from './skills.js';

const KEY = 'aca-assessment:session';
let seq = 0;
function pid() { return `p${++seq}`; }

const CONDITION_KEYS = ['wind', 'waves', 'surf', 'current'];
function normConditions(raw) {
  const out = {};
  for (const k of CONDITION_KEYS) {
    const v = raw && typeof raw[k] === 'string' ? raw[k].trim() : '';
    if (v) out[k] = v;
  }
  return out;
}

export function createSession({ id, createdAt, config, location = '', conditions = {}, paddlers, selfAssessment = false }) {
  const people = paddlers.map(p => ({ name: (p.name || '').trim(), target: p.target })).filter(p => p.name);
  const withIds = people.map(p => ({ id: pid(), name: p.name, target: p.target }));
  const results = [];
  for (const p of withIds) {
    for (const sk of config.skills) {
      if (sk.level === p.target) results.push({ paddlerId: p.id, skillId: sk.id, rating: null, feedback: '' });
    }
  }
  return { id, createdAt, location, conditions: normConditions(conditions), selfAssessment: !!selfAssessment, scales: config.scales, intro: config.intro || null, paddlers: withIds, skills: config.skills, results, actionPlans: {} };
}

const CONDITION_LABELS = { wind: 'Wind', waves: 'Waves', surf: 'Surf', current: 'Current' };
// A human line of the observed conditions actually recorded (present ones only).
export function conditionsSummary(session) {
  const c = session.conditions || {};
  return CONDITION_KEYS.filter(k => c[k]).map(k => `${CONDITION_LABELS[k]} ${c[k]}`).join(' · ');
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
  // A note may be attached to any rating, so changing the rating must never
  // discard a note the instructor already wrote for this skill/paddler.
  return mapResult(session, paddlerId, skillId, r => ({ ...r, rating }));
}
export function setFeedback(session, paddlerId, skillId, feedback) {
  return mapResult(session, paddlerId, skillId, r => ({ ...r, feedback }));
}
// A per-paddler action plan / return recommendation, given when a paddler is
// below standard. Kept in a map keyed by paddler id (absent on older sessions).
export function getActionPlan(session, paddlerId) {
  return (session.actionPlans && session.actionPlans[paddlerId]) || '';
}
export function setActionPlan(session, paddlerId, text) {
  return { ...session, actionPlans: { ...(session.actionPlans || {}), [paddlerId]: text } };
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
