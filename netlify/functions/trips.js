/* Netlify backend: same API as serve.js, stored in Netlify Blobs instead of a
   file. Only loaded when deployed to Netlify — the LXC path never imports it,
   which is why `node serve.js` still needs no npm install. */

import { getStore } from '@netlify/blobs';
import { handle } from '../../lib/api.js';
import { emptyState, normalize } from '../../lib/state.js';

const KEY = 'state';

// Strong consistency: the phone must see the swim the laptop just logged.
const blobs = () => getStore({ name: 'sund', consistency: 'strong' });

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
    { method: req.method, path: pathname, body, token }, store, process.env.SUND_TOKEN || ''
  );

  return Response.json(out, { status, headers: { 'Cache-Control': 'no-store' } });
};

export const config = { path: '/api/*' };
