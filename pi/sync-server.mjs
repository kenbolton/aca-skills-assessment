import { createServer } from 'node:http';
import { readFile, writeFile, readdir, unlink, mkdir } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { sessionSummary } from '../src/lib/session-summary.js';
import { safeSessionPath } from '../src/lib/safe-session-path.js';
import { sessionToCsv } from '../src/lib/csv.js';

const PORT = process.env.PORT || 8787;
const DIST = decodeURI(new URL('../dist/', import.meta.url).pathname);
const SESSIONS = decodeURI(new URL('./sessions/', import.meta.url).pathname);
await mkdir(SESSIONS, { recursive: true });

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };

function body(req) {
  return new Promise((res, rej) => { let d = ''; req.on('data', c => (d += c)); req.on('end', () => res(d)); req.on('error', rej); });
}
function sendJson(res, code, obj) { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); }

async function readSession(id) {
  const p = safeSessionPath(SESSIONS, id);
  if (!p) return null;
  try { return JSON.parse(await readFile(p, 'utf8')); } catch { return null; }
}

async function listSummaries() {
  const files = (await readdir(SESSIONS)).filter(f => f.endsWith('.json'));
  const out = [];
  for (const f of files) {
    try { out.push(sessionSummary(JSON.parse(await readFile(join(SESSIONS, f), 'utf8')))); }
    catch (e) { console.error('skip bad session file', f, e.message); }
  }
  out.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return out;
}

function sessionsPage() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Past Assessments</title>
<style>
 body{font-family:system-ui,sans-serif;margin:0;color:#14323a}
 header{background:#005f6b;color:#fff;padding:1rem}
 header a{color:#bdeae2}
 main{padding:1rem;max-width:900px;margin:0 auto}
 table{width:100%;border-collapse:collapse}
 th,td{text-align:left;padding:.5rem;border-bottom:1px solid #ddd;vertical-align:top}
 button{min-height:40px}
 .del{background:#c0392b;color:#fff;border:0;border-radius:6px;padding:.25rem .6rem}
 .resume{background:#1f8a4c;color:#fff;border:0;border-radius:6px;padding:.25rem .6rem}
 .empty{color:#666}
 .selftag{background:#eef7f8;color:#00707e;border:1px solid #bcdfe3;border-radius:4px;padding:0 .35rem;font-size:.75rem}
 .imp{font-size:.9rem;color:#bdeae2}
 .imp input{color:#fff}
</style></head><body>
<header><strong>Past Assessments</strong> &nbsp; <a href="/">&larr; Back to app</a>
 &nbsp; <label class="imp">Import JSON <input type="file" id="imp" accept="application/json,.json"></label></header>
<main><p class="empty" id="status">Loading…</p><table id="t" hidden><thead>
<tr><th>Date</th><th>Level</th><th>Participants</th><th>Rated</th><th>Export</th><th></th></tr>
</thead><tbody></tbody></table></main>
<script>
async function load(){
 const r=await fetch('/api/sessions'); const rows=await r.json();
 const t=document.getElementById('t'), s=document.getElementById('status');
 if(!rows.length){s.textContent='No saved assessments yet.';return;}
 s.hidden=true;t.hidden=false;const tb=t.querySelector('tbody');tb.innerHTML='';
 function cell(text){const td=document.createElement('td');td.textContent=text;return td;}
 for(const x of rows){
  const tr=document.createElement('tr');
  const date=new Date(x.createdAt).toLocaleString();
  const idp=encodeURIComponent(x.id);
  tr.appendChild(cell(date));
  const levelMode=x.level||(x.targets.length?'L1/L2':'');
  tr.appendChild(cell(levelMode));
  const participantsText=x.participants.map((n,i)=>x.landings[i]?n+' ('+x.landings[i]+')':n).join(', ');
  const pcell=cell(participantsText);
  if(x.selfAssessment){const b=document.createElement('span');b.className='selftag';b.textContent='self';pcell.append(' ');pcell.appendChild(b);}
  tr.appendChild(pcell);
  tr.appendChild(cell(x.counts.rated+'/'+x.counts.core));
  const exp=document.createElement('td');
  const csv=document.createElement('a');csv.href='/api/sessions/'+idp+'.csv';csv.textContent='CSV';
  const jsn=document.createElement('a');jsn.href='/api/sessions/'+idp+'.json';jsn.textContent='JSON';
  exp.appendChild(csv);exp.append(' · ');exp.appendChild(jsn);
  tr.appendChild(exp);
  const act=document.createElement('td');
  if(x.targets&&x.targets.length){
   const res=document.createElement('button');res.className='resume';res.textContent='Resume';
   res.onclick=async()=>{
    const rr=await fetch('/api/sessions/'+idp+'.json');
    if(!rr.ok){alert('Could not load this session.');return;}
    const full=await rr.text();
    try{const p=JSON.parse(full);if(!p.paddlers||!p.paddlers.length||!('target' in p.paddlers[0]))throw 0;}
    catch{alert('This session is an older format and cannot be resumed.');return;}
    if(!confirm('Resume this assessment ('+x.participants.join(', ')+')? This replaces any assessment currently open in the app.'))return;
    localStorage.setItem('aca-assessment:session',full);
    location.href='/';
   };
   act.appendChild(res);act.append(' ');
  }
  const del=document.createElement('button');del.className='del';del.textContent='Delete';
  del.onclick=async()=>{
   if(!confirm('Delete this assessment ('+x.participants.join(', ')+')? This cannot be undone.'))return;
   const d=await fetch('/api/sessions/'+idp,{method:'DELETE'});
   if(d.ok){tr.remove(); if(!tb.children.length){t.hidden=true;s.hidden=false;s.textContent='No saved assessments yet.';}}
   else alert('Delete failed.');
  };
  act.appendChild(del);
  tr.appendChild(act);
  tb.appendChild(tr);
 }
}
load();
document.getElementById('imp').addEventListener('change',async e=>{
 const f=e.target.files[0]; if(!f) return;
 let text; try{ text=await f.text(); JSON.parse(text); }catch{ alert('Not a valid JSON file.'); e.target.value=''; return; }
 const r=await fetch('/sync',{method:'POST',headers:{'Content-Type':'application/json'},body:text});
 if(r.ok){ e.target.value=''; load(); } else { e.target.value=''; const j=await r.json().catch(()=>({})); alert('Import failed: '+(j.error||r.status)); }
});
</script></body></html>`;
}

const server = createServer(async (req, res) => {
  const url = req.url.split('?')[0];

  if (req.method === 'POST' && url === '/sync') {
    try {
      const session = JSON.parse(await body(req));
      if (!session || typeof session.id !== 'string' || !Array.isArray(session.results)) throw new Error('bad payload');
      const p = safeSessionPath(SESSIONS, session.id);
      if (!p) throw new Error('bad id');
      await writeFile(p, JSON.stringify(session, null, 2));
      return sendJson(res, 200, { syncedAt: new Date().toISOString() });
    } catch (e) { return sendJson(res, 400, { error: String(e.message || e) }); }
  }

  if (req.method === 'GET' && url === '/api/sessions') {
    return sendJson(res, 200, await listSummaries());
  }

  const m = url.match(/^\/api\/sessions\/(.+?)(\.json|\.csv)?$/);
  if (m && (req.method === 'GET' || req.method === 'DELETE')) {
    let id;
    try { id = decodeURIComponent(m[1]); } catch { return sendJson(res, 400, { error: 'bad id' }); }
    if (req.method === 'DELETE') {
      const p = safeSessionPath(SESSIONS, id);
      if (!p) return sendJson(res, 400, { error: 'bad id' });
      try { await unlink(p); return sendJson(res, 200, { deleted: true }); }
      catch { return sendJson(res, 404, { error: 'not found' }); }
    }
    const session = await readSession(id);
    if (!session) return sendJson(res, 404, { error: 'not found' });
    const safeName = String(id).replace(/[^a-z0-9_-]/gi, '_');
    if (m[2] === '.csv') {
      res.writeHead(200, { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="${safeName}.csv"` });
      return res.end(sessionToCsv(session));
    }
    res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="${safeName}.json"` });
    return res.end(JSON.stringify(session, null, 2));
  }

  if (req.method === 'GET' && url === '/sessions') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(sessionsPage());
  }

  // static files from dist/ with SPA fallback
  let decodedUrl;
  try { decodedUrl = decodeURIComponent(url); }
  catch { res.writeHead(404); res.end('Not found'); return; }
  const rel = normalize(decodedUrl).replace(/^(\.\.[/\\])+/, '');
  let file = join(DIST, rel === '/' ? 'index.html' : rel);
  if (!file.startsWith(DIST)) { res.writeHead(404); res.end('Not found'); return; }
  try {
    let data;
    try { data = await readFile(file); }
    catch { data = await readFile(join(DIST, 'index.html')); file = 'index.html'; }
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end('Not found'); }
});

server.listen(PORT, () => console.log(`ACA assessment server on :${PORT}`));
