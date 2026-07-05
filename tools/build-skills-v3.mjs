// One-shot: transform the v2 skills.json ({levels:[...]}) into v3
// ({scales, skills[]}). Flattens both levels into one progressively-ordered
// list, tags each skill with its level, adds the L2 'l1' scale option, and
// attaches l1Standard (the referenced L1 skill's standard) to dual L2 skills.
import { readFile, writeFile } from 'node:fs/promises';
const PATH = new URL('../src/data/skills.json', import.meta.url).pathname;
const v2 = JSON.parse(await readFile(PATH, 'utf8'));

const L1 = v2.levels.find(l => l.id === 'L1');
const L2 = v2.levels.find(l => l.id === 'L2');

// scales: L1 unchanged; L2 gains the dual-only 'l1' tier after 'below'.
const scales = {
  L1: L1.scale.map(o => ({ ...o, requiresFeedback: !!o.requiresFeedback })),
  L2: [
    { value: 'below', label: 'Below', requiresFeedback: true },
    { value: 'l1', label: 'L1', requiresFeedback: true, dualOnly: true },
    { value: 'meets', label: 'Meets', requiresFeedback: false },
    { value: 'exceeds', label: 'Exceeds', requiresFeedback: false },
  ],
};

// dual L2 skill id -> equivalent L1 skill id (its standard becomes l1Standard).
const DUAL_MAP = {
  'l2-forward': 'l1-forward-straight', 'l2-reverse': 'l1-reverse', 'l2-stopping': 'l1-stop',
  'l2-draw': 'l1-draw', 'l2-sweep': 'l1-turn-stationary', 'l2-turning-move': 'l1-turn-moving',
  'l2-rotate-360': 'l1-turn-stationary', 'l2-wet-exit': 'l1-wet-exit',
  'l2-assisted-rescue': 'l1-reentry', 'l2-self-rescue': 'l1-reentry',
  'l2-swim-rescue': 'l1-swim-with-gear', 'l2-swimmer-tows': 'l1-swimmer-tow',
  'l2-move-capsized': 'l1-bulldozing', 'l2-launch-land': 'l1-launch',
  'l2-lift-carry': 'l1-lift-carry', 'l2-secure-rack': 'l1-secure-transport',
  'l2-float-plan': 'l1-float-plan', 'l2-cold-water-shock': 'l1-cold-water',
  'l2-thermal': 'l1-cold-water', 'l2-equipment': 'l1-equipment',
  'l2-nautical-rules': 'l1-nav-rules', 'l2-awareness': 'l1-group-awareness',
  'l2-signaling': 'l1-signals', 'l2-forecasts': 'l1-weather-hazards',
};

// index every skill by id (for l1Standard lookup) and by (level,category).
const byId = {};
const catSkills = { L1: {}, L2: {} };
for (const [lvl, L] of [['L1', L1], ['L2', L2]]) {
  for (const c of L.categories) {
    catSkills[lvl][c.name] = c.skills;
    for (const s of c.skills) { s.category = c.name; byId[s.id] = s; }
  }
}

// interleaved dry -> wet themes; within each, L1 categories then L2 categories.
const THEMES = [
  { L1: ['Preparing to Depart'], L2: ['Core: Incident Prevention and Management'] },
  { L1: ['Maneuvers & Strokes'], L2: ['Core: Strokes', 'Core: Maneuvers', 'Core: Edging and Support'] },
  { L1: ['Technical Knowledge'], L2: ['Core: Awareness and Seamanship', 'Core: Trip Planning and Navigation'] },
  { L1: ['Safety and Rescue', 'Swimming and Wading Skills'], L2: [] },
  { L1: ['Kayak-based Rescues'], L2: ['Core: Rescues and Towing'] },
  { L1: [], L2: ['Venue (Developing): Currents', 'Venue (Developing): Wind and Waves', 'Venue (Developing): Rocky Shorelines'] },
];

const skills = [];
const emit = (lvl, s) => {
  const out = { id: s.id, level: lvl, category: s.category, name: s.name,
    standard: s.standard, optional: !!s.optional };
  if (lvl === 'L2' && DUAL_MAP[s.id] && byId[DUAL_MAP[s.id]]) out.l1Standard = byId[DUAL_MAP[s.id]].standard;
  skills.push(out);
};
for (const t of THEMES) {
  for (const cat of t.L1) for (const s of (catSkills.L1[cat] || [])) emit('L1', s);
  for (const cat of t.L2) for (const s of (catSkills.L2[cat] || [])) emit('L2', s);
}

await writeFile(PATH, JSON.stringify({ scales, skills }, null, 2) + '\n');
console.log(`v3 skills.json: ${skills.length} skills (${skills.filter(s => s.level === 'L1').length} L1, ${skills.filter(s => s.level === 'L2').length} L2, ${skills.filter(s => s.l1Standard).length} dual)`);
