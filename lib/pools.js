/* Known pools and the geometry for matching a position to one.
 *
 * Coordinates come from OpenStreetMap (Overpass, August 2026). OSM tags these
 * inconsistently — Laugardalslaug is a `shelter`, Sundhöll Reykjavíkur a
 * `sauna` — so the list is curated by name rather than by tag, and a point is
 * somewhere inside the complex rather than at the door. MATCH_M is generous
 * enough to absorb that.
 *
 * The list is not exhaustive (Árbæjarlaug, for one, is not in OSM under a tag
 * this survey caught). Anything missing is handled by naming it once on the
 * spot: see `pools` in the saved state, which the app appends to.
 *
 * `card: true` marks the three Hafnarfjörður pools the annual card actually
 * covers. Their coordinates were given directly rather than surveyed, and agree
 * with OSM to within 26 m. Everything else can be logged, but only for the log —
 * see countsForCard() in state.js.
 */

export const MATCH_M = 250;

export const BUILT_IN = [
  { id: 'laugardalslaug', name: 'Laugardalslaug', lat: 64.14661, lon: -21.87985 },
  { id: 'vesturbaejarlaug', name: 'Vesturbæjarlaug', lat: 64.14444, lon: -21.96291 },
  { id: 'sundholl-reykjavikur', name: 'Sundhöll Reykjavíkur', lat: 64.14164, lon: -21.91983 },
  { id: 'breidholtslaug', name: 'Breiðholtslaug', lat: 64.10448, lon: -21.81891 },
  { id: 'grafarvogslaug', name: 'Grafarvogslaug', lat: 64.13838, lon: -21.78650 },
  { id: 'dalslaug', name: 'Dalslaug', lat: 64.13225, lon: -21.73660 },
  { id: 'olduselslaug', name: 'Ölduselslaug', lat: 64.09963, lon: -21.84812 },
  { id: 'klebergslaug', name: 'Klébergslaug', lat: 64.23754, lon: -21.82754 },
  { id: 'seltjarnarneslaug', name: 'Seltjarnarneslaug', lat: 64.15040, lon: -21.99191 },
  { id: 'sundlaug-kopavogs', name: 'Sundlaug Kópavogs', lat: 64.11041, lon: -21.91662 },
  { id: 'salalaug', name: 'Salalaug', lat: 64.09195, lon: -21.85602 },
  { id: 'asgardslaug', name: 'Ásgarðslaug', lat: 64.08818, lon: -21.92929 },
  { id: 'alftaneslaug', name: 'Álftaneslaug', lat: 64.10427, lon: -22.01912 },
  { id: 'asvallalaug', name: 'Ásvallalaug', lat: 64.05208, lon: -21.97592, card: true },
  { id: 'sudurbaejarlaug', name: 'Suðurbæjarlaug', lat: 64.05992, lon: -21.96197, card: true },
  { id: 'sundholl-hafnarfjardar', name: 'Sundhöll Hafnarfjarðar', lat: 64.07256, lon: -21.96872, card: true },
  { id: 'lagafellslaug', name: 'Lágafellslaug', lat: 64.16503, lon: -21.72565 },
  { id: 'varmarlaug', name: 'Varmárlaug', lat: 64.17037, lon: -21.68974 }
];

/* Metres between two positions. Haversine — at these distances the difference
   from a proper geodesic is centimetres, far inside MATCH_M. */
export function distanceM(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat), lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/* Every pool the app knows: the built-in survey plus whatever has been named
   on the spot. A saved pool with a built-in id overrides it, so renaming one
   sticks. */
export function allPools(saved = []) {
  const merged = new Map(BUILT_IN.map((p) => [p.id, p]));
  for (const p of saved) {
    if (p && typeof p.id === 'string' && typeof p.name === 'string') merged.set(p.id, p);
  }
  return [...merged.values()];
}

/* Nearest pool within MATCH_M, or null. Nearest rather than first, so
   overlapping radii resolve sensibly. */
export function matchPool(position, saved = []) {
  let best = null;
  for (const pool of allPools(saved)) {
    if (typeof pool.lat !== 'number' || typeof pool.lon !== 'number') continue;
    const d = distanceM(position, pool);
    if (d <= MATCH_M && (!best || d < best.distance)) best = { pool, distance: d };
  }
  return best;
}

/* Stable id from a typed name, with a numeric suffix if it collides. */
export function idFor(name, saved = []) {
  const base = name.trim().toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '') || 'pool';
  const taken = new Set(allPools(saved).map((p) => p.id));
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
}
