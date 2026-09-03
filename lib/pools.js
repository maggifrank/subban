/* Known pools and the geometry for matching a position to one.
 *
 * Coordinates come from OpenStreetMap (Overpass, August 2026). OSM tags these
 * inconsistently — Laugardalslaug is a `shelter`, Sundhöll Reykjavíkur a
 * `sauna` — so the list is curated by name rather than by tag, and a point is
 * somewhere inside the complex rather than at the door. MATCH_M is generous
 * enough to absorb that.
 *
 * Names come from the directory at sundlaugar.is, which has no coordinates at
 * all. Its index page links 100 pools; its own sitemap has 107, so seven —
 * Vík among them — are absent from the listing and were taken from there. Positions were then looked up in OpenStreetMap by name:
 * 54 matched, so those can be detected by location. The rest carry a name and
 * no position — they cannot be auto-detected, but they appear in the picker, so
 * a swim can still be attributed to them from the History list.
 *
 * Anything missing entirely is still handled by naming it once on the spot: see
 * `pools` in the saved state, which the app appends to.
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
  { id: 'grafarvogslaug', name: 'Grafarvogslaug', lat: 64.13838, lon: -21.7865 },
  { id: 'dalslaug', name: 'Dalslaug', lat: 64.13225, lon: -21.7366 },
  { id: 'olduselslaug', name: 'Ölduselslaug', lat: 64.09963, lon: -21.84812 },
  { id: 'klebergslaug', name: 'Klébergslaug', lat: 64.23754, lon: -21.82754 },
  { id: 'seltjarnarneslaug', name: 'Seltjarnarneslaug', lat: 64.1504, lon: -21.99191 },
  { id: 'sundlaug-kopavogs', name: 'Sundlaug Kópavogs', lat: 64.11041, lon: -21.91662 },
  { id: 'salalaug', name: 'Salalaug', lat: 64.09195, lon: -21.85602 },
  { id: 'asgardslaug', name: 'Ásgarðslaug', lat: 64.08818, lon: -21.92929 },
  { id: 'alftaneslaug', name: 'Álftaneslaug', lat: 64.10427, lon: -22.01912 },
  { id: 'asvallalaug', name: 'Ásvallalaug', lat: 64.05208, lon: -21.97592, card: true },
  { id: 'sudurbaejarlaug', name: 'Suðurbæjarlaug', lat: 64.05992, lon: -21.96197, card: true },
  { id: 'sundholl-hafnarfjardar', name: 'Sundhöll Hafnarfjarðar', lat: 64.07256, lon: -21.96872, card: true },
  { id: 'lagafellslaug', name: 'Lágafellslaug', lat: 64.16503, lon: -21.72565 },
  { id: 'varmarlaug', name: 'Varmárlaug', lat: 64.17037, lon: -21.68974 },
  { id: 'arbaejarlaug', name: 'Árbæjarlaug', lat: 64.11216, lon: -21.79489 },
  { id: 'dalvik', name: 'Dalvík', lat: 65.96709, lon: -18.53836 },
  { id: 'geosea-sjobod', name: 'Geosea Sjóböð', lat: 66.05262, lon: -17.36129 },
  { id: 'glerarlaug', name: 'Glerárlaug', lat: 65.68935, lon: -18.11805 },
  { id: 'gudlaug', name: 'Guðlaug', lat: 64.31702, lon: -22.05987 },
  { id: 'gvendarlaug', name: 'Gvendarlaug', lat: 65.78105, lon: -21.52049 },
  { id: 'heidarbaer', name: 'Heiðarbær', lat: 65.88841, lon: -17.31996 },
  { id: 'hellulaug', name: 'Hellulaug', lat: 65.57719, lon: -23.15955 },
  { id: 'holmavik', name: 'Hólmavík', lat: 65.70281, lon: -21.68461 },
  { id: 'hreppslaug', name: 'Hreppslaug', lat: 64.53751, lon: -21.70221 },
  { id: 'ithrottamidstod-eyjafjardarsveitar', name: 'Íþróttamiðstöð Eyjafjarðarsveitar', lat: 65.57329, lon: -18.09118 },
  { id: 'ithrottamidstodin-borgarnesi', name: 'Íþróttamiðstöðin Borgarnesi', lat: 64.54055, lon: -21.92223 },
  { id: 'ithrottamidstodin-kleppjarnsreykjum', name: 'Íþróttamiðstöðin Kleppjárnsreykjum', lat: 64.65516, lon: -21.40108 },
  { id: 'ithrottamidstodin-varmalandi', name: 'Íþróttamiðstöðin Varmalandi', lat: 64.69048, lon: -21.59321 },
  { id: 'landmannalaugar', name: 'Landmannalaugar', lat: 63.99051, lon: -19.06049 },
  { id: 'laugaras-lagoon', name: 'Laugarás Lagoon', lat: 64.11298, lon: -20.50748 },
  { id: 'laugarvatn', name: 'Laugarvatn', lat: 64.21717, lon: -20.73342 },
  { id: 'neslaug', name: 'Neslaug', lat: 64.04325, lon: -20.25152 },
  { id: 'sandgerdi', name: 'Sandgerði', lat: 64.03363, lon: -22.70003 },
  { id: 'saelingsdalslaug', name: 'Sælingsdalslaug', lat: 65.24583, lon: -21.80143 },
  { id: 'skagastrond', name: 'Skagaströnd', lat: 65.82679, lon: -20.32042 },
  { id: 'skogarbodin', name: 'Skógarböðin', lat: 65.66992, lon: -18.0418 },
  { id: 'sky-lagoon', name: 'Sky Lagoon', lat: 64.11647, lon: -21.94644 },
  { id: 'stefanslaug-neskaupsstad', name: 'Stefánslaug, Neskaupsstað', lat: 65.14814, lon: -13.68836 },
  { id: 'sundholl-isafjardar', name: 'Sundhöll Ísafjarðar', lat: 66.07358, lon: -23.11714 },
  { id: 'sundholl-selfoss', name: 'Sundhöll Selfoss', lat: 63.93563, lon: -20.99817 },
  { id: 'sundholl-seydisfjardar', name: 'Sundhöll Seyðisfjarðar', lat: 65.2593, lon: -14.00564 },
  { id: 'sundlaug-akureyrar', name: 'Sundlaug Akureyrar', lat: 65.67909, lon: -18.09813 },
  { id: 'sundlaug-grindavikur', name: 'Sundlaug Grindavíkur', lat: 63.8439, lon: -22.43152 },
  { id: 'sundlaug-hafnar', name: 'Sundlaug Hafnar', lat: 64.25397, lon: -15.20849 },
  { id: 'sundlaug-husavikur', name: 'Sundlaug Húsavíkur', lat: 66.04927, lon: -17.34667 },
  { id: 'sundlaugin-ad-hlodum', name: 'Sundlaugin að Hlöðum', lat: 64.41077, lon: -21.60866 },
  { id: 'sundlaugin-breiddalsvik', name: 'Sundlaugin Breiðdalsvík', lat: 64.7946, lon: -14.00091 },
  { id: 'sundlaugin-laugalandi', name: 'Sundlaugin Laugalandi', lat: 63.91595, lon: -20.4166 },
  { id: 'sundlaugin-laugaskardi', name: 'Sundlaugin Laugaskarði', lat: 64.00159, lon: -21.17983 },
  { id: 'varmahlid', name: 'Varmahlíð', lat: 65.55336, lon: -19.4509 },
  { id: 'blue-lagoon', name: 'Blue Lagoon' },
  { id: 'bolungarvik', name: 'Bolungarvík' },
  { id: 'borg-grimsnesi', name: 'Borg, Grímsnesi' },
  { id: 'eskifjordur', name: 'Eskifjörður' },
  { id: 'faskrudsfjordur', name: 'Fáskrúðsfjörður' },
  { id: 'flateyri', name: 'Flateyri' },
  { id: 'fludir', name: 'Flúðir' },
  { id: 'grenivikurlaug', name: 'Grenivíkurlaug' },
  { id: 'grundarfjordur', name: 'Grundarfjörður' },
  { id: 'hella', name: 'Hella' },
  { id: 'heydalur', name: 'Heydalur' },
  { id: 'hofsos', name: 'Hofsós' },
  { id: 'hraunsnef', name: 'Hraunsnef' },
  { id: 'hrisey', name: 'Hrísey' },
  { id: 'hvammsvik', name: 'Hvammsvík' },
  { id: 'hvolsvollur', name: 'Hvolsvöllur' },
  { id: 'illugastadir', name: 'Illugastaðir' },
  { id: 'ithrottamidstod-fjallabyggdar-olafsfirdi', name: 'Íþróttamiðstöð Fjallabyggðar – Ólafsfirði' },
  { id: 'ithrottamidstod-fjallabyggdar-siglufirdi', name: 'Íþróttamiðstöð Fjallabyggðar – Siglufirði' },
  { id: 'ithrottamidstodin-budardal', name: 'Íþróttamiðstöðin Búðardal' },
  { id: 'ithrottamidstodin-i-reykholti', name: 'Íþróttamiðstöðin í Reykholti' },
  { id: 'kirkjubaejarklaustur', name: 'Kirkjubæjarklaustur' },
  { id: 'lysulaugar', name: 'Lýsulaugar' },
  { id: 'olafsvik', name: 'Ólafsvík' },
  { id: 'patreksfjordur', name: 'Patreksfjörður' },
  { id: 'raufarhofn', name: 'Raufarhöfn' },
  { id: 'reydarfjordur', name: 'Reyðarfjörður' },
  { id: 'reykjanesbaer-njardvik', name: 'Reykjanesbær – Njarðvík' },
  { id: 'reykjanesbaer-vatnaverold', name: 'Reykjanesbær – Vatnaveröld' },
  { id: 'saudarkrokur', name: 'Sauðárkrókur' },
  { id: 'skeidalaug', name: 'Skeiðalaug' },
  { id: 'solgardar-i-fljotum', name: 'Sólgarðar í Fljótum' },
  { id: 'stapalaug', name: 'Stapalaug' },
  { id: 'stodvarfjordur', name: 'Stöðvarfjörður' },
  { id: 'stokkseyri', name: 'Stokkseyri' },
  { id: 'stykkisholmur', name: 'Stykkishólmur' },
  { id: 'sudureyri', name: 'Suðureyri' },
  { id: 'sundlaug-grimseyjar', name: 'Sundlaug Grímseyjar' },
  { id: 'sundlaugin-blonduosi', name: 'Sundlaugin Blönduósi' },
  { id: 'sundlaugin-egilsstodum', name: 'Sundlaugin Egilsstöðum' },
  { id: 'sundlaugin-gardi', name: 'Sundlaugin Garði' },
  { id: 'sundlaugin-hvammstanga', name: 'Sundlaugin Hvammstanga' },
  { id: 'sundlaugin-laugum', name: 'Sundlaugin Laugum' },
  { id: 'sundlaugin-thingeyri', name: 'Sundlaugin Þingeyri' },
  { id: 'talknafjordur', name: 'Tálknafjörður' },
  { id: 'vestmannaeyjar', name: 'Vestmannaeyjar' },
  { id: 'thelamerkurlaug', name: 'Þelamerkurlaug', lat: 65.74235, lon: -18.28119 },
  { id: 'thorlakshofn', name: 'Þorlákshöfn', lat: 63.8524, lon: -21.38197 },
  { id: 'vik', name: 'Vík', lat: 63.4169, lon: -19.008 },
  { id: 'vogar-vatnsleysustrond', name: 'Vogar, Vatnsleysuströnd', lat: 63.98489, lon: -22.38178 },
  { id: 'vok-baths', name: 'Vök Baths', lat: 65.30307, lon: -14.44724 },
  { id: 'vopnafjordur-selardalur', name: 'Vopnafjörður – Selárdalur', lat: 65.80154, lon: -14.91057 },
  { id: 'ylstrondin-nautholsvik', name: 'Ylströndin, Nauthólsvík', lat: 64.12129, lon: -21.92927 }
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
