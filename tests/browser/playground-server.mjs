// Static server for the Code Playground browser tests.
//   node tests/browser/playground-server.mjs [port]
// Serves public/ at the site root (like Vite), the repository files,
// node_modules, optional local copies of the language runtimes
// (PG_PYODIDE_DIR, PG_SQLJS_DIR, PG_WASMOON_FILE) and a scripted mock
// of /api/assistant/agent so the coding agent can be tested offline.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const port = Number(process.argv[2] || process.env.PORT || 4173);
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.wasm': 'application/wasm', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.map': 'application/json', '.txt': 'text/plain', '.zip': 'application/zip', '.whl': 'application/zip',
  '.tar': 'application/x-tar', '.ts': 'text/plain', '.data': 'application/octet-stream',
};

const mounts = [
  ['/cdn/pyodide/', process.env.PG_PYODIDE_DIR],
  ['/cdn/sqljs/', process.env.PG_SQLJS_DIR],
  ['/cdn/wasmoon/', process.env.PG_WASMOON_DIR],
].filter(([, dir]) => dir);

// Agent mock: tests queue responses (Gemini generateContent JSON bodies);
// every request body is recorded so tests can inspect what was sent.
const agentQueue = [];
const agentRequests = [];

function send(res, code, body, type = 'text/plain') {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve) => { let b = ''; req.on('data', (c) => { b += c; }); req.on('end', () => resolve(b)); });
}

function serveFile(res, file) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { send(res, 404, 'Not found'); return; }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': 'no-store',
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'Access-Control-Allow-Origin': '*',
    });
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = decodeURIComponent(url.pathname);

  if (p === '/__mock/agent' && req.method === 'POST') {
    const body = JSON.parse(await readBody(req) || '{}');
    if (body.reset) { agentQueue.length = 0; agentRequests.length = 0; }
    for (const r of body.responses || []) agentQueue.push(r);
    send(res, 200, JSON.stringify({ queued: agentQueue.length }), 'application/json');
    return;
  }
  if (p === '/__mock/agent/requests') { send(res, 200, JSON.stringify(agentRequests), 'application/json'); return; }
  if (p === '/api/assistant/agent' && req.method === 'POST') {
    const body = JSON.parse(await readBody(req) || '{}');
    agentRequests.push(body);
    const next = agentQueue.shift();
    if (!next) { send(res, 200, JSON.stringify({ candidates: [{ content: { role: 'model', parts: [{ text: 'Done.' }] } }] }), 'application/json'); return; }
    if (next.status) { send(res, next.status, JSON.stringify(next.body || { error: 'mock error' }), 'application/json'); return; }
    send(res, 200, JSON.stringify(next), 'application/json');
    return;
  }

  for (const [prefix, dir] of mounts) {
    if (p.startsWith(prefix)) { serveFile(res, path.join(dir, p.slice(prefix.length))); return; }
  }
  const safe = path.normalize(p).replace(/^(\.\.[/\\])+/, '');
  const inPublic = path.join(root, 'public', safe);
  const inRoot = path.join(root, safe);
  if (!inPublic.startsWith(path.join(root, 'public')) || !inRoot.startsWith(root)) { send(res, 403, 'Forbidden'); return; }
  fs.stat(inPublic, (err, st) => {
    if (!err && st.isFile()) serveFile(res, inPublic);
    else serveFile(res, p.endsWith('/') ? path.join(inRoot, 'index.html') : inRoot);
  });
});

server.listen(port, '127.0.0.1', () => console.log(`playground test server on http://127.0.0.1:${port}`));
