/* The HTTP contract, shared by both backends. Each backend supplies a `store`
   ({ read, write }) and gets identical routing, validation and auth. */

import { normalize, addTrip, removeLastTrip, removeTripAt, clearTrips, updateSettings } from './state.js';

const json = (status, body) => ({ status, body });

/* Operations are deltas ("add a trip"), never "set the count to N", so two
   devices logging a swim at the same time add two trips instead of clobbering
   each other. */
export async function handle({ method, path, body, token }, store, expectedToken) {
  if (expectedToken && token !== expectedToken) {
    return json(401, { error: 'Bad or missing access code' });
  }

  if (path === '/api/state' && method === 'GET') {
    return json(200, await store.read());
  }

  if (path === '/api/trips' && method === 'POST') {
    return json(200, await mutate(store, (s) => addTrip(s, body?.at)));
  }

  if (path === '/api/trips/last' && method === 'DELETE') {
    return json(200, await mutate(store, removeLastTrip));
  }

  /* Body rather than a path segment: an ISO timestamp in a URL needs escaping,
     and the two backends decode paths differently. */
  if (path === '/api/trips/one' && method === 'DELETE') {
    if (typeof body?.at !== 'string') return json(400, { error: 'Expected { at }' });
    return json(200, await mutate(store, (s) => removeTripAt(s, body.at)));
  }

  if (path === '/api/trips' && method === 'DELETE') {
    return json(200, await mutate(store, clearTrips));
  }

  if (path === '/api/settings' && method === 'PUT') {
    if (!body || typeof body !== 'object') return json(400, { error: 'Expected a settings object' });
    return json(200, await mutate(store, (s) => updateSettings(s, body)));
  }

  return json(404, { error: 'No such endpoint' });
}

async function mutate(store, fn) {
  const next = fn(normalize(await store.read()));
  await store.write(next);
  return next;
}
