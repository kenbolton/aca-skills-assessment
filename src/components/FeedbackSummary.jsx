// Formative "where to next" panel for a paddler on the Review screen. It frames
// the assessment as feedback for learning on the three questions: where you are
// going (goal progress), how you are doing (strengths), and where to next (the
// one priority skill to start with). Detail per gap lives in BelowStandardDetail.
export function FeedbackSummary({ summary }) {
  if (!summary || !summary.target) return null;
  const { target, metCount, coreTotal, strengths, priorityNext } = summary;
  return (
    <div className="feedback-summary">
      <p className="feedback-goal">
        <span className="feedback-label">{`Toward ${target}:`}</span>{' '}
        {`${metCount} of ${coreTotal} core skills met`}
      </p>
      {strengths && strengths.length ? (
        <p className="feedback-strengths">
          <span className="feedback-label">Strengths:</span> {strengths.join(', ')}
        </p>
      ) : null}
      {priorityNext ? (
        <p className="feedback-next">
          <span className="feedback-label">Start with:</span> {priorityNext.name}
        </p>
      ) : null}
    </div>
  );
}
