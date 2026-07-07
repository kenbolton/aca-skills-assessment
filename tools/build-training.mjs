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
// blocks become paragraphs; short heading-like lines become <h4>. PDF furniture —
// page numbers, copyright footers, all-caps running headers, and "cont'd" section
// markers — is dropped, and sentences split across a removed page break are rejoined.
function toHtml(title, text) {
  const dropLine = (l) => {
    // Collapse the justified whitespace a PDF running header carries before testing.
    const c = l.replace(/\s+/g, ' ').trim();
    if (/American Canoe Association|©|https?:\/\/|Date of last revision/i.test(c)) return true;
    if (/^(page\s*)?\d{1,3}$/i.test(c)) return true;                          // standalone page number
    if (/^[a-z0-9]$/i.test(c)) return true;                                   // lone page-marker letter/digit
    if (/\bcont['’`]?d\b/i.test(c) && c.length < 55) return true;             // "SURF ZONE cont'd"
    // All-caps running header (ignore a "cont'd" suffix and a trailing page marker letter).
    const alpha = c.replace(/\bcont['’`]?d\b/gi, '').replace(/\bcontinued\b/gi, '').replace(/\s+[a-z]\s*$/, '').replace(/[^A-Za-z]/g, '');
    if (c.length < 55 && alpha.length >= 3 && alpha === alpha.toUpperCase()) return true;
    return false;
  };
  const titleCase = (s) => s.replace(/\s+/g, ' ').trim().toLowerCase()
    .replace(/\b([a-z])/g, (_, ch) => ch.toUpperCase()).replace(/\bL([45])\b/, 'L$1');
  const blocks = text.replace(/\r/g, '').split(/\n\s*\n/);
  const items = [{ tag: 'h3', text: title }];
  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(l => l && !dropLine(l));
    if (!lines.length) continue;
    let joined = lines.join(' ').replace(/\s+/g, ' ').trim();
    if (!joined) continue;
    // A section title (2+ all-caps words) glued to the front of its intro paragraph:
    // split it into a heading + paragraph.
    const glued = joined.match(/^([A-Z][A-Z’'&-]+(?:\s+(?:[A-Z][A-Z’'&-]+|L[45]|&|AND))+)\s+([A-Z][a-z].*)$/);
    if (glued) {
      items.push({ tag: 'h4', text: titleCase(glued[1]) });
      joined = glued[2];
    }
    const tag = (lines.length === 1 && joined.length < 70 && !/[.!?:]$/.test(joined)) ? 'h4' : 'p';
    items.push({ tag, text: joined });
  }
  // Rejoin a sentence split by removed page furniture: a paragraph starting lowercase
  // right after a paragraph that didn't end in terminal punctuation.
  const merged = [];
  for (const it of items) {
    const prev = merged[merged.length - 1];
    if (it.tag === 'p' && prev && prev.tag === 'p' && !/[.!?:”"’)]\s*$/.test(prev.text) && /^[a-z(]/.test(it.text)) {
      prev.text = (prev.text + ' ' + it.text).replace(/\s+/g, ' ');
    } else {
      merged.push(it);
    }
  }
  return merged.map(it => `<${it.tag}>${esc(it.text)}</${it.tag}>`).join('\n');
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
