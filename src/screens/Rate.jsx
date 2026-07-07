import { useState, useEffect } from 'preact/hooks';
import { getResult, setRating, setFeedback, optionsForSkillInSession } from '../lib/session.js';
import { skillLabel } from '../lib/skills.js';
import { resultNeedsFeedback, skillStatus } from '../lib/validation.js';
import { ratePages, indexOfSkill } from '../lib/rate-pages.js';
import lessons from '../data/lessons.json';

// Lesson HTML fragments are bundled ONLY in the private build. The public build's
// lessons-content/ has no *.html (git-ignored), so this glob resolves to {}.
const LESSON_FRAGMENTS = import.meta.glob('/lessons-content/*.html', {
  eager: true, query: '?raw', import: 'default',
});
const CONTENT_BY_SLUG = Object.fromEntries(
  Object.entries(LESSON_FRAGMENTS).map(
    ([path, html]) => [path.split('/').pop().replace(/\.html$/, ''), html],
  ),
);
// Training-guidance fragments, keyed by level (l4/l5). Same private-only pattern:
// training-content/ is git-ignored and empty in the public build, so this is {}.
const TRAINING_FRAGMENTS = import.meta.glob('/training-content/*.html', {
  eager: true, query: '?raw', import: 'default',
});
const TRAINING_BY_LEVEL = Object.fromEntries(
  Object.entries(TRAINING_FRAGMENTS).map(
    ([path, html]) => [path.split('/').pop().replace(/\.html$/, '').toLowerCase(), html],
  ),
);
const PRIVATE = import.meta.env.VITE_PRIVATE === 'true';

const STATUS_MARK = { done: '✓', warn: '⚠', dno: '⊘', todo: '○' };
function shortCat(c) { return String(c).replace(/^(Core|Venue[^:]*):\s*/, ''); }

function countRatedCoreSkills(session, visibleSkills) {
  const coreSkills = visibleSkills.filter(s => !s.optional);
  let rated = 0;
  for (const skill of coreSkills) {
    const applicable = session.paddlers.filter(p => p.target === skill.level);
    const allRated = applicable.every(p => {
      const result = getResult(session, p.id, skill.id);
      return result && result.rating !== null;
    });
    if (allRated) rated += 1;
  }
  return { rated, total: coreSkills.length };
}

export function Rate({ session, onChange, onDone, focusSkillId = null }) {
  const [i, setI] = useState(() => indexOfSkill(session, focusSkillId));
  const [showLesson, setShowLesson] = useState(false);
  const [showTraining, setShowTraining] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  // The whole page scrolls as one document, so moving to another skill
  // (Next/Prev or a jump from the Skills overlay) must return to the top.
  useEffect(() => { window.scrollTo(0, 0); }, [i]);

  // A skill is only shown if at least one paddler's target matches its level;
  // skills with no applicable paddler are auto-skipped by never appearing here.
  // The optional assessment intro is the first page; the rest are the rateable skills.
  const pages = ratePages(session);
  const visibleSkills = pages.filter(p => !p.intro);
  const intro = pages.length > 0 && pages[0].intro ? session.intro : null;

  if (visibleSkills.length === 0) {
    return (
      <main className="screen rate-screen">
        <p>No skills apply to this session's paddlers.</p>
      </main>
    );
  }

  // The assessment's level, used to pick the (private-build-only) training fragment.
  const introLevel = (visibleSkills[0] && visibleSkills[0].level || '').toLowerCase();
  const page = pages[i];
  const onIntro = !!page.intro;
  const skill = onIntro ? null : page;

  const isLast = i === pages.length - 1;
  const { rated: coreRated, total: coreTotal } = countRatedCoreSkills(session, visibleSkills);
  const skillNo = onIntro ? 0 : i - (intro ? 1 : 0) + 1;

  const rowPaddlers = onIntro ? [] : session.paddlers.filter(p => p.target === skill.level);
  const options = onIntro ? [] : optionsForSkillInSession(session, skill);

  const rowsInfo = rowPaddlers.map(paddler => {
    const result = getResult(session, paddler.id, skill.id);
    const needsFeedback = result ? resultNeedsFeedback(session, result) : false;
    return { paddler, result, needsFeedback };
  });

  const blocked = rowsInfo.some(r => r.needsFeedback);

  function goPrev() {
    if (blocked || i === 0) return;
    setI(i - 1);
  }

  function goNext() {
    if (blocked || isLast) return;
    setI(i + 1);
  }

  function handleRate(paddlerId, value) {
    onChange(setRating(session, paddlerId, skill.id, value));
  }

  function handleFeedback(paddlerId, value) {
    onChange(setFeedback(session, paddlerId, skill.id, value));
  }

  return (
    <main className="screen rate-screen">
      <button type="button" className="skills-nav-button" onClick={() => setNavOpen(true)}>
        ☰ Skills {i + 1}/{pages.length}
      </button>

      {navOpen ? (
        <div className="skills-nav-overlay" role="dialog" aria-label="Skills" onClick={() => setNavOpen(false)}>
          <div className="skills-nav-panel" onClick={e => e.stopPropagation()}>
            <div className="skills-nav-head">
              <strong>Skills</strong>
              <button type="button" className="skills-nav-close" aria-label="Close" onClick={() => setNavOpen(false)}>✕</button>
            </div>
            <ul className="skills-nav-list">
              {pages.map((p, idx) => {
                if (p.intro) {
                  return (
                    <li key="__intro">
                      <button
                        type="button"
                        className={`skills-nav-item skills-nav-intro${idx === i ? ' current' : ''}`}
                        onClick={() => { setI(idx); setNavOpen(false); }}
                      >
                        <span className="skills-nav-mark">ⓘ</span>
                        <span className="skills-nav-name">Overview</span>
                        <span className="skills-nav-cat">about this assessment</span>
                      </button>
                    </li>
                  );
                }
                const status = skillStatus(session, p);
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      className={`skills-nav-item status-${status}${idx === i ? ' current' : ''}`}
                      onClick={() => { setI(idx); setNavOpen(false); }}
                    >
                      <span className="skills-nav-mark">{STATUS_MARK[status]}</span>
                      <span className="skills-nav-name">{skillLabel(p)}</span>
                      <span className="skills-nav-cat">{shortCat(p.category)}{p.optional ? ' · opt' : ''}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="skills-nav-foot">
              <button type="button" className="skills-nav-review" onClick={() => { setNavOpen(false); onDone(); }}>
                Review &rarr;
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {onIntro ? (
        <div className="rate-header intro-page">
          <p className="rate-meta">Assessment overview</p>
          <h2 className="rate-skill-name">{intro.title || 'Overview'}</h2>
          <div className="intro-body">
            {intro.sections.map((sec, si) => (
              <section className="intro-section" key={si}>
                <h3 className="intro-heading">{sec.heading}</h3>
                {sec.body ? <p className="intro-text">{sec.body}</p> : null}
                {sec.items ? (
                  <ul className="intro-list">
                    {sec.items.map((it, ii) => <li key={ii}>{it}</li>)}
                  </ul>
                ) : null}
                {sec.link ? (
                  <p className="intro-text">
                    <a className="intro-link" href={sec.link.href} target="_blank" rel="noreferrer">{sec.link.label} ↗</a>
                  </p>
                ) : null}
                {/* Full guidance text is embedded only in the private build, where the
                    training-content fragment for this level exists. */}
                {sec.link && PRIVATE && TRAINING_BY_LEVEL[introLevel] ? (
                  <div className="teaching">
                    <button type="button" className="link-button" onClick={() => setShowTraining(v => !v)}>
                      📄 {showTraining ? 'Hide' : 'Show'} full training guidance
                    </button>
                    {showTraining ? (
                      <div className="lesson-content" dangerouslySetInnerHTML={{ __html: TRAINING_BY_LEVEL[introLevel] }} />
                    ) : null}
                  </div>
                ) : null}
              </section>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="rate-header">
            <p className="rate-meta">
              {skill.category} &middot; Skill {skillNo}/{visibleSkills.length} &middot; Core rated {coreRated}/{coreTotal}
            </p>
            <h2 className="rate-skill-name">{skillLabel(skill)}</h2>
            {skill.optional ? (
              <span className="badge badge-optional">Optional — does not count against the paddler</span>
            ) : null}
            {skill.competency ? <p className="rate-competency">{skill.competency}</p> : null}
            {/* Show the box whenever there's calibration to show. When a skill has no
                short name (L4/L5), the standard is already the heading above, so the
                "level standard" row is skipped to avoid repeating it — but the
                Below/Exceeds descriptors still show. */}
            {(skill.name || skill.l1Standard || skill.belowStandard || skill.exceedsStandard) ? (
              <div className="standard-box">
                {skill.l1Standard ? (
                  <div className="standard-section">
                    <div className="standard-box-header"><span>L1 standard</span></div>
                    <p className="standard-box-text">{skill.l1Standard}</p>
                  </div>
                ) : null}
                {skill.belowStandard ? (
                  <div className="standard-section">
                    <div className="standard-box-header"><span>Below standard</span></div>
                    <p className="standard-box-text">{skill.belowStandard}</p>
                  </div>
                ) : null}
                {skill.name ? (
                  <div className="standard-section">
                    <div className="standard-box-header"><span>{skill.level} standard</span></div>
                    <p className="standard-box-text">{skill.standard}</p>
                  </div>
                ) : null}
                {skill.exceedsStandard ? (
                  <div className="standard-section">
                    <div className="standard-box-header"><span>Exceeds standard</span></div>
                    <p className="standard-box-text">{skill.exceedsStandard}</p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="rate-rows">
            {rowsInfo.map(({ paddler, result, needsFeedback }) => (
              <div className="paddler-row" key={paddler.id}>
                <div className="paddler-row-name">{paddler.name}</div>
                <div className="chip-row">
                  {options.map(opt => {
                    const selected = result && result.rating === opt.value;
                    const chipClass = [
                      'chip',
                      selected ? (opt.value === 'dno' ? 'chip-neutral' : opt.requiresFeedback ? 'chip-danger' : 'chip-positive') : '',
                    ].filter(Boolean).join(' ');
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        className={chipClass}
                        data-value={opt.value}
                        aria-pressed={selected}
                        onClick={() => handleRate(paddler.id, opt.value)}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
                <textarea
                  className={`feedback-box${needsFeedback ? ' feedback-required' : ''}`}
                  value={result ? result.feedback : ''}
                  placeholder={needsFeedback
                    ? 'Required: what did not meet the standard? (tap the keyboard mic to dictate)'
                    : 'Optional note (tap the keyboard mic to dictate)'}
                  onInput={e => handleFeedback(paddler.id, e.currentTarget.value)}
                />
              </div>
            ))}
          </div>

          {PRIVATE && lessons[skill.id] && CONTENT_BY_SLUG[lessons[skill.id]] ? (
            <div className="teaching">
              <button type="button" className="link-button" onClick={() => setShowLesson(s => !s)}>
                📖 {showLesson ? 'Hide' : 'Show'} teaching notes &amp; drills
              </button>
              {showLesson ? (
                <div
                  className="lesson-content"
                  dangerouslySetInnerHTML={{ __html: CONTENT_BY_SLUG[lessons[skill.id]] }}
                />
              ) : null}
            </div>
          ) : null}
        </>
      )}

      {blocked ? (
        <p className="error blocking-message">
          Feedback is required for each below-standard rating before moving on.
        </p>
      ) : null}

      <div className="rate-nav">
        <button type="button" onClick={goPrev} disabled={blocked || i === 0}>
          ◀ Prev
        </button>
        {isLast ? (
          <button type="button" onClick={onDone} disabled={blocked}>
            Review ▶
          </button>
        ) : (
          <button type="button" onClick={goNext} disabled={blocked}>
            {onIntro ? 'Begin rating ▶' : 'Next ▶'}
          </button>
        )}
      </div>
    </main>
  );
}
