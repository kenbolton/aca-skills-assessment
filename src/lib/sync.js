// Base URL of the Pi's sync endpoint. Empty string = same origin as the app
// (works when the app is hosted on the Pi). Overridable for testing.
export const SYNC_BASE = '';

export async function syncSession(session, baseUrl = SYNC_BASE) {
  try {
    const res = await fetch(`${baseUrl}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(session),
    });
    if (!res.ok) return { ok: false, error: `Server responded ${res.status}` };
    const data = await res.json().catch(() => ({}));
    return { ok: true, syncedAt: data.syncedAt || new Date().toISOString() };
  } catch (e) {
    return { ok: false, error: 'Could not reach the Pi (are you on the tailnet?)' };
  }
}
