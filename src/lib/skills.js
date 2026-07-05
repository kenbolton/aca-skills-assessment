const LEVELS = ['L1', 'L2'];

function normOption(o, ctx) {
  if (!o || typeof o.value !== 'string' || typeof o.label !== 'string') throw new Error(`bad scale option in ${ctx}`);
  return { value: o.value, label: o.label, requiresFeedback: !!o.requiresFeedback, dualOnly: !!o.dualOnly };
}

export function loadConfig(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('skills.json must be an object');
  const scales = {};
  for (const lvl of LEVELS) {
    const arr = raw.scales && raw.scales[lvl];
    if (!Array.isArray(arr) || arr.length === 0) throw new Error(`scales.${lvl} must be a non-empty array`);
    scales[lvl] = arr.map((o, i) => normOption(o, `scales.${lvl}[${i}]`));
  }
  if (!Array.isArray(raw.skills) || raw.skills.length === 0) throw new Error('skills must be a non-empty array');
  const seen = new Set();
  const skills = raw.skills.map((s, i) => {
    if (!s || typeof s.id !== 'string' || !s.id) throw new Error(`skill[${i}] missing id`);
    if (seen.has(s.id)) throw new Error(`duplicate skill id ${s.id}`);
    seen.add(s.id);
    if (!LEVELS.includes(s.level)) throw new Error(`skill ${s.id} has invalid level ${s.level}`);
    for (const f of ['category', 'name', 'standard']) if (typeof s[f] !== 'string' || !s[f]) throw new Error(`skill ${s.id} missing ${f}`);
    const out = { id: s.id, level: s.level, category: s.category, name: s.name, standard: s.standard, optional: !!s.optional };
    if (typeof s.l1Standard === 'string' && s.l1Standard) out.l1Standard = s.l1Standard;
    return out;
  });
  return { scales, skills };
}

export function allSkills(config) {
  return config.skills;
}

export function optionsForSkill(config, skill) {
  const scale = config.scales[skill.level] || [];
  if (skill.level === 'L2' && !skill.l1Standard) return scale.filter(o => !o.dualOnly);
  return scale;
}
