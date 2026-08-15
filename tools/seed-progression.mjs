#!/usr/bin/env node
// Bootstrap generator for the progression data layer (all levels, L1–L5).
//
// It reads the public skill lists and produces a first-approximation
// progression: one strand per core category (namespaced by level, because
// L4 and L5 reuse category names), skills staged by their order within the
// category, and NO prerequisites.
//
// Empty prerequisites are the honest default: most paddling skills are parallel
// competencies, not a dependency chain. Real prerequisites are added by hand,
// per level, after the bootstrap. See the L2 model in progression.json.
//
// After the first bootstrap, `src/data/progression.json` is the source of
// truth. `--write` refuses to overwrite it unless `--force` is also given, so a
// re-run never discards hand-refined prerequisites by accident.
//
// Usage:
//   node tools/seed-progression.mjs                  # print draft to stdout
//   node tools/seed-progression.mjs --write          # write, unless the file exists
//   node tools/seed-progression.mjs --write --force  # overwrite the existing file

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'src/data');
const OUT_PATH = path.join(DATA, 'progression.json');
// L1 and L2 share one file; L3–L5 have one each.
const SOURCES = ['skills.json', 'skills-l3.json', 'skills-l4.json', 'skills-l5.json'];
const LEVELS = ['L1', 'L2', 'L3', 'L4', 'L5'];

// A kebab-case slug of the category text.
function slug(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function seedProgression(allSkills) {
  const core = allSkills.filter(s => !s.optional && LEVELS.includes(s.level));
  const byLevel = {};
  for (const s of core) (byLevel[s.level] ||= []).push(s);

  const strands = {};
  const skills = {};
  const stageCount = {};
  let order = 0;

  for (const level of LEVELS) {
    for (const s of byLevel[level] || []) {
      // Namespace the strand by level so L4/L5 shared category names stay apart.
      const key = `${level.toLowerCase()}-${slug(s.category)}`;
      if (!strands[key]) {
        strands[key] = { name: s.category, order: ++order };
        stageCount[key] = 0;
      }
      const stage = ++stageCount[key];
      skills[s.id] = { strand: key, stage, prereqs: [] };
    }
  }

  return { version: 1, strands, skills };
}

function readAllSkills() {
  const all = [];
  for (const f of SOURCES) {
    const parsed = JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));
    for (const s of parsed.skills || []) all.push(s);
  }
  return all;
}

function main() {
  const progression = seedProgression(readAllSkills());
  const json = JSON.stringify(progression, null, 2) + '\n';
  if (!process.argv.includes('--write')) {
    process.stdout.write(json);
    return;
  }
  // The committed file is refined by hand after the first bootstrap. Refuse to
  // clobber an existing one unless the caller is explicit, so a stray --write
  // never silently discards that work.
  const rel = path.relative(ROOT, OUT_PATH);
  if (fs.existsSync(OUT_PATH) && !process.argv.includes('--force')) {
    process.stderr.write(`refusing to overwrite ${rel} (hand-refined). Re-run with --force to replace it.\n`);
    process.exitCode = 1;
    return;
  }
  fs.writeFileSync(OUT_PATH, json);
  process.stderr.write(`wrote ${rel}\n`);
}

// Run only when invoked directly, so tests can import `seedProgression`.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
