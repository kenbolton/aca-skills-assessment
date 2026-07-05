import { skillById, optionFor } from './session.js';

export function resultNeedsFeedback(session, result) {
  const skill = skillById(session, result.skillId);
  if (!skill || skill.optional) return false;
  const opt = optionFor(session, skill, result.rating);
  return !!(opt && opt.requiresFeedback) && result.feedback.trim() === '';
}

export function invalidResults(session) {
  return session.results.filter(r => resultNeedsFeedback(session, r));
}

export function isSessionComplete(session) {
  const core = session.results.filter(r => { const s = skillById(session, r.skillId); return s && !s.optional; });
  return core.every(r => r.rating !== null) && invalidResults(session).length === 0;
}
