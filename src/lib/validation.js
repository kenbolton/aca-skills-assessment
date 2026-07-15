import { skillById, optionFor, getResult } from './session.js';

// Completion status of one skill across the paddlers it applies to:
//   'done' — every applicable paddler is rated and no required note is missing
//   'warn' — every applicable paddler is rated but a required note is still blank
//   'dno'  — a required skill was marked "Did Not Observe" (blocks a pass)
//   'todo' — at least one applicable paddler is unrated (or none apply)
export function skillStatus(session, skill) {
  const applicable = session.paddlers.filter(p => p.target === skill.level);
  if (applicable.length === 0) return 'todo';
  let anyNeedsFeedback = false, anyDno = false;
  for (const p of applicable) {
    const r = getResult(session, p.id, skill.id);
    if (!r || r.rating === null) return 'todo';
    if (r.rating === 'dno' && !skill.optional) anyDno = true;
    if (resultNeedsFeedback(session, r)) anyNeedsFeedback = true;
  }
  return anyNeedsFeedback ? 'warn' : anyDno ? 'dno' : 'done';
}

// Feedback is required on a below-standard rating in EVERY mode, including
// self-assessment. Writing down *why* you rated yourself Below is where the
// learning is — waiving it for self-review made the weaker mode the laxer one,
// which is backwards for a tool whose point is honest self-appraisal.
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
  // A "Did Not Observe" on a required skill leaves the assessment unresolved.
  return core.every(r => r.rating !== null && r.rating !== 'dno') && invalidResults(session).length === 0;
}
