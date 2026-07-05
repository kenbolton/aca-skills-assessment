function normalizeScale(scale, levelId) {
  if (!Array.isArray(scale) || scale.length === 0) {
    throw new Error(`level ${levelId} missing scale`);
  }
  return scale.map((opt, i) => {
    if (!opt || typeof opt.value !== 'string' || !opt.value) {
      throw new Error(`level ${levelId} scale[${i}] missing value`);
    }
    if (typeof opt.label !== 'string' || !opt.label) {
      throw new Error(`level ${levelId} scale[${i}] missing label`);
    }
    return { value: opt.value, label: opt.label, requiresFeedback: Boolean(opt.requiresFeedback) };
  });
}

function normalizeSkill(skill, levelId, categoryName, seenIds) {
  if (!skill || typeof skill.id !== 'string' || !skill.id) {
    throw new Error(`level ${levelId} category "${categoryName}" has a skill missing id`);
  }
  if (typeof skill.name !== 'string' || !skill.name) {
    throw new Error(`level ${levelId} skill ${skill.id} missing name`);
  }
  if (typeof skill.standard !== 'string' || !skill.standard) {
    throw new Error(`level ${levelId} skill ${skill.id} missing standard`);
  }
  if (seenIds.has(skill.id)) {
    throw new Error(`duplicate skill id "${skill.id}" across config`);
  }
  seenIds.add(skill.id);
  return { id: skill.id, name: skill.name, standard: skill.standard, optional: Boolean(skill.optional) };
}

function normalizeCategory(category, levelId, seenIds) {
  if (!category || typeof category.name !== 'string' || !category.name) {
    throw new Error(`level ${levelId} has a category missing name`);
  }
  if (!Array.isArray(category.skills)) {
    throw new Error(`level ${levelId} category "${category.name}" missing skills array`);
  }
  return {
    name: category.name,
    competency: typeof category.competency === 'string' ? category.competency : '',
    skills: category.skills.map(s => normalizeSkill(s, levelId, category.name, seenIds)),
  };
}

function normalizeLevel(level, seenIds) {
  if (!level || typeof level.id !== 'string' || !level.id) {
    throw new Error('level missing id');
  }
  if (typeof level.name !== 'string' || !level.name) {
    throw new Error(`level ${level.id} missing name`);
  }
  if (!Array.isArray(level.categories)) {
    throw new Error(`level ${level.id} missing categories array`);
  }
  return {
    id: level.id,
    name: level.name,
    note: typeof level.note === 'string' ? level.note : '',
    scale: normalizeScale(level.scale, level.id),
    categories: level.categories.map(c => normalizeCategory(c, level.id, seenIds)),
  };
}

export function loadConfig(raw) {
  if (!raw || !Array.isArray(raw.levels) || raw.levels.length === 0) {
    throw new Error('config.levels must be a non-empty array');
  }
  const seenIds = new Set();
  return { levels: raw.levels.map(l => normalizeLevel(l, seenIds)) };
}

export function levelIds(config) {
  return config.levels.map(l => l.id);
}

export function getLevel(config, levelId) {
  return config.levels.find(l => l.id === levelId);
}

export function scaleForLevel(config, levelId) {
  const level = getLevel(config, levelId);
  return level ? level.scale : [];
}

export function skillsForLevel(config, levelId) {
  const level = getLevel(config, levelId);
  if (!level) return [];
  const flat = [];
  for (const category of level.categories) {
    for (const skill of category.skills) {
      flat.push({ ...skill, category: category.name, competency: category.competency });
    }
  }
  return flat;
}
