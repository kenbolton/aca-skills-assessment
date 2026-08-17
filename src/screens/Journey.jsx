// The learner-facing Journey: one paddler's development over time, assembled
// from the learner model. Read-only; reached by tapping a paddler on the
// Archive summary. A thin view — all logic lives in learner.js.
function fmtDate(iso) {
  const d = new Date(iso);
  return isNaN(d) ? '' : d.toLocaleDateString();
}

const LANDING_LABEL = {
  L1: 'Met L1', L2: 'Met L2', did_not_meet_L1: 'Below L1',
  meets_level: 'Met level', below_level: 'Below level', pending: 'In progress',
};

export function Journey({ journey, onBack }) {
  if (!journey) {
    return (
      <main className="screen journey-screen">
        <p><button type="button" className="linklike" onClick={onBack}>◀ Back</button></p>
        <p className="hint">That paddler has no saved assessments.</p>
      </main>
    );
  }
  const j = journey;
  return (
    <main className="screen journey-screen">
      <p><button type="button" className="linklike" onClick={onBack}>◀ Back to past assessments</button></p>
      <h2>{j.name}</h2>
      <p className="journey-meta">
        {`${j.latestTarget} · ${j.sessionCount} session${j.sessionCount === 1 ? '' : 's'} · ${j.metCount} of ${j.totalSkills} skills met`}
      </p>

      <h3>Progress by strand</h3>
      <ul className="journey-strands">
        {j.strands.map(s => (
          <li className="journey-strand" key={s.key}>
            <span className="journey-strand-name">{s.name}</span>
            <span className="journey-strand-bar">
              <span className="journey-strand-fill" style={`width:${s.total ? Math.round((100 * s.met) / s.total) : 0}%`} />
            </span>
            <span className="journey-strand-count">{`${s.met}/${s.total}`}</span>
          </li>
        ))}
      </ul>

      {j.newlyMet.length ? (
        <section>
          <h3>Growth</h3>
          <p className="journey-grew">
            {`${j.newlyMet.length} skill${j.newlyMet.length === 1 ? '' : 's'} newly met: `}
            {j.newlyMet.slice(0, 8).join(', ')}
            {j.newlyMet.length > 8 ? `, and ${j.newlyMet.length - 8} more` : ''}
          </p>
        </section>
      ) : null}

      {j.next ? (
        <section>
          <h3>Working on</h3>
          <p className="journey-next">
            <strong>{j.next.name}</strong>{j.next.gloss ? ` — ${j.next.gloss}` : ''}
          </p>
          {j.gaps.filter(g => g !== j.next.name).length ? (
            <p className="journey-gaps">{`Then: ${j.gaps.filter(g => g !== j.next.name).join(', ')}`}</p>
          ) : null}
        </section>
      ) : null}

      {j.due.length ? (
        <section>
          <h3>{`Due for re-check (${j.due.length})`}</h3>
          <ul className="journey-due">
            {j.due.slice(0, 6).map(d => <li key={d.skillId}>{d.name}</li>)}
            {j.due.length > 6 ? <li className="journey-more">{`+ ${j.due.length - 6} more`}</li> : null}
          </ul>
        </section>
      ) : null}

      <h3>Assessment history</h3>
      <ul className="journey-history">
        {j.history.map(h => (
          <li key={h.id}>{`${fmtDate(h.at)} · ${h.target} · ${LANDING_LABEL[h.landing] || h.landing || ''}`}</li>
        ))}
      </ul>
    </main>
  );
}
