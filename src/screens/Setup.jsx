import { useState } from 'preact/hooks';
import { loadConfig } from '../lib/skills.js';
import { createSession } from '../lib/session.js';
import { countEvent } from '../lib/metrics.js';
import { startEventPath } from '../lib/start-metric.js';
import { Attribution } from '../components/Attribution.jsx';
import { PrivacyStatement } from '../components/PrivacyStatement.jsx';
import rawSkills from '../data/skills.json';
import rawL3 from '../data/skills-l3.json';
import rawL4 from '../data/skills-l4.json';
import rawL5 from '../data/skills-l5.json';
import { BEAUFORT, CURRENT_LEVELS, WAVE_HEIGHTS, beaufortSpec } from '../data/conditions.js';

// One config per assessment mode. 'L1/L2' keeps the combined per-paddler-target
// behavior (with cross-level landing); L3/L4/L5 are standalone single-level configs.
const CONFIGS = {
  'L1/L2': loadConfig(rawSkills),
  L3: loadConfig(rawL3),
  L4: loadConfig(rawL4),
  L5: loadConfig(rawL5),
};
const LEVEL_OPTIONS = [
  { key: 'L1/L2', label: 'L1 / L2 — Essentials of Kayak Touring' },
  { key: 'L3', label: 'L3 — Coastal Kayaking' },
  { key: 'L4', label: 'L4 — Open Water Coastal Kayaking' },
  { key: 'L5', label: 'L5 — Advanced Open Water Coastal Kayaking' },
];
const PADDLER_COUNT = 5;
const TARGETS = ['L1', 'L2'];

const CONDITION_SELECTS = [
  { key: 'wind', label: 'Wind', options: BEAUFORT.map(b => b.value), spec: true },
  { key: 'waves', label: 'Waves', options: WAVE_HEIGHTS },
  { key: 'surf', label: 'Surf', options: WAVE_HEIGHTS },
  { key: 'current', label: 'Current', options: CURRENT_LEVELS },
];

export function Setup({ onStart, onArchive }) {
  const [location, setLocation] = useState('');
  const [conditions, setConditions] = useState({ wind: '', waves: '', surf: '', current: '' });
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
      conditions,
      paddlers: chosen,
      selfAssessment,
    });
    if (session.paddlers.length === 0) {
      setError('Add at least one paddler name.');
      return;
    }
    setError('');
    countEvent(startEventPath(level, selfAssessment), 'Assessment started');
    onStart(session);
  }

  return (
    <main className="screen setup-screen">
      <h1>New Assessment</h1>
      <p><button type="button" className="linklike" onClick={onArchive}>Past assessments &rarr;</button></p>

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

      <fieldset className="field conditions-fieldset">
        <legend>Observed conditions (optional)</legend>
        <div className="conditions-grid">
          {CONDITION_SELECTS.map(f => (
            <label className="field" key={f.key}>
              <span>{f.label}</span>
              <select
                value={conditions[f.key]}
                onChange={e => setConditions(c => ({ ...c, [f.key]: e.currentTarget.value }))}
              >
                <option value="">— not recorded</option>
                {f.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
              {f.spec && conditions[f.key] ? (
                <span className="condition-spec">{beaufortSpec(conditions[f.key])}</span>
              ) : null}
            </label>
          ))}
        </div>
      </fieldset>

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

      <PrivacyStatement />
      <Attribution />
    </main>
  );
}
