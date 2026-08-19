// Top Tips: ordered coaching cues revealed progressively. Cues attach to a
// TECHNIQUE (forward stroke, wet exit…), not a per-level skill — the technique
// is universal across levels; only the conditions change. A skill→technique map
// resolves any skill to its cues, so a cue is authored once and applies at every
// level where the technique appears.
//
// Order within a technique is a developmental ladder: foundational cues first,
// hard-won conditions insight last. The progressive reveal is the gate — a
// paddler earns the later cues by mastering the earlier ones. Mastery therefore
// persists per learner keyed by TECHNIQUE (see store.js tipChecks), so mastering
// a cue at one level counts at every level.
//
// Tip ids are stable, so persisted checks survive editing or reordering.

import tipsData from '../data/top-tips.json';
import skillTechniques from '../data/skill-techniques.json';
import techniques from '../data/techniques.json';
import tipOrder from '../data/tip-order.json';

// The learner identity for tip progress: the paddler's name, normalized.
export function learnerKey(name) {
  return (name || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

// The device owner's own progress. Skills & Tips never asks who is practising —
// whoever holds the device knows their own name — and a self-assessment is by
// definition the owner, so both write here. The uppercase is load-bearing:
// `learnerKey` lowercases, so no paddler name can ever produce this key, not
// even a paddler called "@local".
export const LOCAL_LEARNER = '@LOCAL';

// The learner key for a session's tip progress, or null when tips do not apply.
// Tips are per-learner, so a multi-paddler session has no single owner.
export function sessionLearnerKey(session) {
  if (!session || (session.paddlers || []).length !== 1) return null;
  return session.selfAssessment ? LOCAL_LEARNER : learnerKey(session.paddlers[0].name);
}

// The technique a skill belongs to, or null if the skill is not mapped.
export function techniqueOf(skillId) {
  return skillTechniques[skillId] || null;
}
export function techniqueName(technique) {
  return techniques[technique] ? techniques[technique].name : technique;
}

// The reveal order is a readiness ladder, kept as a list of ids in
// tip-order.json so it can be read and rewritten as one thing. The list is
// partial on purpose: listed cues lead, in that order, and anything unlisted
// follows in file order — so adding a cue never requires touching the ladder.
export function applyOrder(cues, orderedIds) {
  const list = Array.isArray(cues) ? cues : [];
  if (!Array.isArray(orderedIds) || !orderedIds.length) return list.slice();
  const byId = new Map(list.map(c => [c && c.id, c]));
  const led = [];
  for (const id of orderedIds) {
    const cue = byId.get(id);
    if (cue) { led.push(cue); byId.delete(id); }   // delete: a repeated id cannot duplicate a cue
  }
  return led.concat(list.filter(c => byId.has(c && c.id)));
}

export function tipsFor(skillId) {
  const technique = techniqueOf(skillId);
  const t = technique ? tipsData[technique] : null;
  return Array.isArray(t) ? applyOrder(t, tipOrder[technique]) : [];
}

// The mastered tip ids for a skill's technique. Falls back to a legacy
// skill-keyed entry so older saved progress is not lost.
export function masteredIds(checks, skillId) {
  const technique = techniqueOf(skillId) || skillId;
  const arr = checks && (checks[technique] || checks[skillId]);
  return Array.isArray(arr) ? arr.slice() : [];
}

// Toggle a tip's mastered state, keyed by technique. Migrates any legacy
// skill-keyed entry to the technique key. Returns a new checks map (immutable).
export function toggleMastered(checks, skillId, tipId) {
  const technique = techniqueOf(skillId) || skillId;
  const current = (checks && (checks[technique] || checks[skillId])) || [];
  const next = current.includes(tipId)
    ? current.filter(id => id !== tipId)
    : [...current, tipId];
  const out = { ...(checks || {}), [technique]: next };
  if (skillId !== technique) delete out[skillId]; // drop the migrated legacy key
  return out;
}

// The progressive window: the next `n` unchecked tips, plus the mastered ones.
export function visibleTips(tips, mastered, n = 4) {
  const set = new Set(mastered || []);
  const unchecked = tips.filter(t => !set.has(t.id));
  return {
    visible: unchecked.slice(0, n),
    mastered: tips.filter(t => set.has(t.id)),
    total: tips.length,
    remaining: unchecked.length,
  };
}

// Validate the tips data (keyed by technique). Returns human-readable problems
// (empty = valid). Guards crowdsourced tips: unknown technique, duplicate tip id
// (which would corrupt saved progress), non-array, or empty text all fail loudly.
export function validateTopTips(data, validTechniqueKeys) {
  const errors = [];
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    errors.push('top-tips.json must be an object keyed by technique');
    return errors;
  }
  const known = validTechniqueKeys instanceof Set ? validTechniqueKeys : new Set(validTechniqueKeys || []);
  for (const [technique, tips] of Object.entries(data)) {
    if (!known.has(technique)) errors.push(`unknown technique: "${technique}"`);
    if (!Array.isArray(tips) || tips.length === 0) {
      errors.push(`"${technique}": tips must be a non-empty array`);
      continue;
    }
    const seen = new Set();
    tips.forEach((tip, i) => {
      if (!tip || typeof tip.id !== 'string' || !tip.id.trim()) {
        errors.push(`"${technique}"[${i}]: each tip needs a non-empty "id"`);
      } else if (seen.has(tip.id)) {
        errors.push(`"${technique}": duplicate tip id "${tip.id}"`);
      } else {
        seen.add(tip.id);
      }
      if (!tip || typeof tip.text !== 'string' || !tip.text.trim()) {
        errors.push(`"${technique}"[${i}]: each tip needs non-empty "text"`);
      }
      // "signal" is optional — the felt evidence the cue is landing. Present but
      // blank is a mistake, so it is rejected rather than quietly dropped.
      if (tip && tip.signal !== undefined) {
        const signals = Array.isArray(tip.signal) ? tip.signal : [tip.signal];
        if (!signals.length || signals.some(sg => typeof sg !== 'string' || !sg.trim())) {
          errors.push(`"${technique}"[${i}]: "signal" must be a non-empty string, or a non-empty list of them`);
        }
      }
    });
  }
  return errors;
}

// Validate that no retired tip id has come back. Removing a cue does not free
// its id — reusing it for a different cue silently transfers saved mastery from
// the old one to the new one. `retired` is { [technique]: string[] }.
export function validateRetiredIds(data, retired) {
  const errors = [];
  for (const [technique, ids] of Object.entries(retired || {})) {
    const live = new Set(((data || {})[technique] || []).map(t => t && t.id));
    for (const id of ids) {
      if (live.has(id)) errors.push(`"${technique}": retired tip id "${id}" is in use again`);
    }
  }
  return errors;
}

// Validate the reveal order: every key a technique that has cues, every listed
// id one of that technique's cues, and no id listed twice. Cues left out of the
// order are correct, not an error — they simply follow the listed ones.
export function validateTipOrder(order, tipsData) {
  const errors = [];
  for (const [technique, ids] of Object.entries(order || {})) {
    const cues = (tipsData || {})[technique];
    if (!Array.isArray(cues) || !cues.length) {
      errors.push(`order for "${technique}": no technique by that name has cues`);
      continue;
    }
    if (!Array.isArray(ids)) {
      errors.push(`order for "${technique}": must be a list of tip ids`);
      continue;
    }
    const known = new Set(cues.map(c => c && c.id));
    const seen = new Set();
    for (const id of ids) {
      if (!known.has(id)) errors.push(`order for "${technique}": unknown tip id "${id}"`);
      else if (seen.has(id)) errors.push(`order for "${technique}": duplicate tip id "${id}"`);
      else seen.add(id);
    }
  }
  return errors;
}

// Validate the skill→technique map: every key a real skill, every value a real
// technique.
export function validateSkillTechniques(map, validSkillIds, validTechniqueKeys) {
  const errors = [];
  const skills = validSkillIds instanceof Set ? validSkillIds : new Set(validSkillIds || []);
  const techs = validTechniqueKeys instanceof Set ? validTechniqueKeys : new Set(validTechniqueKeys || []);
  for (const [skillId, technique] of Object.entries(map || {})) {
    if (!skills.has(skillId)) errors.push(`unknown skill id: "${skillId}"`);
    if (!techs.has(technique)) errors.push(`"${skillId}" → unknown technique: "${technique}"`);
  }
  return errors;
}
