/* Exchange rates from the ECB via frankfurter.dev — no API key, no account.
   Each backend supplies its own cache; this module owns the fetching and the
   freshness rules so the two can't drift. */

export const WANTED = ['USD', 'PLN'];
export const BASE = 'ISK';

const SOURCE = 'https://api.frankfurter.dev/v1/latest';
const TTL_MS = 12 * 60 * 60 * 1000;        // ECB publishes once a working day
const RETRY_MS = 10 * 60 * 1000;           // but don't sulk for 12h after a blip
const TIMEOUT_MS = 8000;

export const emptyRates = () => ({ base: BASE, rates: null, date: null, fetchedAt: 0 });

/* Stale, or a previous attempt failed and the short retry window has passed. */
export function needsRefresh(cache, now = Date.now()) {
  if (!cache || !cache.fetchedAt) return true;
  const age = now - cache.fetchedAt;
  return cache.rates ? age > TTL_MS : age > RETRY_MS;
}

export async function fetchRates() {
  const url = `${SOURCE}?base=${BASE}&symbols=${WANTED.join(',')}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`rates HTTP ${res.status}`);
  const body = await res.json();

  const rates = {};
  for (const code of WANTED) {
    const v = Number(body?.rates?.[code]);
    if (Number.isFinite(v) && v > 0) rates[code] = v;
  }
  if (!Object.keys(rates).length) throw new Error('rates response had nothing usable');

  return { base: BASE, rates, date: body.date ?? null, fetchedAt: Date.now() };
}

/* Refresh through the supplied cache, and never let a rates outage break the
   app — a failed fetch keeps serving the last good numbers, or none at all. */
export async function refreshThrough(cache, save) {
  if (!needsRefresh(cache)) return cache;
  try {
    const fresh = await fetchRates();
    await save(fresh);
    return fresh;
  } catch (err) {
    console.error('rate fetch failed:', err.message);
    const kept = { ...(cache ?? emptyRates()), fetchedAt: Date.now() };
    await save(kept);          // records the attempt so RETRY_MS applies
    return kept;
  }
}
