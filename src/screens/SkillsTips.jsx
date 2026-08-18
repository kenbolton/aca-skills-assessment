// Skills & Tips: a standalone home for the Top Tips, browsable any time without
// running an assessment. Pick a name to practise as, browse the skills that have
// tips (grouped by level and strand), open one, and work its cues — progress
// persists per learner in the same tipChecks store the on-water panel uses.
import { useState, useEffect } from 'preact/hooks';
import { tipsCatalog, skillMeta } from '../lib/tips-catalog.js';
import { tipsFor, learnerKey, masteredIds, toggleMastered } from '../lib/top-tips.js';
import { getTipChecks, putTipChecks } from '../lib/store.js';
import { plainFor } from '../lib/plain-language.js';
import { TopTips } from '../components/TopTips.jsx';
import { suggestTipUrl } from '../lib/suggest.js';

const NAME_KEY = 'aca-assessment:practice-name';
function readName() { try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; } }
function saveName(n) { try { localStorage.setItem(NAME_KEY, n); } catch { /* storage off */ } }

export function SkillsTips({ onBack }) {
  const cat = tipsCatalog();
  const [name, setName] = useState(readName);
  const [openId, setOpenId] = useState(null);
  const [tipChecks, setTipChecks] = useState({});

  const lKey = name.trim() ? learnerKey(name) : null;
  useEffect(() => {
    if (!lKey) { setTipChecks({}); return undefined; }
    let live = true;
    getTipChecks(lKey).then(rec => { if (live) setTipChecks(rec.checks || {}); }).catch(() => {});
    return () => { live = false; };
  }, [lKey]);

  function updateName(v) { setName(v); saveName(v); }
  function toggleTip(skillId, tipId) {
    const next = toggleMastered(tipChecks, skillId, tipId);
    setTipChecks(next);
    if (lKey) putTipChecks({ learnerKey: lKey, checks: next }).catch(err => console.error('tip save failed', err));
  }

  const meta = openId ? skillMeta(openId) : null;

  return (
    <main className="screen skills-tips-screen">
      <p>
        <button type="button" className="linklike" onClick={openId ? () => setOpenId(null) : onBack}>
          ◀ {openId ? 'All skills' : 'Back'}
        </button>
      </p>

      <label className="field practice-name">
        <span>Practising as</span>
        <input type="text" value={name} placeholder="your name" onInput={e => updateName(e.currentTarget.value)} />
      </label>
      {!lKey ? <p className="hint">Enter a name to save which tips you have mastered.</p> : null}

      {meta ? (
        <section className="tips-detail">
          <h2>{meta.name}</h2>
          <p className="tips-detail-meta">{meta.level} · {meta.strand ? meta.strand.name : meta.category}</p>
          {meta.standard ? <p className="tips-detail-standard">{meta.standard}</p> : null}
          {plainFor(openId) ? (
            <p className="plain-terms"><span className="plain-terms-label">In plain terms:</span> {plainFor(openId)}</p>
          ) : null}
          <TopTips tips={tipsFor(openId)} mastered={masteredIds(tipChecks, openId)} onToggle={id => toggleTip(openId, id)} />
          <p className="tips-suggest">
            <a href={suggestTipUrl(meta)} target="_blank" rel="noopener noreferrer">Suggest a tip for this skill →</a>
          </p>
        </section>
      ) : (
        <>
          <h2>Skills &amp; Tips</h2>
          {cat.levels.map(level => (
            <section className="tips-level" key={level.level}>
              <h3>{level.level}</h3>
              {level.strands.map(strand => (
                <div className="tips-strand" key={strand.key}>
                  <h4 className="tips-strand-name">{strand.name}</h4>
                  <ul className="tips-skill-list">
                    {strand.skills.map(s => {
                      const done = masteredIds(tipChecks, s.skillId).length;
                      return (
                        <li key={s.skillId}>
                          <button type="button" className="tips-skill" onClick={() => setOpenId(s.skillId)}>
                            <span className="tips-skill-name">{s.name}</span>
                            <span className="tips-skill-count">{`${done}/${s.tipCount}`}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </section>
          ))}
          <p className="hint tips-more">
            {`${cat.skillCount} skill${cat.skillCount === 1 ? '' : 's'} have tips so far. More welcome — see `}
            <a href="https://github.com/kenbolton/aca-skills-assessment/blob/main/CONTRIBUTING.md" target="_blank" rel="noopener noreferrer">CONTRIBUTING.md</a>.
          </p>
          <p className="tips-suggest">
            <a href={suggestTipUrl(null)} target="_blank" rel="noopener noreferrer">Suggest a tip →</a>
          </p>
        </>
      )}
    </main>
  );
}
