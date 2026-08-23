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

export function addTrip(state, at = new Date().toISOString()) {
  return { ...state, trips: [...state.trips, at].sort(), rev: state.rev + 1 };
}

export function removeLastTrip(state) {
  if (!state.trips.length) return state;          // no-op, rev unchanged
  return { ...state, trips: state.trips.slice(0, -1), rev: state.rev + 1 };
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
