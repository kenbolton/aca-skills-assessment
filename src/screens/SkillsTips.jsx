// Skills & Tips: a standalone home for the Top Tips, browsable any time without
// running an assessment. Browse the techniques that have cues, open one, and
// work it — progress persists in the same tipChecks store the on-water panel
// uses, under the device owner's own key.
//
// Two things this screen deliberately does not do. It does not ask who you are:
// whoever holds the device knows their own name, and asking bought nothing but
// a field whose only effect was invisible until reload. And it shows no level:
// a technique is one technique at every level that examines it, its cues are
// authored once, and mastery is keyed by technique — so level headings would
// only split one row into three that move together.
import { useState, useEffect } from 'preact/hooks';
import { techniqueCatalog, techniqueMeta } from '../lib/tips-catalog.js';
import { tipsFor, masteredIds, toggleMastered, LOCAL_LEARNER } from '../lib/top-tips.js';
import { getTipChecks, putTipChecks } from '../lib/store.js';
import { plainFor } from '../lib/plain-language.js';
import { readWhelm, writeWhelm } from '../lib/whelm.js';
import { TopTips } from '../components/TopTips.jsx';
import { suggestTipUrl, DISCORD_URL } from '../lib/suggest.js';

const CONTRIBUTING_URL = 'https://github.com/kenbolton/aca-skills-assessment/blob/main/CONTRIBUTING.md';

export function SkillsTips({ onBack }) {
  const cat = techniqueCatalog();
  const [openId, setOpenId] = useState(null);
  const [tipChecks, setTipChecks] = useState({});
  const [whelm, setWhelm] = useState(readWhelm);

  useEffect(() => {
    let live = true;
    getTipChecks(LOCAL_LEARNER).then(rec => { if (live) setTipChecks(rec.checks || {}); }).catch(() => {});
    return () => { live = false; };
  }, []);

  function changeWhelm(step) { setWhelm(step); writeWhelm(step); }
  function toggleTip(skillId, tipId) {
    const next = toggleMastered(tipChecks, skillId, tipId);
    setTipChecks(next);                          // optimistic; the save never blocks the tap
    putTipChecks({ learnerKey: LOCAL_LEARNER, checks: next }).catch(err => console.error('tip save failed', err));
  }

  const meta = openId ? techniqueMeta(openId) : null;
  // Any skill mapped to the technique resolves its cues and its saved progress,
  // both of which are keyed by technique. The catalog orders them lowest level
  // first, so this is also the plainest wording for the gloss.
  const example = meta ? meta.skills[0] : null;
  const gloss = example ? plainFor(example.skillId) : null;

  return (
    <main className="screen skills-tips-screen">
      <p>
        <button type="button" className="linklike" onClick={openId ? () => setOpenId(null) : onBack}>
          ◀ {openId ? 'All techniques' : 'Back'}
        </button>
      </p>

      {meta ? (
        <section className="tips-detail">
          <h2>{meta.name}</h2>
          {gloss ? (
            <p className="plain-terms"><span className="plain-terms-label">In plain terms:</span> {gloss}</p>
          ) : null}
          <TopTips
            tips={tipsFor(example.skillId)}
            mastered={masteredIds(tipChecks, example.skillId)}
            onToggle={id => toggleTip(example.skillId, id)}
            whelm={whelm}
            onWhelmChange={changeWhelm}
          />
          <p className="tips-suggest">
            <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer">Suggest a tip in Discord</a>
            {' (#top-tips) · '}
            <a className="tips-suggest-alt" href={suggestTipUrl({ name: meta.name, skillId: meta.technique })} target="_blank" rel="noopener noreferrer">or a GitHub issue</a>
          </p>
        </section>
      ) : (
        <>
          <h2>Skills &amp; Tips</h2>
          <ul className="tips-skill-list">
            {cat.techniques.map(t => {
              const done = masteredIds(tipChecks, t.skills[0].skillId).length;
              return (
                <li key={t.technique}>
                  <button type="button" className="tips-skill" onClick={() => setOpenId(t.technique)}>
                    <span className="tips-skill-name">{t.name}</span>
                    <span className="tips-skill-count">{`${done}/${t.tipCount}`}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="hint tips-more">
            {`${cat.techniqueCount} technique${cat.techniqueCount === 1 ? '' : 's'} ${cat.techniqueCount === 1 ? 'has' : 'have'} tips so far. More welcome — see `}
            <a href={CONTRIBUTING_URL} target="_blank" rel="noopener noreferrer">CONTRIBUTING.md</a>.
          </p>
          <p className="tips-suggest">
            <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer">Suggest a tip in Discord</a>
            {' (#top-tips) · '}
            <a className="tips-suggest-alt" href={suggestTipUrl(null)} target="_blank" rel="noopener noreferrer">or a GitHub issue</a>
          </p>
        </>
      )}
    </main>
  );
}
