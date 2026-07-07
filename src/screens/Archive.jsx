// src/screens/Archive.jsx
// On-device management of the assessment archive: list, resume, delete,
// per-session export, whole-archive export, and import (single or bundle).
import { useEffect, useState } from 'preact/hooks';
import { listSummaries, getSession, deleteSession, exportAll, importSessions } from '../lib/store.js';
import { sessionToCsv } from '../lib/csv.js';

function download(name, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

export function Archive({ onResume, onBack }) {
  const [rows, setRows] = useState(null);
  const [msg, setMsg] = useState('');

  async function refresh() { setRows(await listSummaries()); }
  useEffect(() => { refresh(); }, []);

  async function exportJson(id) {
    const s = await getSession(id);
    if (s) download(`aca-assessment-${id}.json`, JSON.stringify(s, null, 2), 'application/json');
  }
  async function exportCsv(id) {
    const s = await getSession(id);
    if (s) download(`aca-assessment-${id}.csv`, sessionToCsv(s), 'text/csv');
  }
  async function remove(id, names) {
    if (!window.confirm(`Delete this assessment (${names})? This cannot be undone.`)) return;
    await deleteSession(id); refresh();
  }
  async function exportEverything() {
    const all = await exportAll();
    const date = (all[0] && String(all[0].createdAt).slice(0, 10)) || 'export';
    download(`aca-archive-${date}.json`, JSON.stringify(all, null, 2), 'application/json');
  }
  async function importFile(e) {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      const n = await importSessions(data);
      setMsg(`Imported ${n} assessment${n === 1 ? '' : 's'}.`);
      refresh();
    } catch { setMsg('That file is not a valid assessment JSON.'); }
    e.target.value = '';
  }

  return (
    <main className="screen archive-screen">
      <div className="archive-bar">
        <button type="button" onClick={onBack}>◀ Back</button>
        <button type="button" onClick={exportEverything} disabled={!rows || !rows.length}>Export all</button>
        <label className="archive-import">Import
          <input type="file" accept="application/json,.json" onChange={importFile} />
        </label>
      </div>
      <h2>Past assessments</h2>
      {msg ? <p className="hint">{msg}</p> : null}
      {rows === null ? <p className="hint">Loading…</p>
        : rows.length === 0 ? <p className="hint">No saved assessments yet.</p>
        : (
        <ul className="archive-list">
          {rows.map(r => {
            const names = (r.participants || []).join(', ');
            const level = r.level || (r.targets && r.targets.length ? 'L1/L2' : '');
            return (
              <li className="archive-row" key={r.id}>
                <div className="archive-meta">
                  <strong>{new Date(r.createdAt).toLocaleString()}</strong>
                  <span>{level}{r.selfAssessment ? ' · self' : ''} · {names}</span>
                  <span className="archive-progress">{r.counts.rated}/{r.counts.core} rated</span>
                </div>
                <div className="archive-actions">
                  <button type="button" onClick={() => onResume(r.id)}>Resume</button>
                  <button type="button" onClick={() => exportJson(r.id)}>JSON</button>
                  <button type="button" onClick={() => exportCsv(r.id)}>CSV</button>
                  <button type="button" className="archive-del" onClick={() => remove(r.id, names)}>Delete</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
