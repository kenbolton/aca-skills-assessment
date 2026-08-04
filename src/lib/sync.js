import { bundleOf } from './skillset.js';

// Base URL of the sync endpoint. Empty string = same origin as the app (works
// when that same server serves the build). Overridable for testing. The server
// is any always-on machine that runs Node — a Raspberry Pi is one option, not a
// requirement. Nothing here assumes the hardware.
export const SYNC_BASE = '';

export async function syncSession(session, baseUrl = SYNC_BASE) {
  try {
    const res = await fetch(`${baseUrl}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bundleOf([session])),
    });
    if (!res.ok) return { ok: false, error: `Server responded ${res.status}` };
    const data = await res.json().catch(() => ({}));
    return { ok: true, syncedAt: data.syncedAt || new Date().toISOString() };
  } catch (e) {
    return { ok: false, error: 'Could not reach the server (are you on the same private network?)' };
  }
}
