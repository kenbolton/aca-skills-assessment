#!/usr/bin/env node
// Bootstrap generator for the L2 progression data layer.
//
// It reads the public skill list and produces a first-approximation
// progression: one strand per L2 core category, skills staged by their order
// within the category, and a linear prerequisite chain inside each strand.
//
// The linear chain is a seed, not a claim of truth. After the first bootstrap,
// `src/data/progression.json` is the source of truth. The instructor refines
// the `prereqs` by hand. Re-running this tool without `--write` only prints, so
// a re-run never clobbers those edits by accident.
//
// Usage:
//   node tools/seed-progression.mjs            # print draft to stdout
//   node tools/seed-progression.mjs --write    # write src/data/progression.json

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKILLS_PATH = path.join(ROOT, 'src/data/skills.json');
const OUT_PATH = path.join(ROOT, 'src/data/progression.json');

// A kebab-case slug of the category text, used as the strand key.
function slug(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function seedProgression(skills) {
  const l2core = skills.filter(s => s.level === 'L2' && !s.optional);

  const strands = {};
  const strandOrder = [];
  const stageCount = {};
  const lastInStrand = {};
  const skillEntries = {};

  for (const s of l2core) {
    const key = slug(s.category);
    if (!strands[key]) {
      strandOrder.push(key);
      strands[key] = { name: s.category, order: strandOrder.length };
      stageCount[key] = 0;
    }
    const stage = ++stageCount[key];
    const prereqs = lastInStrand[key] ? [lastInStrand[key]] : [];
    skillEntries[s.id] = { strand: key, stage, prereqs };
    lastInStrand[key] = s.id;
  }

  return { version: 1, strands, skills: skillEntries };
}

function main() {
  const skills = JSON.parse(fs.readFileSync(SKILLS_PATH, 'utf8')).skills;
  const progression = seedProgression(skills);
  const json = JSON.stringify(progression, null, 2) + '\n';
  if (process.argv.includes('--write')) {
    fs.writeFileSync(OUT_PATH, json);
    process.stderr.write(`wrote ${path.relative(ROOT, OUT_PATH)}\n`);
  } else {
    process.stdout.write(json);
  }
}

// Run only when invoked directly, so tests can import `seedProgression`.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
