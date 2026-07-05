import { skillById, optionFor, getResult } from './session.js';

// Completion status of one skill across the paddlers it applies to:
//   'done' — every applicable paddler is rated and no required note is missing
//   'warn' — every applicable paddler is rated but a required note is still blank
//   'todo' — at least one applicable paddler is unrated (or none apply)
export function skillStatus(session, skill) {
  const applicable = session.paddlers.filter(p => p.target === skill.level);
  if (applicable.length === 0) return 'todo';
  let anyNeedsFeedback = false;
  for (const p of applicable) {
    const r = getResult(session, p.id, skill.id);
    if (!r || r.rating === null) return 'todo';
    if (resultNeedsFeedback(session, r)) anyNeedsFeedback = true;
  }
  return anyNeedsFeedback ? 'warn' : 'done';
}

export function resultNeedsFeedback(session, result) {
  if (session.selfAssessment) return false;
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
