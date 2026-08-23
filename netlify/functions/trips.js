/* Netlify backend: same API as serve.js, stored in Netlify Blobs instead of a
   file. Only loaded when deployed to Netlify — the LXC path never imports it,
   which is why `node serve.js` still needs no npm install. */

import { getStore } from '@netlify/blobs';
import { handle } from '../../lib/api.js';
import { emptyState, normalize } from '../../lib/state.js';
import { emptyRates, refreshThrough } from '../../lib/rates.js';

const KEY = 'state';
const RATES_KEY = 'rates';

// Strong consistency: the phone must see the swim the laptop just logged.
const blobs = () => getStore({ name: 'subban', consistency: 'strong' });

const store = {
  async read() {
    try {
      return normalize(await blobs().get(KEY, { type: 'json' }));
    } catch {
      return emptyState();
    }
  },
  async write(state) {
    await blobs().setJSON(KEY, state);
  }
};

/* Functions are stateless per invocation, so the rate cache lives in Blobs
   alongside the state — otherwise every cold start would refetch. */
const rates = async () => {
  let cached;
  try {
    cached = await blobs().get(RATES_KEY, { type: 'json' });
  } catch {
    cached = null;
  }
  return refreshThrough(cached ?? emptyRates(), async (next) => {
    try { await blobs().setJSON(RATES_KEY, next); } catch { /* serve it anyway */ }
  });
};

export default async (req) => {
  const { pathname } = new URL(req.url);

  let body = null;
  if (req.method !== 'GET') {
    try {
      const raw = await req.text();
      body = raw ? JSON.parse(raw) : null;
    } catch {
      return Response.json({ error: 'Invalid JSON' }, { status: 400 });
    }
  }

  const token = (req.headers.get('authorization') || '').replace(/^Bearer /, '');
  const { status, body: out } = await handle(
    { method: req.method, path: pathname, body, token }, { store, rates }, process.env.SUBBAN_TOKEN || process.env.SUND_TOKEN || ''
  );

  return Response.json(out, { status, headers: { 'Cache-Control': 'no-store' } });
};

export const config = { path: '/api/*' };
