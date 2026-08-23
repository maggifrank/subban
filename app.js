/* Sund — swim trip tracker. No dependencies, no build step. */

const STORAGE_KEY = 'sund.v1';

const DEFAULTS = {
  membership: 36400,   // yearly membership, kr
  cardPrice: 14000,    // price of one multi-trip card, kr
  cardTrips: 30        // trips on that card
};

/* ---------- state ---------- */

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!raw || typeof raw !== 'object') throw 0;
    return {
      trips: Array.isArray(raw.trips) ? raw.trips : [],
      settings: { ...DEFAULTS, ...(raw.settings || {}) }
    };
  } catch {
    return { trips: [], settings: { ...DEFAULTS } };
  }
}

let state = load();

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 1, ...state }));
}

/* ---------- math ---------- */

// What each trip has effectively cost: the membership spread over the trips taken.
const costPerTrip = (m, n) => (n > 0 ? m / n : null);

// A card's per-trip value, e.g. 14.000 / 30 = 466,67 kr.
const cardPerTrip = (s) => s.cardPrice / s.cardTrips;

// Pro-rated break-even: trips at which membership matches card value spent.
const breakEvenTrips = (s) => Math.ceil(s.membership / cardPerTrip(s));

// Cash break-even: first trip at which you'd actually have *paid out* more in
// whole cards than the membership cost, since cards are bought in one go.
function cashBreakEvenTrips(s) {
  const cards = Math.ceil(s.membership / s.cardPrice);
  return (cards - 1) * s.cardTrips + 1;
}

/* ---------- formatting ---------- */

// Icelandic grouping (36.400) written out by hand — browsers in the LXC may not
// ship is-IS locale data, and Intl silently falls back to en-US commas.
function group(n) {
  return String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
const kr = (v) => `${group(v)} kr`;
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function formatDate(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/* ---------- elements ---------- */

const el = (id) => document.getElementById(id);
const ui = {
  trips: el('trips'), lastSwim: el('last-swim'),
  plus: el('plus'), minus: el('minus'),
  costPerTrip: el('cost-per-trip'), costPerTripSub: el('cost-per-trip-sub'),
  progressFill: el('progress-fill'), breakevenLine: el('breakeven-line'), breakevenNote: el('breakeven-note'),
  cardPerTrip: el('card-per-trip'), cardPerTripSub: el('card-per-trip-sub'),
  delta: el('delta'), deltaSub: el('delta-sub'),
  settings: el('settings'), settingsToggle: el('settings-toggle'),
  inMembership: el('in-membership'), inCardPrice: el('in-card-price'), inCardTrips: el('in-card-trips'),
  exportBtn: el('export'), resetBtn: el('reset')
};

/* ---------- render ---------- */

function render() {
  const s = state.settings;
  const n = state.trips.length;
  const be = breakEvenTrips(s);
  const cashBe = cashBreakEvenTrips(s);
  const perCardTrip = cardPerTrip(s);

  ui.trips.textContent = n;
  ui.minus.disabled = n === 0;
  ui.lastSwim.textContent = n ? `Last swim ${formatDate(state.trips[n - 1])}` : 'No trips logged yet';

  // Cost per trip so far
  const cpt = costPerTrip(s.membership, n);
  ui.costPerTrip.textContent = cpt === null ? '—' : kr(cpt);
  ui.costPerTrip.classList.toggle('is-empty', cpt === null);
  ui.costPerTripSub.textContent = cpt === null
    ? `${kr(s.membership)} membership, not used yet`
    : `${kr(s.membership)} ÷ ${plural(n, 'trip')}`;

  // Break-even
  ui.progressFill.style.width = `${Math.min(100, (n / be) * 100)}%`;
  if (n >= be) {
    ui.breakevenLine.textContent = n === be
      ? 'Broken even exactly — the next trip is free'
      : `Broken even — ${plural(n - be, 'trip')} of pure profit`;
  } else {
    ui.breakevenLine.textContent = n === 0
      ? `${plural(be, 'trip')} to break even`
      : `${plural(be - n, 'trip')} to go — ${be} in total`;
  }
  ui.breakevenNote.textContent =
    `A ${s.cardTrips}-trip card works out at ${kr(perCardTrip)} per trip, so the membership pays for ` +
    `itself at ${be} trips. Counting whole cards actually bought, you'd have overpaid from trip ${cashBe} ` +
    `(that's when a ${Math.ceil(s.membership / s.cardPrice)}${nth(Math.ceil(s.membership / s.cardPrice))} card is needed).`;

  // Stats
  ui.cardPerTrip.textContent = kr(perCardTrip);
  ui.cardPerTripSub.textContent = `${kr(s.cardPrice)} ÷ ${s.cardTrips} trips`;

  const delta = perCardTrip * n - s.membership;
  ui.delta.textContent = (delta >= 0 ? '+' : '−') + kr(Math.abs(delta));
  ui.delta.classList.toggle('is-good', delta >= 0);
  ui.delta.classList.toggle('is-bad', delta < 0);
  ui.deltaSub.textContent = delta >= 0 ? 'saved vs cards' : 'still to earn back';

  // Settings inputs
  ui.inMembership.value = s.membership;
  ui.inCardPrice.value = s.cardPrice;
  ui.inCardTrips.value = s.cardTrips;
}

function nth(k) {
  const t = k % 10, h = k % 100;
  if (t === 1 && h !== 11) return 'st';
  if (t === 2 && h !== 12) return 'nd';
  if (t === 3 && h !== 13) return 'rd';
  return 'th';
}

/* ---------- actions ---------- */

function addTrip() {
  state.trips.push(new Date().toISOString());
  save(); render();
}

function removeTrip() {
  if (!state.trips.length) return;
  state.trips.pop();
  save(); render();
}

ui.plus.addEventListener('click', addTrip);
ui.minus.addEventListener('click', removeTrip);

document.addEventListener('keydown', (e) => {
  if (e.target.matches('input')) return;
  if (e.key === '+' || e.key === '=' || e.key === 'ArrowUp') { addTrip(); e.preventDefault(); }
  if (e.key === '-' || e.key === 'ArrowDown') { removeTrip(); e.preventDefault(); }
});

ui.settingsToggle.addEventListener('click', () => {
  const open = ui.settings.hidden;
  ui.settings.hidden = !open;
  ui.settingsToggle.setAttribute('aria-expanded', String(open));
});

for (const [input, key, min] of [
  [ui.inMembership, 'membership', 0],
  [ui.inCardPrice, 'cardPrice', 0],
  [ui.inCardTrips, 'cardTrips', 1]
]) {
  input.addEventListener('change', () => {
    const v = Number(input.value);
    if (!Number.isFinite(v) || v < min) { render(); return; }
    state.settings[key] = v;
    save(); render();
  });
}

ui.resetBtn.addEventListener('click', () => {
  if (!confirm(`Delete all ${plural(state.trips.length, 'trip')}? This cannot be undone.`)) return;
  state.trips = [];
  save(); render();
});

ui.exportBtn.addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({ v: 1, ...state }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `sund-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

render();
