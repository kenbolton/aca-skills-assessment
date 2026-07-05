import { join, resolve } from 'node:path';

export function safeSessionPath(sessionsDir, id) {
  const safe = String(id).replace(/[^a-z0-9_-]/gi, '_');
  if (!safe || /^_+$/.test(safe)) return null;
  const root = resolve(sessionsDir);
  const full = resolve(join(root, `${safe}.json`));
  if (full !== join(root, `${safe}.json`)) return null; // no normalization surprises
  if (!full.startsWith(root + '/')) return null;
  return full;
}
