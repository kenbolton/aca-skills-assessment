// Top Tips panel for the Rate screen. Shows the top few unchecked coaching cues
// for the current skill; checking one marks it mastered and surfaces the next.
// How many "few" means is the paddler's call — the whelm meter, shown whenever
// a caller offers to store the choice.
// Presentational — the current mastered set, the whelm step, and persistence
// are all managed above.
import { visibleTips } from '../lib/top-tips.js';
import { revealFor, DEFAULT_WHELM } from '../lib/whelm.js';
import { WhelmMeter } from './WhelmMeter.jsx';

// One cue row. A cue may carry a "signal" — the felt evidence that it is
// landing. It renders under the cue text and stays visible after mastery,
// because a signal is what a paddler re-checks once they believe they have it.
function Cue({ tip, done, onClick }) {
  const signals = tip.signal == null ? [] : (Array.isArray(tip.signal) ? tip.signal : [tip.signal]);
  return (
    <li>
      <button
        type="button"
        className={done ? 'tt-item tt-mastered' : 'tt-item'}
        aria-pressed={done ? 'true' : 'false'}
        onClick={onClick}
      >
        <span className="tt-box" aria-hidden="true">{done ? '☑' : '☐'}</span> {tip.text}
        {signals.map((sig, i) => <span key={i} className="tt-signal">{sig}</span>)}
      </button>
    </li>
  );
}

export function TopTips({ tips, mastered = [], onToggle, whelm = DEFAULT_WHELM, onWhelmChange, title = 'Top Tips' }) {
  if (!tips || tips.length === 0) return null;
  const { visible, mastered: done, total } = visibleTips(tips, mastered, revealFor(whelm));
  const toggle = id => () => onToggle && onToggle(id);
  return (
    <section className="top-tips">
      <h3 className="top-tips-head">
        {title} <span className="top-tips-count">{`${done.length}/${total}`}</span>
        {onWhelmChange ? <WhelmMeter value={whelm} onChange={onWhelmChange} /> : null}
      </h3>
      {visible.length ? (
        <ul className="top-tips-list">
          {visible.map(t => <Cue key={t.id} tip={t} done={false} onClick={toggle(t.id)} />)}
        </ul>
      ) : (
        <p className="tt-all">All tips mastered ✓</p>
      )}
      {done.length ? (
        <ul className="top-tips-done">
          {done.map(t => <Cue key={t.id} tip={t} done onClick={toggle(t.id)} />)}
        </ul>
      ) : null}
    </section>
  );
}
