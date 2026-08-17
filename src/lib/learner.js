// Cross-session learner model. Derived from the on-device archive — no new
// storage. It groups sessions by paddler name (the app has no learner ids),
// then aggregates a per-skill history, current mastery (latest-wins), the growth
// since first assessment, and the working edge via the progression.
//
// Name-matching is deliberately simple: it fits a single instructor's own
// archive. Two different paddlers who share a name merge; a typo splits one. The
// UI shows the grouping so those cases stay visible.

import { skillLabel } from './skills.js';
import { nextStep } from './progression.js';
import { dueRechecks } from './recheck.js';

// Met across every scale: L1 `pass`, L2–L5 `meets`/`exceeds`.
const MET = new Set(['pass', 'meets', 'exceeds']);
// A rating that records a gap (not met, not "did not observe").
const GAP = new Set(['below', 'l1', 'no']);

export function normalizeName(name) {
  return (name || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

// key → [{ session, paddler }], one entry per paddler occurrence in a session.
function entriesByLearner(sessions) {
  const map = new Map();
  for (const s of sessions || []) {
    for (const p of s.paddlers || []) {
      const key = normalizeName(p.name);
      if (!key) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push({ session: s, paddler: p });
    }
  }
  for (const entries of map.values()) {
    entries.sort((a, b) => String(a.session.createdAt).localeCompare(String(b.session.createdAt)));
  }
  return map;
}

export function learners(sessions) {
  const map = entriesByLearner(sessions);
  const out = [];
  for (const [key, entries] of map) {
    const last = entries[entries.length - 1];
    out.push({
      key,
      name: (last.paddler.name || '').trim(),
      sessionCount: new Set(entries.map(e => e.session.id)).size,
      firstAt: entries[0].session.createdAt,
      lastAt: last.session.createdAt,
      latestTarget: last.paddler.target,
    });
  }
  return out.sort((a, b) => String(b.lastAt).localeCompare(String(a.lastAt)));
}

export function learnerRecord(sessions, key) {
  const entries = entriesByLearner(sessions).get(key);
  if (!entries || entries.length === 0) return null;

  // Per-skill history, in session order. Only recorded ratings enter the history.
  const history = new Map();
  for (const { session, paddler } of entries) {
    for (const res of session.results || []) {
      if (res.paddlerId !== paddler.id || res.rating == null) continue;
      if (!history.has(res.skillId)) history.set(res.skillId, []);
      history.get(res.skillId).push({ at: session.createdAt, target: paddler.target, rating: res.rating });
    }
  }

  const current = {};
  const newlyMet = [];
  const gaps = [];
  let metCount = 0;
  let belowCount = 0;
  const timeline = [];
  for (const [skillId, hist] of history) {
    const latest = hist[hist.length - 1].rating;
    const first = hist[0].rating;
    current[skillId] = latest;
    timeline.push({ skillId, history: hist, current: latest, currentAt: hist[hist.length - 1].at });
    if (MET.has(latest)) {
      metCount++;
      if (!MET.has(first)) newlyMet.push(skillId);
    } else if (GAP.has(latest)) {
      belowCount++;
      gaps.push(skillId);
    }
  }

  const last = entries[entries.length - 1];
  const latestTarget = last.paddler.target;
  // Working edge: the foundation-first next step among current gaps, via the
  // progression. Built from a synthetic session of the learner's current state.
  const synth = {
    paddlers: [{ id: 'L', name: last.paddler.name, target: latestTarget }],
    results: Object.entries(current).map(([skillId, rating]) => ({ paddlerId: 'L', skillId, rating })),
  };
  const next = nextStep(synth, 'L');

  return {
    key,
    name: (last.paddler.name || '').trim(),
    sessionCount: new Set(entries.map(e => e.session.id)).size,
    firstAt: entries[0].session.createdAt,
    lastAt: last.session.createdAt,
    latestTarget,
    timeline,
    current,
    newlyMet,
    gaps,
    next,
    metCount,
    belowCount,
  };
}

// One display row per learner for the Archive summary: identity, activity, the
// growth count, and the named working edge. A thin view-model over the model.
export function learnerRows(sessions, now = null) {
  const names = skillNameMap(sessions);
  return learners(sessions).map(l => {
    const rec = learnerRecord(sessions, l.key);
    const due = now ? dueRechecks(rec, now) : [];
    return {
      key: l.key,
      name: l.name,
      sessionCount: l.sessionCount,
      firstAt: l.firstAt,
      lastAt: l.lastAt,
      latestTarget: l.latestTarget,
      newlyMetCount: rec.newlyMet.length,
      belowCount: rec.belowCount,
      metCount: rec.metCount,
      nextName: rec.next ? (names[rec.next] || rec.next) : null,
      dueCount: due.length,
      dueTopName: due.length ? (names[due[0].skillId] || due[0].skillId) : null,
    };
  });
}

// skillId → display label, gathered from every session's skill list. Lets a
// view name the edge/gaps without threading skill objects through the model.
export function skillNameMap(sessions) {
  const map = {};
  for (const s of sessions || []) {
    for (const sk of s.skills || []) {
      if (sk && sk.id && !map[sk.id]) map[sk.id] = skillLabel(sk);
    }
  }
  return map;
}
