// A compact, read-only preview of a skill's Top Tips, shown where the app names
// a next skill to work (Review's "Start with", the Journey's "working on"). It
// nudges with the top few cues; the full, checkable practice lives in the
// Skills & Tips home and the on-water Rate panel. Renders nothing without tips.
import { tipsFor } from '../lib/top-tips.js';

export function SkillTipsPreview({ skillId, max = 3 }) {
  const tips = skillId ? tipsFor(skillId) : [];
  if (!tips.length) return null;
  const shown = tips.slice(0, max);
  const more = tips.length - shown.length;
  return (
    <div className="tips-preview">
      <span className="tips-preview-label">How to work on it</span>
      <ul className="tips-preview-list">
        {shown.map(t => <li key={t.id}>{t.text}</li>)}
      </ul>
      {more > 0 ? <span className="tips-preview-more">{`+${more} more in Skills & Tips`}</span> : null}
    </div>
  );
}
