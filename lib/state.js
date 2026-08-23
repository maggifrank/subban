/* Shared domain logic. Imported by both the LXC server (serve.js) and the
   Netlify function, so the two backends can never drift apart. Pure functions:
   every operation returns a new state with an incremented `rev`. */

export const DEFAULT_SETTINGS = { membership: 36400, cardPrice: 14000, cardTrips: 30 };

export const emptyState = () => ({ trips: [], settings: { ...DEFAULT_SETTINGS }, rev: 0 });

/* Accepts anything that has been sitting in a datastore and returns something
   the rest of the code can trust. */
export function normalize(raw) {
  if (!raw || typeof raw !== 'object') return emptyState();
  const trips = Array.isArray(raw.trips)
    ? raw.trips.filter((t) => typeof t === 'string' && !isNaN(Date.parse(t)))
    : [];
  return {
    trips,
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
export function addTrip(state, at) {
  const d = at === undefined ? new Date() : new Date(at);
  const iso = (isNaN(d) ? new Date() : d).toISOString();
  return { ...state, trips: [...state.trips, iso].sort(), rev: state.rev + 1 };
}

export function removeLastTrip(state) {
  if (!state.trips.length) return state;          // no-op, rev unchanged
  return { ...state, trips: state.trips.slice(0, -1), rev: state.rev + 1 };
}

/* Remove one specific trip by its timestamp — what the history view's row
   delete uses. Matches the first identical timestamp and is a no-op if it's
   already gone, so replaying a queued delete twice can't remove two trips. */
export function removeTripAt(state, at) {
  const i = state.trips.indexOf(at);
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
