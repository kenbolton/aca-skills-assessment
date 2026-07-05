import { skillById, optionFor } from './session.js';

export function resultNeedsFeedback(session, result) {
  const skill = skillById(session, result.skillId);
  if (skill && skill.optional) return false;
  const option = optionFor(session, result.rating);
  if (!option || !option.requiresFeedback) return false;
  return result.feedback.trim() === '';
}

export function invalidResults(session) {
  return session.results.filter(r => resultNeedsFeedback(session, r));
}

export function isSessionComplete(session) {
  const coreRated = session.results.every(r => {
    const skill = skillById(session, r.skillId);
    if (skill && skill.optional) return true;
    return r.rating !== null;
  });
  return coreRated && invalidResults(session).length === 0;
}
