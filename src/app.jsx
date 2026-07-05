import { useState } from 'preact/hooks';
import { Setup } from './screens/Setup.jsx';
import { Rate } from './screens/Rate.jsx';
import { Review } from './screens/Review.jsx';
import { saveSession, loadSession, clearSession } from './lib/session.js';

export function App() {
  const [session, setSession] = useState(() => loadSession());
  const [screen, setScreen] = useState(() => (session ? 'rate' : 'setup'));

  function begin(s) {
    saveSession(s);
    setSession(s);
    setScreen('rate');
  }

  function update(s) {
    saveSession(s);
    setSession(s);
  }

  function reset() {
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
        <button type="button" className="start-over-button" onClick={reset}>Start over</button>
        <Rate
          session={session}
          onChange={update}
          onDone={() => setScreen('review')}
        />
      </div>
    );
  }

  return (
    <Review
      session={session}
      onBack={() => setScreen('rate')}
      onReset={reset}
    />
  );
}
