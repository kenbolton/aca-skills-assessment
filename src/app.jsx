import { useState, useEffect } from 'preact/hooks';
import { Setup } from './screens/Setup.jsx';
import { Rate } from './screens/Rate.jsx';
import { Review } from './screens/Review.jsx';
import { Archive } from './screens/Archive.jsx';
import { initStore, getSession, putSession, getCurrentId, setCurrentId } from './lib/store.js';
import { SyncButton } from './components/SyncButton.jsx';

export function App() {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState(null);
  const [screen, setScreen] = useState('setup');
  const [focusSkillId, setFocusSkillId] = useState(null);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        await initStore();
        const id = getCurrentId();
        const s = id ? await getSession(id) : null;
        if (!live) return;
        if (s) { setSession(s); setScreen('rate'); }
      } finally {
        if (live) setReady(true);
      }
    })();
    return () => { live = false; };
  }, []);

  function begin(s) {
    setFocusSkillId(null);
    putSession(s).catch(err => console.error('save failed', err));            // fire-and-forget upsert
    setCurrentId(s.id);
    setSession(s);
    setScreen('rate');
  }

  function update(s) {
    putSession(s).catch(err => console.error('autosave failed', err));            // autosave; never blocks the tap
    setSession(s);
  }

  function reset() {
    // "Start over" leaves the current assessment in the archive (it is autosaved
    // on every tap) and just returns to a fresh Setup — it is not destructive.
    if (typeof window !== 'undefined' &&
        !window.confirm('Start a new assessment? The current one stays in Past assessments.')) {
      return;
    }
    setFocusSkillId(null);
    setCurrentId(null);
    setSession(null);
    setScreen('setup');
  }

  async function resume(id) {
    const s = await getSession(id);
    if (!s) return;
    setFocusSkillId(null);
    setCurrentId(id);
    setSession(s);
    setScreen('review');
  }

  if (!ready) {
    return <main className="screen"><p className="hint">Loading…</p></main>;
  }

  if (screen === 'archive') {
    return <Archive onResume={resume} onBack={() => setScreen('setup')} />;
  }

  if (screen === 'setup' || !session) {
    return <Setup onStart={begin} onArchive={() => setScreen('archive')} />;
  }

  if (screen === 'rate') {
    return (
      <div className="rate-shell">
        <div className="rate-shell-bar">
          <button type="button" className="start-over-button" onClick={reset}>Start over</button>
          <SyncButton session={session} />
        </div>
        <Rate
          session={session}
          focusSkillId={focusSkillId}
          onChange={update}
          onDone={() => setScreen('review')}
        />
      </div>
    );
  }

  return (
    <Review
      session={session}
      onChange={update}
      onBack={() => { setFocusSkillId(null); setScreen('rate'); }}
      onReset={reset}
      onEditSkill={(skillId) => { setFocusSkillId(skillId); setScreen('rate'); }}
    />
  );
}
