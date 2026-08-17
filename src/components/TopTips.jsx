// Top Tips panel for the Rate screen. Shows the top few unchecked coaching cues
// for the current skill; checking one marks it mastered and surfaces the next.
// Presentational — the current mastered set and persistence are managed above.
import { visibleTips } from '../lib/top-tips.js';

export function TopTips({ tips, mastered = [], onToggle, n = 4, title = 'Top Tips' }) {
  if (!tips || tips.length === 0) return null;
  const { visible, mastered: done, total } = visibleTips(tips, mastered, n);
  const toggle = id => () => onToggle && onToggle(id);
  return (
    <section className="top-tips">
      <h3 className="top-tips-head">
        {title} <span className="top-tips-count">{`${done.length}/${total}`}</span>
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
