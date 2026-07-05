// One-shot (idempotent): enrich L2 skills in src/data/skills.json with an
// `exceedsStandard` string sourced verbatim from the official ACA L2
// Assessors Guide org file. Never touches L1 skills. Never invents text —
// if no confident match is found, the skill is left without exceedsStandard
// and reported.
import { readFile, writeFile } from 'node:fs/promises';

const ORG_PATH = '/Users/ken/Documents/ACA/2024/Lessons/Assesors Guide Level 2.org';
const JSON_PATH = new URL('../src/data/skills.json', import.meta.url).pathname;

// json category -> org "** " category heading text
const CATEGORY_MAP = {
  'Core: Strokes': 'Core: Strokes',
  'Core: Maneuvers': 'Core: Maneuvers',
  'Core: Edging and Support': 'Core: Edging and Support',
  'Core: Rescues and Towing': 'Core: Rescues and Towing',
  'Core: Awareness and Seamanship': 'Core: Awareness and Seamanship',
  'Core: Incident Prevention and Management': 'Core: Incident Prevention and Management',
  'Core: Trip Planning and Navigation': 'Core: Trip Planning and Navigation',
  'Venue (Developing): Currents': 'Venue Specific: Currents',
  'Venue (Developing): Wind and Waves': 'Venue Specific: Wind and Waves',
  'Venue (Developing): Rocky Shorelines': 'Venue Specific: Rocky Shorelines',
};

// json skill name -> org skill name, for names too differently worded for
// normalize() to bridge on its own.
const NAME_ALIASES = {
  'Move a Capsized Kayak to Shore': 'Move a kayak that has capsized to shore',
};

function normalize(str) {
  return str
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ') // drop parentheticals
    .replace(/&/g, ' and ')
    .replace(/[’'"]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractHeadingText(line, prefixLen) {
  let text = line.slice(prefixLen).trim();
  const linkMatch = text.match(/^\[\[file:[^\]]*\]\[(.*)\]\]$/);
  if (linkMatch) text = linkMatch[1];
  return text;
}

// --- Parse the org file into { category, name, descriptor, exceeds }[] ---
function parseOrgExceeds(orgText) {
  const lines = orgText.split('\n');
  let currentCategory = null;
  let currentSkill = null;
  const orgSkills = [];

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (line.startsWith('** ')) {
      currentCategory = extractHeadingText(line, 3);
      currentSkill = null;
    } else if (line.startsWith('*** ')) {
      const text = extractHeadingText(line, 4);
      const idx = text.indexOf(':');
      const name = idx === -1 ? text.trim() : text.slice(0, idx).trim();
      const descriptor = idx === -1 ? '' : text.slice(idx + 1).trim();
      currentSkill = { category: currentCategory, name, descriptor, exceeds: null, used: false };
    } else if (currentSkill && currentSkill.exceeds === null) {
      const m = line.match(/^-\s*~Exceeds~:\s*(.*)$/);
      if (m) {
        currentSkill.exceeds = m[1].trim();
        orgSkills.push(currentSkill);
      }
    }
  }
  return orgSkills;
}

function findMatch(skill, orgSkills) {
  const orgCategory = CATEGORY_MAP[skill.category];
  const candidates = orgCategory ? orgSkills.filter(o => o.category === orgCategory) : [];

  // Special case: "Trip Planning" repeats as an org skill name within one
  // category; disambiguate by descriptor content.
  if (skill.name.startsWith('Trip Planning')) {
    const wantsFlow = /direction of flow/i.test(skill.name);
    return candidates.find(o => normalize(o.name) === 'trip planning' &&
      (wantsFlow ? /direction of flow/i.test(o.descriptor) : /wind.*wave.*current/i.test(o.descriptor)));
  }

  // Venue skills encode "<Category> — <Sub Name>"; match on the sub name
  // within the category already filtered above.
  let searchName = skill.name;
  const dashIdx = skill.name.indexOf('—'); // em dash
  if (dashIdx !== -1) searchName = skill.name.slice(dashIdx + 1).trim();

  const targetNorm = normalize(searchName);
  let match = candidates.find(o => normalize(o.name) === targetNorm);
  if (match) return match;

  const alias = NAME_ALIASES[skill.name];
  if (alias) {
    const aliasNorm = normalize(alias);
    match = candidates.find(o => normalize(o.name) === aliasNorm);
    if (match) return match;
  }

  return null;
}

// Rebuild a skill object with exceedsStandard placed right after `standard`.
function withExceeds(skill, exceedsText) {
  const next = {};
  let inserted = false;
  for (const key of Object.keys(skill)) {
    if (key === 'exceedsStandard') continue; // drop stale position; reinsert below
    next[key] = skill[key];
    if (key === 'standard') {
      next.exceedsStandard = exceedsText;
      inserted = true;
    }
  }
  if (!inserted) next.exceedsStandard = exceedsText;
  return next;
}

const [orgText, skillsRaw] = await Promise.all([
  readFile(ORG_PATH, 'utf8'),
  readFile(JSON_PATH, 'utf8'),
]);

const orgSkills = parseOrgExceeds(orgText);
const data = JSON.parse(skillsRaw);

const unmatched = [];
let matchedCount = 0;
const l2Skills = data.skills.filter(s => s.level === 'L2');

data.skills = data.skills.map(skill => {
  if (skill.level !== 'L2') return skill;
  const match = findMatch(skill, orgSkills);
  if (!match) {
    unmatched.push(skill);
    return skill;
  }
  match.used = true;
  matchedCount += 1;
  return withExceeds(skill, match.exceeds);
});

await writeFile(JSON_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8');

const unusedOrgEntries = orgSkills.filter(o => !o.used);

console.log(`L2 skills: ${l2Skills.length}`);
console.log(`With exceedsStandard: ${matchedCount}`);
console.log('Left WITHOUT exceedsStandard:');
for (const s of unmatched) {
  console.log(`  - ${s.name} (${s.category}), optional=${!!s.optional}`);
}
console.log('Org "Exceeds" entries that matched no json skill:');
for (const o of unusedOrgEntries) {
  console.log(`  - [${o.category}] ${o.name}`);
}
