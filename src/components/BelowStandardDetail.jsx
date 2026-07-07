// Expanded view of a paddler's below-standard ratings on the Review screen:
// each shows the full official standard and the assessor's note, with a link
// back to that skill on the Rate screen. A thin view; logic lives in summary.js
// and rate-pages.js.
export function BelowStandardDetail({ items, onEditSkill }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="below-standard-detail">
      {items.map(item => (
        <section className="bsd-item" key={item.skillId}>
          <div className="bsd-head">
            <h4 className="bsd-name">{item.name}</h4>
            <span className="bsd-meta">{item.category} · {item.ratingLabel}</span>
            {onEditSkill ? (
              <button type="button" className="bsd-goto" onClick={() => onEditSkill(item.skillId)}>
                Go to skill →
              </button>
            ) : null}
          </div>
          {item.standard ? <p className="bsd-standard">{item.standard}</p> : null}
          {item.feedback ? <p className="bsd-note"><strong>Note:</strong> {item.feedback}</p> : null}
        </section>
      ))}
    </div>
  );
}
