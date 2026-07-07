// The ordered pages of the Rate screen: an optional intro page (index 0) then
// the skills applicable to this session's paddlers, in skills order. Extracted
// so Rate and the review-page "jump to skill" lookup share one definition.
export function ratePages(session) {
  const visibleSkills = session.skills.filter(
    s => session.paddlers.some(p => p.target === s.level));
  const intro = session.intro && Array.isArray(session.intro.sections)
    && session.intro.sections.length ? session.intro : null;
  return intro ? [{ intro: true }, ...visibleSkills] : visibleSkills;
}

// Index of a skill in the Rate page space, or 0 (the first page) if not found.
export function indexOfSkill(session, skillId) {
  const i = ratePages(session).findIndex(p => !p.intro && p.id === skillId);
  return i >= 0 ? i : 0;
}
