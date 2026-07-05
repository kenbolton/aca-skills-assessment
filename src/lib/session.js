import { getLevel, skillsForLevel, scaleForLevel } from './skills.js';

const KEY = 'aca-assessment:session';

let seq = 0;
function pid() { return `p${++seq}-${seq}`; }

export function createSession({ id, createdAt, config, levelId, location = '', paddlerNames }) {
  const level = getLevel(config, levelId);
  const paddlers = paddlerNames
    .map(n => n.trim())
    .filter(Boolean)
    .map(name => ({ id: pid(), name }));
  const skills = skillsForLevel(config, levelId);
  const scale = scaleForLevel(config, levelId);
  const results = [];
  for (const p of paddlers) {
    for (const sk of skills) {
      results.push({ paddlerId: p.id, skillId: sk.id, rating: null, feedback: '' });
    }
  }
  return {
    id,
    createdAt,
    levelId,
    levelName: level ? level.name : '',
    location,
    scale,
    paddlers,
    skills,
    results,
  };
}

export function getResult(session, paddlerId, skillId) {
  return session.results.find(r => r.paddlerId === paddlerId && r.skillId === skillId);
}

export function skillById(session, skillId) {
  return session.skills.find(s => s.id === skillId);
}

export function optionFor(session, rating) {
  return session.scale.find(o => o.value === rating);
}

function mapResult(session, paddlerId, skillId, fn) {
  return {
    ...session,
    results: session.results.map(r =>
      r.paddlerId === paddlerId && r.skillId === skillId ? fn(r) : r),
  };
}

export function setRating(session, paddlerId, skillId, rating) {
  return mapResult(session, paddlerId, skillId, r => {
    const option = optionFor(session, rating);
    const requiresFeedback = Boolean(option && option.requiresFeedback);
    return {
      ...r,
      rating,
      feedback: requiresFeedback ? r.feedback : '',
    };
  });
}

export function setFeedback(session, paddlerId, skillId, feedback) {
  return mapResult(session, paddlerId, skillId, r => ({ ...r, feedback }));
}

export function saveSession(session) {
  localStorage.setItem(KEY, JSON.stringify(session));
}

export function loadSession() {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    clearSession();
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(KEY);
}
