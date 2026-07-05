import { useState } from 'preact/hooks';
import { loadConfig, levelIds, getLevel } from '../lib/skills.js';
import { createSession } from '../lib/session.js';
import rawSkills from '../data/skills.json';

const CONFIG = loadConfig(rawSkills);
const LEVEL_IDS = levelIds(CONFIG);
const PADDLER_COUNT = 5;

export function Setup({ onStart }) {
  const [levelId, setLevelId] = useState(LEVEL_IDS[0]);
  const [location, setLocation] = useState('');
  const [paddlerNames, setPaddlerNames] = useState(
    Array.from({ length: PADDLER_COUNT }, () => ''),
  );
  const [error, setError] = useState('');

  const level = getLevel(CONFIG, levelId);

  function updatePaddlerName(index, value) {
    setPaddlerNames(names => names.map((n, i) => (i === index ? value : n)));
  }

  function handleStart() {
    const session = createSession({
      id: `sess-${Date.now()}`,
      createdAt: new Date().toISOString(),
      config: CONFIG,
      levelId,
      location,
      paddlerNames,
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

      <label className="field">
        <span>Level</span>
        <select
          value={levelId}
          onChange={e => setLevelId(e.currentTarget.value)}
        >
          {LEVEL_IDS.map(id => (
            <option key={id} value={id}>{getLevel(CONFIG, id).name}</option>
          ))}
        </select>
      </label>

      {level && level.note ? <p className="hint">{level.note}</p> : null}

      <label className="field">
        <span>Location (optional)</span>
        <input
          type="text"
          value={location}
          onChange={e => setLocation(e.currentTarget.value)}
        />
      </label>

      <fieldset className="field paddler-fieldset">
        <legend>Paddlers</legend>
        {paddlerNames.map((name, i) => (
          <label className="field" key={i}>
            <span>{`Paddler ${i + 1}`}</span>
            <input
              type="text"
              value={name}
              onChange={e => updatePaddlerName(i, e.currentTarget.value)}
            />
          </label>
        ))}
      </fieldset>

      {error ? <p className="error">{error}</p> : null}

      <button type="button" onClick={handleStart}>Start Assessment</button>
    </main>
  );
}
