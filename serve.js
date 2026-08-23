#!/usr/bin/env node
/* Sund server for the LXC: static files + the shared-count API, backed by a
   JSON file. Still zero npm dependencies — nothing here needs `npm install`.

   Usage: node serve.js [port]
   Env:   PORT, HOST, SUND_DATA (state file), SUND_TOKEN (optional access code) */

import http from 'node:http';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handle } from './lib/api.js';
import { emptyState, normalize } from './lib/state.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.argv[2] || process.env.PORT || 8080);
const HOST = process.env.HOST || '0.0.0.0';
const DATA = process.env.SUND_DATA || path.join(ROOT, 'data', 'state.json');
const TOKEN = process.env.SUND_TOKEN || '';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

/* ---------- file-backed store ---------- */

let cache = null;
let writeChain = Promise.resolve();   // serializes writes; one process, one file

const store = {
  async read() {
    if (cache) return cache;
    try {
      cache = normalize(JSON.parse(await fs.readFile(DATA, 'utf8')));
    } catch {
      cache = emptyState();
    }
    return cache;
  },
  write(state) {
    cache = state;
    // Write via temp file + rename so a crash mid-write can't truncate the data.
    writeChain = writeChain.then(async () => {
      await fs.mkdir(path.dirname(DATA), { recursive: true });
      const tmp = `${DATA}.${process.pid}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(state, null, 2));
      await fs.rename(tmp, DATA);
    }).catch((err) => console.error('write failed:', err.message));
    return writeChain;
  }
};

/* ---------- http ---------- */

const readBody = (req) => new Promise((resolve) => {
  let raw = '';
  req.on('data', (c) => {
    raw += c;
    if (raw.length > 1e6) req.destroy();       // don't buffer unbounded input
  });
  req.on('end', () => {
    try { resolve(raw ? JSON.parse(raw) : null); } catch { resolve(undefined); }
  });
});

const send = (res, status, body) =>
  res.writeHead(status, { 'Content-Type': TYPES['.json'], 'Cache-Control': 'no-store' })
     .end(JSON.stringify(body));

http.createServer(async (req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);

  if (url.startsWith('/api/')) {
    const body = req.method === 'GET' ? null : await readBody(req);
    if (body === undefined) return send(res, 400, { error: 'Invalid JSON' });
    const token = (req.headers.authorization || '').replace(/^Bearer /, '');
    const { status, body: out } = await handle(
      { method: req.method, path: url, body, token }, store, TOKEN
    );
    return send(res, status, out);
  }

  const rel = url === '/' ? 'index.html' : url.replace(/^\/+/, '');
  const file = path.resolve(ROOT, rel);
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) {
    return res.writeHead(403).end('Forbidden');   // never serve outside the app dir
  }
  try {
    const data = await fs.readFile(file);
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    }).end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
  }
}).listen(PORT, HOST, () => {
  console.log(`Sund running on http://${HOST}:${PORT}`);
  console.log(`State file: ${DATA}${fsSync.existsSync(DATA) ? '' : ' (will be created)'}`);
  console.log(TOKEN ? 'Access code required (SUND_TOKEN set)' : 'Open access — no SUND_TOKEN set');
});
