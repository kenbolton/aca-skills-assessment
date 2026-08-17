// Read-only "Paddlers over time" summary for the Archive screen: one row per
// learner (grouped by name), showing activity, growth, and the working edge.
// Names are matched loosely, so this doubles as a way to spot a mis-grouping.

function fmtDate(iso) {
  const d = new Date(iso);
  return isNaN(d) ? '' : d.toLocaleDateString();
}

export function LearnerSummary({ rows }) {
  if (!rows || rows.length === 0) return null;
  return (
    <section className="learner-summary">
      <h3>Paddlers over time</h3>
      <ul className="learner-list">
        {rows.map(r => (
          <li className="learner-row" key={r.key}>
            <div className="learner-head">
              <strong className="learner-name">{r.name}</strong>
              <span className="learner-meta">
                {`${r.sessionCount} session${r.sessionCount === 1 ? '' : 's'} · ${r.latestTarget}`}
                {r.sessionCount > 1 ? ` · ${fmtDate(r.firstAt)}–${fmtDate(r.lastAt)}` : ` · ${fmtDate(r.lastAt)}`}
              </span>
            </div>
            <div className="learner-stats">
              {r.newlyMetCount > 0 ? (
                <span className="learner-grew">{`${r.newlyMetCount} skill${r.newlyMetCount === 1 ? '' : 's'} newly met`}</span>
              ) : null}
              {r.nextName ? (
                <span className="learner-next"><strong>Working on:</strong> {r.nextName}</span>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
