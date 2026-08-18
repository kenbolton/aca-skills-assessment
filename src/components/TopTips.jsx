// Top Tips panel for the Rate screen. Shows the top few unchecked coaching cues
// for the current skill; checking one marks it mastered and surfaces the next.
// How many "few" means is the paddler's call — the whelm meter, shown whenever
// a caller offers to store the choice.
// Presentational — the current mastered set, the whelm step, and persistence
// are all managed above.
import { visibleTips } from '../lib/top-tips.js';
import { revealFor, DEFAULT_WHELM } from '../lib/whelm.js';
import { WhelmMeter } from './WhelmMeter.jsx';

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
          {visible.map(t => (
            <li key={t.id}>
              <button type="button" className="tt-item" aria-pressed="false" onClick={toggle(t.id)}>
                <span className="tt-box" aria-hidden="true">☐</span> {t.text}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="tt-all">All tips mastered ✓</p>
      )}
      {done.length ? (
        <ul className="top-tips-done">
          {done.map(t => (
            <li key={t.id}>
              <button type="button" className="tt-item tt-mastered" aria-pressed="true" onClick={toggle(t.id)}>
                <span className="tt-box" aria-hidden="true">☑</span> {t.text}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
