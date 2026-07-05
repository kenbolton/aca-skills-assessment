import { useState } from 'preact/hooks';
import { paddlerSummary } from '../lib/summary.js';
import { sessionToCsv } from '../lib/csv.js';
import { invalidResults, isSessionComplete } from '../lib/validation.js';
import { downloadPaddlerPdf } from '../lib/pdf.js';
import { syncSession } from '../lib/sync.js';

// Sync-to-server is opt-in at build time (VITE_PRIVATE=true). It is hidden
// on the public build, where visitors self-assess and export locally.
const SYNC_ENABLED = import.meta.env.VITE_PRIVATE === 'true';

function download(name, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function Review({ session, onBack, onReset }) {
  const outstanding = invalidResults(session);
  const complete = isSessionComplete(session);
  const [sync, setSync] = useState({ state: 'idle', msg: '' });

  async function doSync() {
    setSync({ state: 'busy', msg: 'Syncing…' });
    const r = await syncSession(session);
    setSync(r.ok
      ? { state: 'ok', msg: `Synced ${new Date(r.syncedAt).toLocaleTimeString()}` }
      : { state: 'err', msg: r.error });
  }

  function handleDownloadCsv() {
    download(`aca-assessment-${session.id}.csv`, sessionToCsv(session), 'text/csv');
  }

  return (
    <main className="screen review-screen">
      <h2>Review</h2>

      {outstanding.length > 0 ? (
        <p className="error review-warning">
          {outstanding.length} below-standard ratings still need feedback — go back to fix before exporting.
        </p>
      ) : !complete ? (
        <p className="hint review-note">Some core skills are still unrated.</p>
      ) : null}

      <div className="review-cards">
        {session.paddlers.map(paddler => {
          const summary = paddlerSummary(session, paddler.id);
          const scale = session.scales[summary.target] || [];
          const LANDING = {
            L2: 'Lands: Level 2',
            L1: 'Lands: Level 1',
            did_not_meet_L1: 'Did not meet Level 1',
            pending: `Pending — ${summary.pendingCount} not yet assessed`,
          };
          return (
            <div className="review-card" key={paddler.id}>
              <h3 className="review-card-name">{summary.name}</h3>
              <p className={`badge badge-landing-${summary.landing}`}>{LANDING[summary.landing]}</p>
              <p className="review-target-line">Target: {summary.target}</p>
              <p className="review-counts-line">
                {scale.map((opt, idx) => (
                  <span key={opt.value} className={opt.requiresFeedback ? 'count-danger' : ''}>
                    {idx > 0 ? '   ' : ''}{opt.label} {summary.counts[opt.value] ?? 0}
                  </span>
                ))}
                <span className="count-unrated">   Unrated {summary.unrated}</span>
              </p>

              {summary.flagged.length > 0 ? (
                <ul className="review-below-list">
                  {summary.flagged.map(item => (
                    <li key={item.skillId}>
                      <strong>{item.name}</strong> ({item.category}) — {item.ratingLabel}: {item.feedback}
                    </li>
                  ))}
                </ul>
              ) : null}

              {summary.optionalItems.length > 0 ? (
                <p className="review-optional-line">
                  Optional assessed: {summary.optionalItems.length}
                  {' — '}
                  {summary.optionalItems.map(item => item.name).join(', ')}
                </p>
              ) : null}

              <button
                type="button"
                onClick={() => downloadPaddlerPdf(session, paddler.id)}
                disabled={outstanding.length > 0}
              >
                Download {summary.name}&rsquo;s PDF
              </button>
            </div>
          );
        })}
      </div>

      <div className="review-actions">
        <button type="button" onClick={onBack}>◀ Back to rating</button>
        <button type="button" onClick={handleDownloadCsv} disabled={outstanding.length > 0}>Download CSV (all)</button>
        <button type="button" onClick={onReset}>Start over</button>
        {SYNC_ENABLED && (
          <button type="button" onClick={doSync} disabled={sync.state === 'busy' || outstanding.length > 0}>Sync to Pi</button>
        )}
      </div>

      {SYNC_ENABLED && sync.msg && <p className={sync.state === 'err' ? 'error' : ''}>{sync.msg}</p>}
    </main>
  );
}
