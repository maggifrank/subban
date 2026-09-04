/* Shared domain logic. Imported by both the LXC server (serve.js) and the
   Netlify function, so the two backends can never drift apart. Pure functions:
   every operation returns a new state with an incremented `rev`. */

import { BUILT_IN } from './pools.js';

const CARD_POOL_IDS = new Set(BUILT_IN.filter((p) => p.card).map((p) => p.id));

/* `seasonStart` / `seasonEnd` are the dates printed on the annual card, as bare
   YYYY-MM-DD, and either may be set to null for "no bound that side" — a card
   with only a start counts everything from that day on.

   The current card runs 23.08.26 – 23.08.27, both days inclusive. It sits in
   the defaults alongside the card's prices because a save written before this
   existed has no season fields at all, so normalize() fills them in from here:
   the dates apply to the history already on disk without anyone opening ⚙. */
export const DEFAULT_SETTINGS = {
  membership: 36400, cardPrice: 14000, cardTrips: 30,
  seasonStart: '2026-08-23', seasonEnd: '2027-08-23'
};

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
  if (raw.card === true) out.card = true;
  if (Number.isFinite(raw.lat) && Number.isFinite(raw.lon)) {
    out.lat = Number(raw.lat);
    out.lon = Number(raw.lon);
  }
  return out;
}

/* The annual card covers three pools; everything else is logged for the record
   only. A trip counts unless it is attached to a pool known not to be on the
   card — so trips from before pools existed, and any logged with location off,
   keep counting exactly as they did before. Where is only half of it; when is
   the other half, in tripInSeason() below.

   The built-in list is consulted first and wins. A saved pool record written
   before `card` existed has no flag, and trusting the saved copy alone would
   silently stop counting real card swims the moment an older backup was
   restored. Card membership is a property of the card, not of saved state. */
export function poolIsOnCard(id, pools) {
  if (!id) return true;                       // no pool recorded: counts, as it always did
  if (CARD_POOL_IDS.has(id)) return true;
  const pool = pools.find((p) => p.id === id);
  return pool ? pool.card === true : true;    // unknown id: count rather than silently drop
}

/* The local calendar day a trip belongs to — the day it shows as in the history
   and the chart, not the UTC day its instant falls in. */
export const dateKey = (value) => {
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d)) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/* A bare YYYY-MM-DD back as a Date at local midday — the same anchor backdated
   trips use. Parsed as-is it would be UTC midnight, and print as the previous
   day anywhere west of UTC. */
export const dateFromKey = (key) => (key ? new Date(`${key}T12:00:00`) : null);

/* The annual card runs between two dates, and swims outside them were paid for
   some other way — an old multi-trip card before it, next year's membership
   after. Both bounds are inclusive, and an absent bound is no bound, so a card
   with only a start date counts everything from that day on.

   Compared as local calendar dates rather than as instants: the bounds are the
   dates written on the card, and every date this app shows is already the local
   one. A trip with an unreadable timestamp counts, the same way a trip with no
   pool does — the app never silently drops a swim it cannot place. */
export function tripInSeason(trip, settings) {
  const start = settings?.seasonStart ?? null;
  const end = settings?.seasonEnd ?? null;
  if (!start && !end) return true;
  const day = dateKey(tripAt(trip));
  if (day === null) return true;
  return (!start || day >= start) && (!end || day <= end);
}

export const countsForCard = (trip, state) =>
  tripInSeason(trip, state.settings) && poolIsOnCard(trip.pool, state.pools);

export const cardTrips = (state) => state.trips.filter((t) => countsForCard(t, state));

/* Why each trip is or is not on the card, counted in one pass. The two reasons
   are reported separately and never overlap: a trip outside the dates is
   reported as such whatever pool it was at, because "this card did not exist
   yet" is the plainer fact about it than which pool it was. So the three
   numbers always add up to the total. */
export function tripSplit(state) {
  const split = { total: state.trips.length, counted: 0, outsideSeason: 0, offCard: 0 };
  for (const trip of state.trips) {
    if (!tripInSeason(trip, state.settings)) split.outsideSeason++;
    else if (!poolIsOnCard(trip.pool, state.pools)) split.offCard++;
    else split.counted++;
  }
  return split;
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
  /* Null rather than a fallback date: there is no sensible default season, and
     an unparseable one means the card's dates are unknown, which is exactly
     what "no bound" says.

     Checked by round-trip rather than by Date.parse, which is not a validator:
     it takes "2026-02-30" happily and hands back the 2nd of March, so a typo
     would be stored as a real but wrong bound. */
  const day = (v) => {
    if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
    const d = new Date(`${v}T00:00:00Z`);
    return !isNaN(d) && d.toISOString().slice(0, 10) === v ? v : null;
  };
  return {
    membership: num(s.membership, DEFAULT_SETTINGS.membership, 0),
    cardPrice: num(s.cardPrice, DEFAULT_SETTINGS.cardPrice, 0),
    cardTrips: Math.round(num(s.cardTrips, DEFAULT_SETTINGS.cardTrips, 1)),
    seasonStart: day(s.seasonStart),
    seasonEnd: day(s.seasonEnd)
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

/* Attach, change or clear the pool on a trip that already exists. Backdated
   trips never have one — you are not at the pool when you log them — and
   neither does anything recorded before pools existed. */
export function setTripPool(state, at, pool) {
  const i = state.trips.findIndex((t) => t.at === at);
  if (i === -1) return state;                     // gone; nothing to do
  const clean = pool ? cleanPool(pool) : null;
  const nextPool = clean ? clean.id : undefined;
  if ((state.trips[i].pool ?? undefined) === nextPool) return state;   // no-op, rev unchanged
  const trips = state.trips.slice();
  trips[i] = nextPool ? { at: state.trips[i].at, pool: nextPool } : { at: state.trips[i].at };
  const pools = clean
    ? [...state.pools.filter((p) => p.id !== clean.id), clean]
    : state.pools;
  return { ...state, trips, pools, rev: state.rev + 1 };
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
    id, count,
    name: id === null ? null : (names.get(id) ?? id),
    card: poolIsOnCard(id, state.pools)       // same rule the money uses
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
