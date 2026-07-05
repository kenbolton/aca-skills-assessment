export function sessionSummary(session) {
  const core = session.skills.filter(s => !s.optional);
  let rated = 0;
  for (const skill of core) {
    const allRated = session.paddlers.every(p => {
      const r = session.results.find(x => x.paddlerId === p.id && x.skillId === skill.id);
      return r && r.rating !== null;
    });
    if (allRated) rated += 1;
  }
  return {
    id: session.id,
    createdAt: session.createdAt,
    levelId: session.levelId,
    levelName: session.levelName,
    paddlers: session.paddlers.map(p => p.name),
    counts: { core: core.length, rated },
  };
}
