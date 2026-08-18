// The whelm meter: three positions, over to under, setting how many cues the
// Top Tips panel reveals. Presentational — the current step and its persistence
// are managed above, as with the mastered set.
import { WHELM_STEPS } from '../lib/whelm.js';

export function WhelmMeter({ value, onChange }) {
  return (
    <span className="whelm" role="group" aria-label="How many tips to reveal">
      <span className="whelm-label">whelm</span>
      {WHELM_STEPS.map(s => (
        <button
          key={s.key}
          type="button"
          className={`whelm-step${s.key === value ? ' whelm-on' : ''}`}
          aria-pressed={s.key === value ? 'true' : 'false'}
          aria-label={`${s.label}whelmed — reveal ${s.reveal} tips`}
          onClick={() => onChange && onChange(s.key)}
        >
          {s.label}
        </button>
      ))}
    </span>
  );
}
