// Pure content-addressing helpers for skill-set dedup. A session's large
// {skills, scales, intro} blob is identical across all sessions of a level, so
// it is stored once (keyed by a content hash) and referenced. Any change to the
// blob yields a new hash, so older sessions keep their exact blob (frozen).

// FNV-1a 32-bit hash of the blob's JSON. Non-cryptographic; collisions across
// the few distinct level-version blobs an install sees are negligible.
export function skillSetRef(blob) {
  const json = JSON.stringify(blob);
  let h = 0x811c9dc5;
  for (let i = 0; i < json.length; i++) {
    h ^= json.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return 'sk-' + (h >>> 0).toString(16).padStart(8, '0');
}

export function blobOf(session) {
  return { skills: session.skills, scales: session.scales, intro: session.intro ?? null };
}

export function isSlim(session) {
  return !!session && !session.skills && typeof session.skillSetRef === 'string';
}

export function slimSession(session, ref) {
  const { skills, scales, intro, ...rest } = session;
  return { ...rest, skillSetRef: ref };
}

export function fattenSession(session, blob) {
  const { skillSetRef, ...rest } = session;
  return { ...rest, skills: blob.skills, scales: blob.scales, intro: blob.intro ?? null };
}

export const BUNDLE_FORMAT = 'aca-archive-v2';

// Build a bundle from in-memory (fat) sessions: slim each and collect its blob,
// deduped by content ref. An already-slim session passes through as-is.
export function bundleOf(sessions) {
  const skillSets = {};
  const slim = sessions.map(s => {
    if (!s.skills) return s;
    const blob = blobOf(s);
    const ref = skillSetRef(blob);
    skillSets[ref] = blob;
    return slimSession(s, ref);
  });
  return { format: BUNDLE_FORMAT, sessions: slim, skillSets };
}
