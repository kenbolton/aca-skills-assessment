function normOption(o, ctx) {
  if (!o || typeof o.value !== 'string' || typeof o.label !== 'string') throw new Error(`bad scale option in ${ctx}`);
  return { value: o.value, label: o.label, requiresFeedback: !!o.requiresFeedback, dualOnly: !!o.dualOnly };
}

export function loadConfig(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('skills.json must be an object');
  // Levels are whatever the scales define — L1/L2 (combined, with landing) for the
  // core file, or a single standalone level (L3/L4/L5) for a per-level file.
  const levels = raw.scales && typeof raw.scales === 'object' ? Object.keys(raw.scales) : [];
  if (levels.length === 0) throw new Error('scales must define at least one level');
  const scales = {};
  for (const lvl of levels) {
    const arr = raw.scales[lvl];
    if (!Array.isArray(arr) || arr.length === 0) throw new Error(`scales.${lvl} must be a non-empty array`);
    scales[lvl] = arr.map((o, i) => normOption(o, `scales.${lvl}[${i}]`));
  }
  if (!Array.isArray(raw.skills) || raw.skills.length === 0) throw new Error('skills must be a non-empty array');
  const seen = new Set();
  const skills = raw.skills.map((s, i) => {
    if (!s || typeof s.id !== 'string' || !s.id) throw new Error(`skill[${i}] missing id`);
    if (seen.has(s.id)) throw new Error(`duplicate skill id ${s.id}`);
    seen.add(s.id);
    if (!levels.includes(s.level)) throw new Error(`skill ${s.id} has invalid level ${s.level}`);
    // L3/L4/L5 skills carry only a `standard` (the full statement, used as the item);
    // L1/L2/L3-labeled skills also carry a short `name`.
    for (const f of ['category', 'standard']) if (typeof s[f] !== 'string' || !s[f]) throw new Error(`skill ${s.id} missing ${f}`);
    const out = { id: s.id, level: s.level, category: s.category, standard: s.standard, optional: !!s.optional };
    if (typeof s.name === 'string' && s.name) out.name = s.name;
    if (typeof s.competency === 'string' && s.competency) out.competency = s.competency;
    if (typeof s.l1Standard === 'string' && s.l1Standard) out.l1Standard = s.l1Standard;
    if (typeof s.exceedsStandard === 'string' && s.exceedsStandard) out.exceedsStandard = s.exceedsStandard;
    if (typeof s.belowStandard === 'string' && s.belowStandard) out.belowStandard = s.belowStandard;
    return out;
  });
  const config = { scales, skills };
  const intro = normIntro(raw.intro);
  if (intro) config.intro = intro;
  return config;
}

// The optional per-assessment intro page: a title and a list of sections, each a
// heading with body prose and/or a bulleted list. Malformed pieces are dropped
// rather than throwing, so a partial intro still renders what it can.
function normIntro(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.sections)) return null;
  const sections = [];
  for (const s of raw.sections) {
    if (!s || typeof s.heading !== 'string' || !s.heading) continue;
    const sec = { heading: s.heading };
    if (typeof s.body === 'string' && s.body) sec.body = s.body;
    if (Array.isArray(s.items)) {
      const items = s.items.filter(x => typeof x === 'string' && x);
      if (items.length) sec.items = items;
    }
    // An optional external reference link (e.g. ACA training guidance).
    if (s.link && typeof s.link.href === 'string' && /^https?:\/\//.test(s.link.href) && typeof s.link.label === 'string' && s.link.label) {
      sec.link = { href: s.link.href, label: s.link.label };
    }
    if (sec.body || sec.items || sec.link) sections.push(sec);
  }
  if (sections.length === 0) return null;
  const intro = { sections };
  if (typeof raw.title === 'string' && raw.title) intro.title = raw.title;
  return intro;
}

// The display label for a skill: its short name when it has one (L1/L2/L3),
// otherwise the full standard statement (L4/L5, which have no short names).
export function skillLabel(skill) {
  return (skill && (skill.name || skill.standard)) || '';
}

export function allSkills(config) {
  return config.skills;
}

export function optionsForSkill(config, skill) {
  const scale = config.scales[skill.level] || [];
  if (skill.level === 'L2' && !skill.l1Standard) return scale.filter(o => !o.dualOnly);
  return scale;
}
