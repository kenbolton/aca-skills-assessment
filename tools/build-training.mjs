// Builds private training-guidance fragments in training-content/ from the ACA
// Training Guidance PDFs. Run locally (needs `pdftotext`, from poppler). The
// generated *.html fragments are git-ignored and are bundled ONLY into the
// private (VITE_PRIVATE) build — the ACA guidance text never enters the repo.
//
//   node tools/build-training.mjs
//
// The public GitHub Pages build has no training-content/, so it ships only the
// external link to the ACA-hosted PDF, not the embedded text.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
const run = promisify(execFile);

const OUT = new URL('../training-content/', import.meta.url).pathname;
const CACHE = join(OUT, '.cache');

// key -> source PDF (ACA-hosted). Key becomes the fragment name (l4.html, l5.html)
// and must match the level the intro serves it for (lower-cased level).
const GUIDES = [
  { key: 'l4', title: 'ACA Level 4 Open Water Coastal Kayaking — Training Guidance',
    url: 'https://americancanoe.org/wp-content/uploads/2025/09/Level-4-Training-Guidance.pdf' },
  { key: 'l5', title: 'ACA Level 5 Advanced Open Water Coastal Kayaking — Training Guidance',
    url: 'https://americancanoe.org/wp-content/uploads/2024/04/Level-5-Training-Guidance.pdf' },
];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Turn pdftotext output into a simple, readable HTML fragment: blank-line-separated
// blocks become paragraphs; short heading-like lines become <h4>. Drop page footers.
function toHtml(title, text) {
  const isFooter = (l) => /^\s*(©|American Canoe Association|https?:\/\/|Date of last revision|Page \d|\d{1,3})\s*$/i.test(l)
    || /American Canoe Association/i.test(l);
  const blocks = text.replace(/\r/g, '').split(/\n\s*\n/);
  const parts = [`<h3>${esc(title)}</h3>`];
  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(l => l && !isFooter(l));
    if (!lines.length) continue;
    const joined = lines.join(' ').replace(/\s+/g, ' ').trim();
    if (!joined) continue;
    // A short line with no terminal punctuation reads as a heading.
    if (lines.length === 1 && joined.length < 70 && !/[.!?:]$/.test(joined)) {
      parts.push(`<h4>${esc(joined)}</h4>`);
    } else {
      parts.push(`<p>${esc(joined)}</p>`);
    }
  }
  return parts.join('\n');
}

await mkdir(CACHE, { recursive: true });
let built = 0;
for (const g of GUIDES) {
  const pdf = join(CACHE, `${g.key}.pdf`);
  try {
    await run('curl', ['-sL', '--fail', '-o', pdf, g.url]);
    const { stdout } = await run('pdftotext', ['-layout', pdf, '-']);
    await writeFile(join(OUT, `${g.key}.html`), toHtml(g.title, stdout));
    built++;
    console.log('built training-content/' + g.key + '.html');
  } catch (e) {
    console.warn('SKIP', g.key, '-', e.message);
  }
}
console.log(`done: ${built}/${GUIDES.length} fragments (git-ignored, private build only)`);
