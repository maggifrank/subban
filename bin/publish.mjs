#!/usr/bin/env node
/* Build and deploy the public read-only site.
 *
 * Deploys through Netlify's file-digest API rather than the CLI. That is not
 * only to avoid installing the CLI on the container: the API uploads exactly
 * the files listed here, so the read/write function cannot be swept into a
 * public deploy the way the CLI's project-root discovery once did.
 *
 * Usage:
 *   node bin/publish.mjs [--source URL] [--deploy] [--if-changed FILE]
 *
 * Env:
 *   NETLIFY_AUTH_TOKEN   required to deploy (falls back to a logged-in CLI)
 *   SUND_NETLIFY_SITE  site id (falls back to .netlify/state.json)
 *   SUND_SOURCE        instance to snapshot (default http://localhost:8080)
 *   SUND_DIST          where to build (default ./dist)
 *   SUND_TOKEN         access code, if the source instance requires one
 */

import { normalize, cardTrips, poolCounts } from '../lib/state.js';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = process.env.SUND_DIST || path.join(ROOT, 'dist');
const API = 'https://api.netlify.com/api/v1';

const flag = (name) => process.argv.includes(name);
const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const SOURCE = arg('--source', process.env.SUND_SOURCE || 'http://localhost:8080').replace(/\/$/, '');
const DEPLOY = flag('--deploy');
const IF_CHANGED = arg('--if-changed', null);
const SOURCE_TOKEN = process.env.SUND_TOKEN || '';

/* ---------- read the live instance ---------- */

async function get(pathname) {
  const res = await fetch(`${SOURCE}${pathname}`, {
    headers: SOURCE_TOKEN ? { Authorization: `Bearer ${SOURCE_TOKEN}` } : {},
    signal: AbortSignal.timeout(10000)
  });
  if (!res.ok) throw new Error(`${pathname} -> HTTP ${res.status}`);
  return res.json();
}

/* Publish the date a swim happened — not the hour, and not the pool.
 *
 * The exact times are a fairly detailed picture of someone's week, and pinning
 * a pool to a date says which neighbourhood they were in on which day. Neither
 * is needed by anything on the public page: the count, cost per trip,
 * break-even and the monthly chart all work off dates alone, and the pool table
 * is published as totals (see poolTable()) rather than per trip. Both are
 * dropped from the snapshot rather than hidden in the page, or they would still
 * sit in state.json for anyone who opened it directly.
 *
 * Anchoring at local midday keeps the date and the count while dropping the
 * time, and matches the convention backdated trips already use. */
function publicTrips(state) {
  return cardTrips(normalize(state)).map((trip) => {
    const d = new Date(typeof trip === 'string' ? trip : trip.at);
    return { at: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0).toISOString() };
  }).sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
}

/* The pool table, totalled here rather than on the page.
 *
 * The page has no trips to count from — its trips are card-only and carry no
 * pool — so the finished rows are what gets published: a name, a count and
 * whether the card covers it. That is deliberately the whole of it. Sending the
 * pool list instead would ship every pool's coordinates, and leaving the pool
 * on each trip would say which pool on which day; a total says where the
 * swimming happened without dating any of it.
 *
 * Counted over the full state, so the table covers the off-card swims the
 * published trips leave out and its total agrees with `totals.all`. */
function poolTable(state) {
  return poolCounts(normalize(state)).map(({ name, count, card }) => ({ name, count, card }));
}

/* Only the files the read-only page needs. lib/api.js, lib/rates.js, serve.js
   and netlify/ are server-side and are deliberately absent. */
const COPY = [
  ['styles.css', 'styles.css'],
  ['public/index.html', 'index.html'],
  ['public/app.js', 'app.js'],
  ['lib/state.js', 'lib/state.js'],
  ['lib/i18n.js', 'lib/i18n.js'],
  ['lib/money.js', 'lib/money.js'],
  ['lib/chart.js', 'lib/chart.js'],
  ['lib/pools.js', 'lib/pools.js'],
  ['lib/pooltable.js', 'lib/pooltable.js']
];

/* The list above is maintained by hand, and a module that grows a new import is
   invisible to it: the file simply 404s, the module graph fails and the page
   renders nothing, with the JSON still serving perfectly so every other check
   looks fine. So walk what was actually built and refuse to publish a graph
   with a hole in it. */
async function checkImports(dir) {
  const missing = [];
  const walk = async (rel) => {
    const abs = path.join(dir, rel);
    const src = await fs.readFile(abs, 'utf8');
    for (const m of src.matchAll(/(?:from|import)\s*['"](\.[^'"]+)['"]/g)) {
      const target = path.normalize(path.join(path.dirname(rel), m[1]));
      try {
        await fs.access(path.join(dir, target));
      } catch {
        missing.push(`${rel} imports ${m[1]} -> ${target} is not in the build`);
      }
    }
  };
  const entries = await fs.readdir(dir, { withFileTypes: true, recursive: true });
  for (const e of entries) {
    if (!e.isFile() || !e.name.endsWith('.js')) continue;
    const rel = path.relative(dir, path.join(e.parentPath ?? e.path, e.name));
    await walk(rel);
  }
  return missing;
}

const NETLIFY_TOML = `# Generated by bin/publish.mjs — a static, read-only build.
# No functions block: this site is public and must have no write path.
[build]
  publish = "."
  command = ""

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "no-referrer"
`;

async function build(state, rates) {
  await fs.rm(DIST, { recursive: true, force: true });
  await fs.mkdir(path.join(DIST, 'lib'), { recursive: true });
  for (const [from, to] of COPY) await fs.copyFile(path.join(ROOT, from), path.join(DIST, to));
  /* Two plain counts, so the public page can say how much swimming there was
     without publishing the off-card trips themselves. No dates, no pools —
     it reveals that swims happened elsewhere, not where or when. */
  const full = normalize(state);
  const totals = { all: full.trips.length, offCard: full.trips.length - cardTrips(full).length };

  await fs.writeFile(path.join(DIST, 'state.json'), JSON.stringify({
    ...state, trips: publicTrips(state), pools: [], totals,
    poolTable: poolTable(state), generatedAt: new Date().toISOString()
  }, null, 2));
  await fs.writeFile(path.join(DIST, 'rates.json'), JSON.stringify(rates, null, 2));
  await fs.writeFile(path.join(DIST, 'netlify.toml'), NETLIFY_TOML);
}

/* ---------- netlify ---------- */

async function authToken() {
  if (process.env.NETLIFY_AUTH_TOKEN) return process.env.NETLIFY_AUTH_TOKEN;
  // Convenience on a machine where the CLI is already signed in.
  const candidates = [
    path.join(os.homedir(), 'Library', 'Preferences', 'netlify', 'config.json'),
    path.join(os.homedir(), '.config', 'netlify', 'config.json'),
    path.join(os.homedir(), '.netlify', 'config.json')
  ];
  for (const file of candidates) {
    try {
      const cfg = JSON.parse(await fs.readFile(file, 'utf8'));
      for (const user of Object.values(cfg.users ?? {})) {
        if (user?.auth?.token) return user.auth.token;
      }
    } catch { /* try the next one */ }
  }
  throw new Error('no Netlify token: set NETLIFY_AUTH_TOKEN');
}

async function siteId() {
  if (process.env.SUND_NETLIFY_SITE) return process.env.SUND_NETLIFY_SITE;
  const raw = await fs.readFile(path.join(ROOT, '.netlify', 'state.json'), 'utf8');
  return JSON.parse(raw).siteId;
}

async function netlify(token, pathname, { method = 'GET', body, raw } = {}) {
  const res = await fetch(`${API}${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(raw ? { 'Content-Type': 'application/octet-stream' } : body ? { 'Content-Type': 'application/json' } : {})
    },
    body: raw ?? (body ? JSON.stringify(body) : undefined),
    signal: AbortSignal.timeout(60000)
  });
  if (!res.ok) throw new Error(`${method} ${pathname} -> HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

async function listFiles(dir, prefix = '') {
  const out = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    const rel = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) out.push(...await listFiles(abs, rel));
    else {
      const buf = await fs.readFile(abs);
      out.push({ rel, abs, buf, sha1: crypto.createHash('sha1').update(buf).digest('hex') });
    }
  }
  return out;
}

async function deploy(token, site) {
  const files = await listFiles(DIST);
  const manifest = Object.fromEntries(files.map((f) => [f.rel, f.sha1]));

  // No `functions` key: this deploy declares a site made only of these files.
  const created = await netlify(token, `/sites/${site}/deploys`, {
    method: 'POST', body: { files: manifest, draft: false }
  });

  const required = new Set(created.required ?? []);
  for (const f of files) {
    if (!required.has(f.sha1)) continue;
    const encoded = f.rel.split('/').map(encodeURIComponent).join('/');
    await netlify(token, `/deploys/${created.id}/files${encoded}`, { method: 'PUT', raw: f.buf });
    required.delete(f.sha1);
  }

  let state = created;
  for (let i = 0; i < 40 && state.state !== 'ready'; i++) {
    if (state.state === 'error') throw new Error(`deploy failed: ${state.error_message ?? 'unknown'}`);
    await new Promise((r) => setTimeout(r, 1500));
    state = await netlify(token, `/deploys/${created.id}`);
  }
  if (state.state !== 'ready') throw new Error(`deploy stuck in state "${state.state}"`);

  /* Verify rather than assume. A function on a public site is a write path, and
     that is the one thing this build must never ship. */
  const fns = state.available_functions ?? state.functions ?? [];
  if (fns.length) {
    throw new Error(`published deploy contains ${fns.length} function(s): ${fns.map((f) => f.n ?? f).join(', ')}`);
  }

  return { id: state.id, url: state.ssl_url ?? state.url, uploaded: files.length - required.size };
}

/* ---------- run ---------- */

const state = await get('/api/state');
let rates = null;
try {
  rates = await get('/api/rates');
} catch (err) {
  console.warn(`rates unavailable (${err.message}) — the page will show ISK`);
}

await build(state, rates);
/* Fingerprint what was actually built, rather than just the trip count and rate
   date. Those miss a code change entirely: a new app.js or pool list would sit
   undeployed until the next swim happened to trigger a publish. generatedAt is
   excluded because it moves on every build and would defeat the comparison. */
async function fingerprint(dir) {
  const files = (await listFiles(dir)).sort((a, b) => a.rel.localeCompare(b.rel));
  const h = crypto.createHash('sha1');
  for (const f of files) {
    h.update(f.rel);
    if (f.rel === '/state.json') {
      const { generatedAt, ...rest } = JSON.parse(f.buf.toString());
      h.update(JSON.stringify(rest));
    } else {
      h.update(f.buf);
    }
  }
  return h.digest('hex');
}

const marker = { fingerprint: await fingerprint(DIST), rev: state.rev };

if (IF_CHANGED) {
  let last = null;
  try { last = JSON.parse(await fs.readFile(IF_CHANGED, 'utf8')); } catch { /* first run */ }
  if (last && last.fingerprint === marker.fingerprint) {
    console.log(`no change since rev ${marker.rev} — nothing to publish`);
    process.exit(0);
  }
}

const missing = await checkImports(DIST);
if (missing.length) {
  console.error('REFUSING TO PUBLISH — the built module graph has holes:');
  for (const m of missing) console.error(`  ${m}`);
  process.exit(1);
}

console.log(`built dist/ from ${SOURCE} — ${state.trips.length} trips, rev ${state.rev}`);

if (!DEPLOY) {
  console.log('to publish:  node bin/publish.mjs --deploy');
  process.exit(0);
}

const token = await authToken();
const site = await siteId();
const result = await deploy(token, site);
console.log(`deployed ${result.id} to ${result.url} — no functions, verified`);

if (IF_CHANGED) {
  await fs.mkdir(path.dirname(IF_CHANGED), { recursive: true });
  await fs.writeFile(IF_CHANGED, JSON.stringify({ ...marker, at: new Date().toISOString() }, null, 2));
}
