// Converts instructor Org lessons to HTML fragments in lessons-content/ and
// refreshes src/data/lessons.json (skillId -> slug). Run on the Mac where the
// .org sources live. Requires pandoc. The .html fragments are git-ignored and
// are bundled only into the private (VITE_PRIVATE) build (see Task 8).
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
const run = promisify(execFile);

const SRC = process.env.LESSONS_SRC ||
  join(process.env.HOME, 'Documents/ACA/2024/Lessons');
const OUT = new URL('../lessons-content/', import.meta.url).pathname;
const MAP = new URL('../src/data/lessons.json', import.meta.url).pathname;

// org filename (without .org) -> { skillId, slug }
const LESSONS = [
  { file: 'Forward Paddling', skillId: 'l2-forward', slug: 'forward-paddling' },
  { file: 'Reverse Paddling', skillId: 'l2-reverse', slug: 'reverse-paddling' },
  { file: 'Stopping', skillId: 'l2-stopping', slug: 'stopping' },
  { file: 'Forward and Reverse Sweep', skillId: 'l2-sweep', slug: 'forward-reverse-sweep' },
  { file: 'Capsize and Wet Exit', skillId: 'l2-wet-exit', slug: 'capsize-wet-exit' },
  { file: 'Assisted Rescues and Deep-Water Re-Entry', skillId: 'l2-assisted-rescue', slug: 'assisted-rescues' },
];

const map = {};
await mkdir(OUT, { recursive: true });
for (const L of LESSONS) {
  const src = join(SRC, `${L.file}.org`);
  try { await access(src); } catch { console.warn('SKIP (missing):', src); continue; }
  const { stdout } = await run('pandoc', ['-f', 'org', '-t', 'html5', src]);
  // HTML fragment only (no standalone <html> wrapper) — embedded inline by Task 8.
  await writeFile(join(OUT, `${L.slug}.html`), stdout);
  map[L.skillId] = L.slug;
  console.log('built', L.slug);
}
await writeFile(MAP, JSON.stringify(map, null, 2) + '\n');
console.log(`wrote ${Object.keys(map).length} lessons -> src/data/lessons.json`);
