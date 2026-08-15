// A plain-language restatement of a skill for a learner, shown under the
// official standard on the Rate screen. Styled distinctly so it is never
// mistaken for the ACA standard text. Renders nothing without a gloss.
export function PlainTerms({ gloss }) {
  if (!gloss) return null;
  return (
    <p className="plain-terms">
      <span className="plain-terms-label">In plain terms:</span> {gloss}
    </p>
  );
}
