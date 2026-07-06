import { useState } from 'preact/hooks';
import { loadConfig } from '../lib/skills.js';
import { createSession } from '../lib/session.js';
import rawSkills from '../data/skills.json';
import rawL3 from '../data/skills-l3.json';
import rawL4 from '../data/skills-l4.json';
import rawL5 from '../data/skills-l5.json';

// One config per assessment mode. 'L1/L2' keeps the combined per-paddler-target
// behavior (with cross-level landing); L3/L4/L5 are standalone single-level configs.
const CONFIGS = {
  'L1/L2': loadConfig(rawSkills),
  L3: loadConfig(rawL3),
  L4: loadConfig(rawL4),
  L5: loadConfig(rawL5),
};
const LEVEL_OPTIONS = [
  { key: 'L1/L2', label: 'L1 / L2 — combined (with landing)' },
  { key: 'L3', label: 'L3 — Coastal Kayaking' },
  { key: 'L4', label: 'L4 — Open Water Coastal Kayaking' },
  { key: 'L5', label: 'L5 — Advanced Open Water Coastal Kayaking' },
];
const PADDLER_COUNT = 5;
const PRIVATE = import.meta.env.VITE_PRIVATE === 'true';
const TARGETS = ['L1', 'L2'];

export function Setup({ onStart }) {
  const [location, setLocation] = useState('');
  const [level, setLevel] = useState('L1/L2');
  const [selfAssessment, setSelfAssessment] = useState(false);
  const [paddlers, setPaddlers] = useState(
    Array.from({ length: PADDLER_COUNT }, () => ({ name: '', target: 'L2' })),
  );
  const [solo, setSolo] = useState({ name: '', target: 'L2' });
  const [error, setError] = useState('');

  // In standalone mode every paddler shares the one level; the per-paddler target
  // dropdown only applies to the combined L1/L2 assessment.
  const standalone = level !== 'L1/L2';

  function updatePaddlerName(index, value) {
    setPaddlers(rows => rows.map((p, i) => (i === index ? { ...p, name: value } : p)));
  }
  function updatePaddlerTarget(index, value) {
    setPaddlers(rows => rows.map((p, i) => (i === index ? { ...p, target: value } : p)));
  }

  function handleStart() {
    const withTarget = p => ({ name: p.name, target: standalone ? level : p.target });
    const chosen = selfAssessment
      ? [withTarget({ name: solo.name.trim() || 'Me', target: solo.target })]
      : paddlers.map(withTarget);
    const session = createSession({
      id: `sess-${Date.now()}`,
      createdAt: new Date().toISOString(),
      config: CONFIGS[level],
      location,
      paddlers: chosen,
      selfAssessment,
    });
    if (session.paddlers.length === 0) {
      setError('Add at least one paddler name.');
      return;
    }
    setError('');
    onStart(session);
  }

  return (
    <main className="screen setup-screen">
      <h1>New Assessment</h1>
      {PRIVATE ? <p><a href="/sessions">Past assessments &rarr;</a></p> : null}

      <label className="field">
        <span>Assessment level</span>
        <select value={level} onChange={e => setLevel(e.currentTarget.value)}>
          {LEVEL_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
      </label>

      <label className="field checkbox-field">
        <input type="checkbox" checked={selfAssessment} onChange={e => setSelfAssessment(e.currentTarget.checked)} />
        <span>Self-assessment (just me — notes optional)</span>
      </label>

      <label className="field">
        <span>Location (optional)</span>
        <input type="text" value={location} onChange={e => setLocation(e.currentTarget.value)} />
      </label>

      {selfAssessment ? (
        <fieldset className="field paddler-fieldset">
          <legend>You</legend>
          <div className="field paddler-row">
            <label className="field">
              <span>Your name</span>
              <input type="text" placeholder="Me" value={solo.name} onChange={e => setSolo(s => ({ ...s, name: e.currentTarget.value }))} />
            </label>
            {standalone ? null : (
              <label className="field">
                <span>Target</span>
                <select value={solo.target} onChange={e => setSolo(s => ({ ...s, target: e.currentTarget.value }))}>
                  {TARGETS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
            )}
          </div>
        </fieldset>
      ) : (
        <fieldset className="field paddler-fieldset">
          <legend>Paddlers</legend>
          {paddlers.map((p, i) => (
            <div className="field paddler-row" key={i}>
              <label className="field">
                <span>{`Paddler ${i + 1}`}</span>
                <input type="text" value={p.name} onChange={e => updatePaddlerName(i, e.currentTarget.value)} />
              </label>
              {standalone ? null : (
                <label className="field">
                  <span>Target</span>
                  <select value={p.target} onChange={e => updatePaddlerTarget(i, e.currentTarget.value)}>
                    {TARGETS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>
              )}
            </div>
          ))}
        </fieldset>
      )}

      {error ? <p className="error">{error}</p> : null}

      <button type="button" onClick={handleStart}>Start Assessment</button>
    </main>
  );
}
