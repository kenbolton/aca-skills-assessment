import { useState } from 'preact/hooks';
import { Setup } from './screens/Setup.jsx';
import { Rate } from './screens/Rate.jsx';
import { Review } from './screens/Review.jsx';
import { saveSession, loadSession, clearSession } from './lib/session.js';
import { SyncButton } from './components/SyncButton.jsx';

export function App() {
  const [session, setSession] = useState(() => loadSession());
  const [screen, setScreen] = useState(() => (session ? 'rate' : 'setup'));
  const [focusSkillId, setFocusSkillId] = useState(null);

  function begin(s) {
    // A newly started assessment must open at its first page (intro/first
    // skill), never at a skill left focused by a prior session's "Go to skill".
    setFocusSkillId(null);
    saveSession(s);
    setSession(s);
    setScreen('rate');
  }

  function update(s) {
    saveSession(s);
    setSession(s);
  }

  function reset() {
    if (typeof window !== 'undefined' &&
        !window.confirm('Start over? This clears the current assessment and cannot be undone.')) {
      return;
    }
    clearSession();
    setSession(null);
    setScreen('setup');
  }

  if (screen === 'setup' || !session) {
    return <Setup onStart={begin} />;
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
