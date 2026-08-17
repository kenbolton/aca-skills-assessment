// Spaced re-check schedule. Deliberate practice spaces retrieval: a weak skill
// is re-checked soon, a mastered one at growing intervals. Derived from a
// learner's per-skill history — no new storage. `now` is injected, so the logic
// stays pure and testable.

const MET = new Set(['pass', 'meets', 'exceeds']);
const GAP = new Set(['below', 'l1', 'no']);
const DAY = 86400000;

// Days until the next re-check, from the skill's rating history. A gap is due
// soon; mastery earns longer intervals as it holds. Null when not schedulable.
export function recheckIntervalDays(history) {
  if (!history || history.length === 0) return null;
  const latest = history[history.length - 1].rating;
  if (latest === 'dno') return null;
  if (GAP.has(latest)) return 7;
  if (latest === 'exceeds') return 90;
  // meets or pass: interval grows with the consecutive-met streak.
  let streak = 0;
  for (let i = history.length - 1; i >= 0 && MET.has(history[i].rating); i--) streak++;
  return streak >= 2 ? 42 : 14;
}

// The skills whose re-check interval has elapsed as of `now`, most overdue first.
export function dueRechecks(record, now) {
  if (!record || !record.timeline) return [];
  const nowMs = (now instanceof Date ? now : new Date(now)).getTime();
  const out = [];
  for (const t of record.timeline) {
    const days = recheckIntervalDays(t.history);
    if (days == null) continue;
    const dueMs = new Date(t.currentAt).getTime() + days * DAY;
    if (nowMs >= dueMs) {
      out.push({
        skillId: t.skillId,
        lastAt: t.currentAt,
        dueAt: new Date(dueMs).toISOString(),
        overdueDays: Math.floor((nowMs - dueMs) / DAY),
      });
    }
  }
  out.sort((a, b) => b.overdueDays - a.overdueDays);
  return out;
}
