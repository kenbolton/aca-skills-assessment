import { useState } from 'preact/hooks';
import { syncSession } from '../lib/sync.js';

// Sync-to-server is opt-in at build time (VITE_PRIVATE=true). It is hidden on
// the public build, where visitors self-assess and export locally. Sync is not
// gated on completeness — the instructor can save progress to the Pi from any
// page mid-assessment.
const SYNC_ENABLED = import.meta.env.VITE_PRIVATE === 'true';

export function SyncButton({ session, className }) {
  const [sync, setSync] = useState({ state: 'idle', msg: '' });
  if (!SYNC_ENABLED) return null;

  async function doSync() {
    setSync({ state: 'busy', msg: 'Syncing…' });
    const r = await syncSession(session);
    setSync(r.ok
      ? { state: 'ok', msg: `Synced ${new Date(r.syncedAt).toLocaleTimeString()}` }
      : { state: 'err', msg: r.error });
  }

  return (
    <span className={`sync-control${className ? ` ${className}` : ''}`}>
      <button type="button" onClick={doSync} disabled={sync.state === 'busy'}>Sync to Pi</button>
      {sync.msg ? <span className={`sync-msg${sync.state === 'err' ? ' error' : ''}`}>{sync.msg}</span> : null}
    </span>
  );
}
