/* Shared domain logic. Imported by both the LXC server (serve.js) and the
   Netlify function, so the two backends can never drift apart. Pure functions:
   every operation returns a new state with an incremented `rev`. */

export const DEFAULT_SETTINGS = { membership: 36400, cardPrice: 14000, cardTrips: 30 };

export const emptyState = () => ({ trips: [], pools: [], settings: { ...DEFAULT_SETTINGS }, rev: 0 });

/* A trip is { at, pool? }. It used to be a bare ISO string, and snapshots and
   saved caches from then still are, so every read goes through here. */
export const tripAt = (t) => (typeof t === 'string' ? t : t?.at);

function cleanTrip(raw) {
  const at = tripAt(raw);
  if (typeof at !== 'string' || isNaN(Date.parse(at))) return null;
  const pool = typeof raw?.pool === 'string' && raw.pool ? raw.pool : undefined;
  return pool ? { at, pool } : { at };
}

function cleanPool(raw) {
  if (!raw || typeof raw.id !== 'string' || typeof raw.name !== 'string') return null;
  const id = raw.id.trim(), name = raw.name.trim();
  if (!id || !name) return null;
  const out = { id, name };
  if (Number.isFinite(raw.lat) && Number.isFinite(raw.lon)) {
    out.lat = Number(raw.lat);
    out.lon = Number(raw.lon);
  }
  return out;
}

/* Accepts anything that has been sitting in a datastore and returns something
   the rest of the code can trust. */
export function normalize(raw) {
  if (!raw || typeof raw !== 'object') return emptyState();
  const trips = (Array.isArray(raw.trips) ? raw.trips : [])
    .map(cleanTrip).filter(Boolean)
    .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  const pools = (Array.isArray(raw.pools) ? raw.pools : [])
    .map(cleanPool).filter(Boolean);
  return {
    trips,
    pools,
    settings: sanitizeSettings({ ...DEFAULT_SETTINGS, ...(raw.settings || {}) }),
    rev: Number.isInteger(raw.rev) && raw.rev >= 0 ? raw.rev : 0
  };
}

function sanitizeSettings(s) {
  const num = (v, fallback, min) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= min ? n : fallback;
  };
  return {
    membership: num(s.membership, DEFAULT_SETTINGS.membership, 0),
    cardPrice: num(s.cardPrice, DEFAULT_SETTINGS.cardPrice, 0),
    cardTrips: Math.round(num(s.cardTrips, DEFAULT_SETTINGS.cardTrips, 1))
  };
}

/* Canonicalises to UTC ISO before storing. Trips are kept sorted and compared
   as plain strings, which only holds if they all share one format — a client
   sending "2026-05-04T07:15+02:00" would otherwise sort into the wrong place. */
export function addTrip(state, at, pool) {
  const d = at === undefined ? new Date() : new Date(at);
  const iso = (isNaN(d) ? new Date() : d).toISOString();
  const clean = pool ? cleanPool(pool) : null;
  const trip = clean ? { at: iso, pool: clean.id } : { at: iso };
  const trips = [...state.trips, trip].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  /* Every pool that has been visited is kept in state, so a trip's name can be
     resolved from the saved data alone without consulting the built-in list. */
  const pools = clean
    ? [...state.pools.filter((p) => p.id !== clean.id), clean]
    : state.pools;
  return { ...state, trips, pools, rev: state.rev + 1 };
}

export function removeLastTrip(state) {
  if (!state.trips.length) return state;          // no-op, rev unchanged
  return { ...state, trips: state.trips.slice(0, -1), rev: state.rev + 1 };
}

/* Remove one specific trip by its timestamp — what the history view's row
   delete uses. Matches the first identical timestamp and is a no-op if it's
   already gone, so replaying a queued delete twice can't remove two trips. */
export function removeTripAt(state, at) {
  const i = state.trips.findIndex((t) => t.at === at);
  if (i === -1) return state;                    // no-op, rev unchanged
  const trips = state.trips.slice();
  trips.splice(i, 1);
  return { ...state, trips, rev: state.rev + 1 };
}

export function clearTrips(state) {
  if (!state.trips.length) return state;         // no-op, rev unchanged
  return { ...state, trips: [], rev: state.rev + 1 };
}

export function updateSettings(state, patch) {
  return {
    ...state,
    settings: sanitizeSettings({ ...state.settings, ...(patch || {}) }),
    rev: state.rev + 1
  };
}

/* Visits per pool, most visited first, with anything unattributed last. */
export function poolCounts(state) {
  const names = new Map(state.pools.map((p) => [p.id, p.name]));
  const counts = new Map();
  for (const trip of state.trips) {
    const key = trip.pool ?? null;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const rows = [...counts].map(([id, count]) => ({
    id, count, name: id === null ? null : (names.get(id) ?? id)
  }));
  rows.sort((a, b) => (a.id === null) - (b.id === null) || b.count - a.count ||
                      String(a.name).localeCompare(String(b.name)));
  return rows;
}

/* ---- derived figures, also shared with the browser ---- */

export const cardPerTrip = (s) => s.cardPrice / s.cardTrips;
export const costPerTrip = (s, n) => (n > 0 ? s.membership / n : null);
export const breakEvenTrips = (s) => Math.ceil(s.membership / cardPerTrip(s));

/* First trip at which whole cards actually bought would have cost more than
   the membership — cards are paid for up front, not by the trip. */
export function cashBreakEvenTrips(s) {
  const cards = Math.ceil(s.membership / s.cardPrice);
  return (cards - 1) * s.cardTrips + 1;
}
