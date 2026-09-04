#!/usr/bin/env node
/* Bulk-import swims from a written log.
 *
 * Reads lines of "DD.MM  Pool name" from a file or stdin, resolves the pool
 * against the built-in list, and posts each one. Idempotent: a swim already
 * recorded on that date at that pool is skipped, so re-running after a partial
 * failure cannot double-count.
 *
 * Usage:
 *   node bin/import-trips.mjs log.txt --dry-run
 *   node bin/import-trips.mjs log.txt
 *
 * Env: SUND_SOURCE (default http://localhost:8080), SUND_TOKEN, SUND_YEAR
 */

import fs from 'node:fs/promises';
import { BUILT_IN } from '../lib/pools.js';

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const file = args.find((a) => !a.startsWith('--'));
const SOURCE = (process.env.SUND_SOURCE || 'http://localhost:8080').replace(/\/$/, '');
const TOKEN = process.env.SUND_TOKEN || '';
const YEAR = Number(process.env.SUND_YEAR) || new Date().getFullYear();

const headers = { ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}) };

/* Accented vowels decompose under NFD, but ð, þ and æ do not — stripping them
   would turn "Suðurbæjarlaug" into "surbjarlaug" and refuse to match an ASCII
   spelling of the same pool. Transliterate them first, so a log typed without
   Icelandic characters still resolves. */
const norm = (s) => s
  .toLowerCase()
  .replace(/ð/g, 'd').replace(/þ/g, 'th').replace(/æ/g, 'ae').replace(/ø/g, 'o')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]/g, '');

function findPool(name) {
  const n = norm(name);
  return BUILT_IN.find((p) => norm(p.name) === n)
      ?? BUILT_IN.find((p) => norm(p.name).startsWith(n) || n.startsWith(norm(p.name)));
}

const raw = file ? await fs.readFile(file, 'utf8') : await new Promise((res) => {
  let s = ''; process.stdin.on('data', (c) => (s += c)); process.stdin.on('end', () => res(s));
});

const entries = [];
const problems = [];
for (const line of raw.split('\n')) {
  const text = line.trim();
  if (!text || text.startsWith('#')) continue;
  const m = text.match(/^(\d{1,2})[.\/-](\d{1,2})\s+(.+?)\s*$/);
  if (!m) { problems.push(`unparsed: ${text}`); continue; }
  const [, dd, mm, poolName] = m;
  const pool = findPool(poolName);
  if (!pool) { problems.push(`unknown pool: ${poolName}`); continue; }

  /* Local midday, the same anchor the app uses for a backdated trip: it keeps
     the date intact for anyone reading in another timezone. */
  let when = new Date(YEAR, Number(mm) - 1, Number(dd), 12, 0, 0, 0);
  if (when > new Date()) when = new Date(YEAR - 1, Number(mm) - 1, Number(dd), 12, 0, 0, 0);
  entries.push({ at: when.toISOString(), pool, label: `${dd}.${mm} ${pool.name}` });
}

if (problems.length) {
  console.error('Refusing to import — fix these first:');
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}

const res = await fetch(`${SOURCE}/api/state`, { headers });
if (!res.ok) { console.error(`cannot read ${SOURCE}/api/state -> HTTP ${res.status}`); process.exit(1); }
const state = await res.json();

const already = new Set(state.trips.map((t) => `${t.at.slice(0, 10)}|${t.pool ?? ''}`));
const todo = entries.filter((e) => !already.has(`${e.at.slice(0, 10)}|${e.pool.id}`));
const skipped = entries.length - todo.length;

console.log(`${entries.length} in the log, ${skipped} already recorded, ${todo.length} to add`);
if (DRY) {
  for (const e of todo) console.log(`  would add  ${e.at.slice(0, 10)}  ${e.pool.name}${e.pool.card ? '' : '  (not on the card)'}`);
  process.exit(0);
}

let added = 0;
for (const e of todo) {
  const r = await fetch(`${SOURCE}/api/trips`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ at: e.at, pool: e.pool })
  });
  if (!r.ok) { console.error(`  failed ${e.label} -> HTTP ${r.status}`); continue; }
  added++;
}
console.log(`added ${added} of ${todo.length}`);
