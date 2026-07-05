import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const PORT = process.env.PORT || 8787;
const DIST = decodeURI(new URL('../dist/', import.meta.url).pathname);
const SESSIONS = decodeURI(new URL('./sessions/', import.meta.url).pathname);
await mkdir(SESSIONS, { recursive: true });

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };

function body(req) {
  return new Promise((res, rej) => { let d = ''; req.on('data', c => (d += c)); req.on('end', () => res(d)); req.on('error', rej); });
}

const server = createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/sync') {
    try {
      const session = JSON.parse(await body(req));
      if (!session || typeof session.id !== 'string' || !Array.isArray(session.results)) throw new Error('bad payload');
      const safe = session.id.replace(/[^a-z0-9\-_]/gi, '_');
      await writeFile(join(SESSIONS, `${safe}.json`), JSON.stringify(session, null, 2));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ syncedAt: new Date().toISOString() }));
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: String(e.message || e) }));
    }
  }
  const rel = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  let file = join(DIST, rel === '/' ? 'index.html' : rel);
  // Defense-in-depth: never serve a path resolved outside the dist/ root.
  if (!file.startsWith(DIST)) { res.writeHead(404); res.end('Not found'); return; }
  try {
    let data;
    try { data = await readFile(file); }
    catch { data = await readFile(join(DIST, 'index.html')); file = 'index.html'; }
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404); res.end('Not found');
  }
});

server.listen(PORT, () => console.log(`ACA assessment server on :${PORT}`));
