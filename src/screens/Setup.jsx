import { useState } from 'preact/hooks';
import { loadConfig } from '../lib/skills.js';
import { createSession } from '../lib/session.js';
import rawSkills from '../data/skills.json';

const CONFIG = loadConfig(rawSkills);
const PADDLER_COUNT = 5;
const PRIVATE = import.meta.env.VITE_PRIVATE === 'true';
const TARGETS = ['L1', 'L2'];

export function Setup({ onStart }) {
  const [location, setLocation] = useState('');
  const [selfAssessment, setSelfAssessment] = useState(false);
  const [paddlers, setPaddlers] = useState(
    Array.from({ length: PADDLER_COUNT }, () => ({ name: '', target: 'L2' })),
  );
  const [solo, setSolo] = useState({ name: '', target: 'L2' });
  const [error, setError] = useState('');

  function updatePaddlerName(index, value) {
    setPaddlers(rows => rows.map((p, i) => (i === index ? { ...p, name: value } : p)));
  }
  function updatePaddlerTarget(index, value) {
    setPaddlers(rows => rows.map((p, i) => (i === index ? { ...p, target: value } : p)));
  }

  function handleStart() {
    const chosen = selfAssessment
      ? [{ name: solo.name.trim() || 'Me', target: solo.target }]
      : paddlers;
    const session = createSession({
      id: `sess-${Date.now()}`,
      createdAt: new Date().toISOString(),
      config: CONFIG,
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
            <label className="field">
              <span>Target</span>
              <select value={solo.target} onChange={e => setSolo(s => ({ ...s, target: e.currentTarget.value }))}>
                {TARGETS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
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
              <label className="field">
                <span>Target</span>
                <select value={p.target} onChange={e => updatePaddlerTarget(i, e.currentTarget.value)}>
                  {TARGETS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
            </div>
          ))}
        </fieldset>
      )}

      {error ? <p className="error">{error}</p> : null}

      <button type="button" onClick={handleStart}>Start Assessment</button>
    </main>
  );
}
