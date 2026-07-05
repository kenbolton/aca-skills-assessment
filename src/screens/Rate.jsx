import { useState } from 'preact/hooks';
import { getResult, setRating, setFeedback, optionsForSkillInSession } from '../lib/session.js';
import { resultNeedsFeedback } from '../lib/validation.js';
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
const PRIVATE = import.meta.env.VITE_PRIVATE === 'true';

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

export function Rate({ session, onChange, onDone }) {
  const [i, setI] = useState(0);
  const [showLesson, setShowLesson] = useState(false);

  // A skill is only shown if at least one paddler's target matches its level;
  // skills with no applicable paddler are auto-skipped by never appearing here.
  const visibleSkills = session.skills.filter(s => session.paddlers.some(p => p.target === s.level));

  if (visibleSkills.length === 0) {
    return (
      <main className="screen rate-screen">
        <p>No skills apply to this session's paddlers.</p>
      </main>
    );
  }

  const skill = visibleSkills[i];
  const isLast = i === visibleSkills.length - 1;
  const { rated: coreRated, total: coreTotal } = countRatedCoreSkills(session, visibleSkills);

  const rowPaddlers = session.paddlers.filter(p => p.target === skill.level);
  const options = optionsForSkillInSession(session, skill);

  const rowsInfo = rowPaddlers.map(paddler => {
    const result = getResult(session, paddler.id, skill.id);
    const selectedOption = result ? options.find(o => o.value === result.rating) : null;
    const needsFeedback = result ? resultNeedsFeedback(session, result) : false;
    return { paddler, result, selectedOption, needsFeedback };
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
      <div className="rate-header">
        <p className="rate-meta">
          {skill.category} &middot; Skill {i + 1}/{visibleSkills.length} &middot; Core rated {coreRated}/{coreTotal}
        </p>
        <h2 className="rate-skill-name">{skill.name}</h2>
        {skill.optional ? (
          <span className="badge badge-optional">Optional — does not count against the paddler</span>
        ) : null}
        {skill.competency ? <p className="rate-competency">{skill.competency}</p> : null}
        <div className="standard-box">
          <div className="standard-box-header">
            <span>Standard</span>
          </div>
          <p className="standard-box-text">{skill.standard}</p>
          {skill.l1Standard ? (
            <div className="standard-box-secondary">
              <div className="standard-box-header">
                <span>L1 standard</span>
              </div>
              <p className="standard-box-text">{skill.l1Standard}</p>
            </div>
          ) : null}
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
      </div>

      <div className="rate-rows">
        {rowsInfo.map(({ paddler, result, selectedOption, needsFeedback }) => (
          <div className="paddler-row" key={paddler.id}>
            <div className="paddler-row-name">{paddler.name}</div>
            <div className="chip-row">
              {options.map(opt => {
                const selected = result && result.rating === opt.value;
                const chipClass = [
                  'chip',
                  selected ? (opt.requiresFeedback ? 'chip-danger' : 'chip-positive') : '',
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
            {result && selectedOption && selectedOption.requiresFeedback ? (
              <textarea
                className={`feedback-box${needsFeedback ? ' feedback-required' : ''}`}
                value={result.feedback}
                placeholder="What did not meet the standard? (tap the keyboard mic to dictate)"
                onInput={e => handleFeedback(paddler.id, e.currentTarget.value)}
              />
            ) : null}
          </div>
        ))}
      </div>

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
            Next ▶
          </button>
        )}
      </div>
    </main>
  );
}
