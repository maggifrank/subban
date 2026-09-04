/* Sund front end. The count lives on the server so every device sees the same
   number; taps apply optimistically and sync in the background, so the app
   still works with a phone in a pool changing room on one bar of signal. */

import {
  emptyState, normalize, addTrip, removeLastTrip, removeTripAt, clearTrips, updateSettings,
  costPerTrip, cardPerTrip, breakEvenTrips, cashBreakEvenTrips, poolCounts, tripAt, cardTrips,
  setTripPool, poolIsOnCard
} from './lib/state.js';
import {
  LANGS, LANG_NAMES, DEFAULT_LANG, detectLang, t, plural, ordinal, formatDate, formatTime
} from './lib/i18n.js';
import { money, isConverted, rateString, currencyFor } from './lib/money.js';
import { chartHTML, chartSignature, bindChartTooltip, monthKey } from './lib/chart.js';
import { matchPool, idFor, allPools } from './lib/pools.js';
import { renderPoolTable } from './lib/pooltable.js';

const CACHE_KEY = 'sund.cache.v2';
const TOKEN_KEY = 'sund.token';
const LANG_KEY = 'sund.lang';
const POLL_MS = 15000;
const RATES_MS = 30 * 60 * 1000;   // the server caches for 12h; this is just a nudge

/* The app was called "subban" for a while; carry a device's existing
   preferences and any queued offline taps across to the current key names once,
   so the rename does not quietly drop swims that had not synced yet. Written
   out by hand rather than renamed with everything else: a blind substitution
   would make `from` and `to` identical, and the removeItem below would then
   delete the live value on every load. */
function migrateStorageKeys() {
  const moves = [['subban.cache.v2', CACHE_KEY], ['subban.token', TOKEN_KEY], ['subban.lang', LANG_KEY]];
  for (const [from, to] of moves) {
    if (from === to) continue;
    const old = localStorage.getItem(from);
    if (old !== null && localStorage.getItem(to) === null) localStorage.setItem(to, old);
    localStorage.removeItem(from);
  }
}
migrateStorageKeys();

let confirmed = emptyState();
let queue = [];
let token = localStorage.getItem(TOKEN_KEY) || '';
let lang = detectLang();
let rates = null;         // whatever /api/rates last returned, or null
let position = null;      // latest fix, or null if unavailable/denied
let locating = false;
let geoWatch = null;
let status = 'syncing';   // syncing | synced | offline | locked | error
let lastError = '';
let flushing = false;

/* ---------- cache (offline fallback only, never the source of truth) ---------- */

function loadCache() {
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY));
    if (!raw) return;
    confirmed = normalize(raw.confirmed);
    queue = Array.isArray(raw.queue) ? raw.queue : [];
  } catch { /* start empty */ }
}

const saveCache = () =>
  localStorage.setItem(CACHE_KEY, JSON.stringify({ confirmed, queue }));

/* ---------- optimistic view ---------- */

const OPS = {
  add: (s, op) => addTrip(s, op.at, op.pool),
  remove: (s) => removeLastTrip(s),
  removeAt: (s, op) => removeTripAt(s, op.at),
  setPool: (s, op) => setTripPool(s, op.at, op.pool),
  clear: (s) => clearTrips(s),
  settings: (s, op) => updateSettings(s, op.patch)
};

const view = () => queue.reduce((s, op) => OPS[op.kind](s, op), confirmed);

/* ---------- network ---------- */

async function api(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (res.status === 401) throw Object.assign(new Error('locked'), { locked: true });
  if (res.status >= 400 && res.status < 500) {
    // The server will refuse this one however often we ask. Retrying it would
    // jam the queue and every change behind it, so mark it as fatal.
    const detail = await res.json().catch(() => ({}));
    throw Object.assign(new Error(detail.error || `Rejected (${res.status})`), { fatal: true });
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const REQUESTS = {
  add: (op) => api('POST', '/api/trips', op.pool ? { at: op.at, pool: op.pool } : { at: op.at }),
  remove: () => api('DELETE', '/api/trips/last'),
  removeAt: (op) => api('DELETE', '/api/trips/one', { at: op.at }),
  setPool: (op) => api('PUT', '/api/trips/one/pool', { at: op.at, pool: op.pool ?? null }),
  clear: () => api('DELETE', '/api/trips'),
  settings: (op) => api('PUT', '/api/settings', op.patch)
};

async function flush() {
  if (flushing || !queue.length) return;
  flushing = true;
  setStatus('syncing');
  try {
    while (queue.length) {
      const op = queue[0];
      try {
        confirmed = normalize(await REQUESTS[op.kind](op));
      } catch (err) {
        if (!err.fatal) throw err;
        queue.shift();          // drop it and keep going, rather than jam
        saveCache();
        lastError = err.message;
        setStatus('error');
        render();
        continue;
      }
      queue.shift();
      saveCache();
      render();
    }
    if (status !== 'error') setStatus('synced');
  } catch (err) {
    setStatus(err.locked ? 'locked' : 'offline');
    if (err.locked) askForToken();
  } finally {
    flushing = false;
    render();
  }
}

function enqueue(op) {
  queue.push(op);
  saveCache();
  render();
  flush();
}

async function poll({ force = false } = {}) {
  if (queue.length || flushing) return;
  if (document.hidden && !force) return;
  try {
    const next = normalize(await api('GET', '/api/state'));
    if (next.rev !== confirmed.rev) {
      confirmed = next;
      saveCache();
    }
    setStatus('synced');
    render();
  } catch (err) {
    setStatus(err.locked ? 'locked' : 'offline');
    if (err.locked) askForToken();
    render();
  }
}

/* ---------- elements ---------- */

const el = (id) => document.getElementById(id);
const ui = {
  trips: el('trips'), lastSwim: el('last-swim'), plus: el('plus'), minus: el('minus'),
  beLabel: el('be-label'),
  costPerTrip: el('cost-per-trip'), costPerTripSub: el('cost-per-trip-sub'),
  progressFill: el('progress-fill'), breakevenLine: el('breakeven-line'), breakevenNote: el('breakeven-note'),
  cardPerTrip: el('card-per-trip'), cardPerTripSub: el('card-per-trip-sub'),
  delta: el('delta'), deltaSub: el('delta-sub'),
  sync: el('sync'), syncText: el('sync-text'), langSelect: el('lang-select'),
  rateNote: el('rate-note'), here: el('here'), poolTable: el('pool-table'), offCard: el('off-card'),
  chart: el('chart'),
  historyToggle: el('history-toggle'), historyPanel: el('history-panel'), historyBody: el('history-body'),
  historySummary: el('history-summary'),
  backdate: el('backdate'), backdateDate: el('backdate-date'), backdateError: el('backdate-error'),
  settings: el('settings'), settingsToggle: el('settings-toggle'),
  inMembership: el('in-membership'), inCardPrice: el('in-card-price'), inCardTrips: el('in-card-trips'),
  exportBtn: el('export'), resetBtn: el('reset')
};

/* ---------- language ---------- */

/* Fills every element carrying a data-i18n hook. Called on load and on switch,
   so no string is duplicated between the markup and here. */
function applyStaticStrings() {
  document.documentElement.lang = lang;
  for (const node of document.querySelectorAll('[data-i18n]')) {
    node.textContent = t(lang, node.dataset.i18n);
  }
  for (const node of document.querySelectorAll('[data-i18n-aria]')) {
    node.setAttribute('aria-label', t(lang, node.dataset.i18nAria));
  }
  for (const node of document.querySelectorAll('[data-i18n-title]')) {
    node.setAttribute('title', t(lang, node.dataset.i18nTitle));
  }
}

function setLang(next) {
  if (!LANGS.includes(next)) return;
  lang = next;
  localStorage.setItem(LANG_KEY, lang);
  ui.langSelect.value = lang;
  applyStaticStrings();
  historySig = null;        // month names and plurals changed; force a rebuild
  chartSig = null;
  render();
}

/* ---------- status pill ---------- */

function setStatus(next) {
  status = next;
  ui.sync.dataset.status = next;
  const text = next === 'error'
    ? (lastError || t(lang, 'sync.error'))
    : (() => {
        const base = t(lang, `sync.${next}`);
        return queue.length && next !== 'synced'
          ? t(lang, 'sync.pending', { status: base, changes: plural(lang, queue.length, 'change') })
          : base;
      })();
  ui.syncText.textContent = text;
  ui.sync.title = text;
}

/* Say plainly that a number has been converted, and at what rate — the prices
   on screen are not the prices on the till receipt. */
function renderRateNote() {
  const wantsConversion = currencyFor(lang) !== 'ISK';
  if (!wantsConversion) {
    ui.rateNote.hidden = true;
    ui.rateNote.textContent = '';
    return;
  }
  ui.rateNote.hidden = false;
  ui.rateNote.textContent = isConverted(lang, rates)
    ? t(lang, 'rate.note', {
        date: formatDate(lang, `${rates.date}T12:00:00Z`, 'full'),
        rate: rateString(lang, rates),
        code: currencyFor(lang)
      })
    : t(lang, 'rate.unavailable');
}

async function loadRates() {
  try {
    rates = await api('GET', '/api/rates');
  } catch {
    rates = null;             // stay in ISK rather than invent a rate
  }
  render();
}

/* ---------- where am I ---------- */

/* A position is kept warm while the app is on screen, so tapping + can resolve
   the pool immediately instead of making the count wait on a GPS fix. The watch
   stops when the page is hidden — this runs on a phone in a swim bag. */
function startWatching() {
  if (geoWatch !== null || !navigator.geolocation) return;
  locating = true;
  render();
  geoWatch = navigator.geolocation.watchPosition(
    (pos) => {
      locating = false;
      position = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      render();
    },
    () => {                       // denied, unavailable, or timed out
      locating = false;
      position = null;
      render();
    },
    { enableHighAccuracy: false, maximumAge: 60000, timeout: 15000 }
  );
}

function stopWatching() {
  if (geoWatch === null) return;
  navigator.geolocation.clearWatch(geoWatch);
  geoWatch = null;
}

const poolHere = () => (position ? matchPool(position, view().pools)?.pool ?? null : null);

function renderHere() {
  const state = ui.here;
  if (!navigator.geolocation) { state.hidden = true; return; }
  state.hidden = false;
  if (locating && !position) {
    state.dataset.state = 'locating';
    state.textContent = t(lang, 'pool.locating');
    return;
  }
  if (!position) {
    state.dataset.state = 'off';
    state.textContent = t(lang, 'pool.off');
    return;
  }
  const pool = poolHere();
  state.dataset.state = pool ? 'here' : 'away';
  state.textContent = pool ? t(lang, 'pool.here', { name: pool.name }) : t(lang, 'pool.away');
}

/* ---------- pool table ---------- */

function renderPools(state) {
  renderPoolTable(ui.poolTable, lang, poolCounts(state));
}

/* ---------- chart: trips per month ---------- */

let chartSig = null;

function renderChart(trips) {
  const sig = chartSignature(lang, trips);
  if (sig === chartSig) return;
  chartSig = sig;
  ui.chart.innerHTML = chartHTML(lang, trips);
}

/* ---------- history ---------- */

const isBackdated = (d) =>
  d.getHours() === 12 && d.getMinutes() === 0 && d.getSeconds() === 0 && d.getMilliseconds() === 0;

let historySig = null;

function renderHistory(trips, state) {
  ui.historySummary.textContent = trips.length
    ? t(lang, 'history.summary', {
        trips: plural(lang, trips.length, 'trip'),
        date: formatDate(lang, tripAt(trips[trips.length - 1]), 'full')
      })
    : t(lang, 'history.none');

  const sig = lang + '|' + trips.map((x) => `${tripAt(x)}~${x.pool ?? ''}`).join('|');
  if (ui.historyPanel.hidden || sig === historySig) return;
  historySig = sig;

  if (!trips.length) {
    ui.historyBody.innerHTML = `<p class="history-empty">${t(lang, 'history.empty')}</p>`;
    return;
  }

  const frag = document.createDocumentFragment();
  let openMonth = null;

  trips.forEach((trip, i) => {
    const iso = tripAt(trip);
    const d = new Date(iso);
    const key = monthKey(d);
    if (key !== openMonth) {
      openMonth = key;
      const head = document.createElement('div');
      head.className = 'month';
      const n = trips.filter((x) => monthKey(new Date(tripAt(x))) === key).length;
      head.innerHTML = `<span></span><span class="month-count"></span>`;
      head.firstChild.textContent = formatDate(lang, d, 'month');
      head.lastChild.textContent = plural(lang, n, 'trip');
      frag.append(head);
    }

    const row = document.createElement('div');
    row.className = 'trip-row';
    row.innerHTML = `<span class="n"></span>` +
                    `<span class="when"><span class="line"><span class="date"></span><span class="time"></span></span>` +
                    `<button class="row-pool" type="button"></button></span>` +
                    `<button class="row-del" type="button">×</button>`;
    row.querySelector('.n').textContent = `#${i + 1}`;
    row.querySelector('.date').textContent = formatDate(lang, d, 'day');
    row.querySelector('.time').textContent = isBackdated(d) ? '' : formatTime(d);

    const poolBtn = row.querySelector('.row-pool');
    const poolName = trip.pool
      ? (state.pools.find((p) => p.id === trip.pool)?.name ?? trip.pool)
      : null;
    poolBtn.textContent = poolName ?? t(lang, 'pool.setOn');
    poolBtn.classList.toggle('is-unset', !poolName);
    poolBtn.classList.toggle('is-off-card', Boolean(trip.pool) && !poolIsOnCard(trip.pool, state.pools));
    poolBtn.dataset.at = iso;
    const del = row.querySelector('.row-del');
    del.dataset.at = iso;
    del.setAttribute('aria-label', t(lang, 'history.removeAria', { date: formatDate(lang, d, 'day') }));
    frag.append(row);
  });

  const rows = [...frag.children];
  ui.historyBody.replaceChildren();
  ui.historyBody.append(...reverseKeepingMonths(rows));
}

function reverseKeepingMonths(nodes) {
  const groups = [];
  for (const node of nodes) {
    if (node.classList.contains('month')) groups.push([node]);
    else groups[groups.length - 1].push(node);
  }
  return groups.reverse().flatMap(([head, ...rows]) => [head, ...rows.reverse()]);
}

/* ---------- render ---------- */

function render() {
  const state = view();
  const s = state.settings;
  /* Only the three pools the card covers pay it off. Everything else is logged
     for the record — it shows in the chart, the history and the pool table, but
     never in the money. */
  const counting = cardTrips(state);
  const n = counting.length;
  const offCard = state.trips.length - n;
  const be = breakEvenTrips(s);
  const cashBe = cashBreakEvenTrips(s);
  const perCardTrip = cardPerTrip(s);
  const cards = Math.ceil(s.membership / s.cardPrice);

  ui.trips.textContent = n;
  ui.minus.disabled = n === 0;
  ui.lastSwim.textContent = state.trips.length
    ? t(lang, 'counter.lastSwim', { date: formatDate(lang, tripAt(state.trips[state.trips.length - 1]), 'full') })
    : t(lang, 'counter.none');
  /* The big number is card swims only, so state the total outright rather than
     leaving it to be inferred from the difference. */
  const total = state.trips.length;
  ui.offCard.hidden = total === 0;
  ui.offCard.textContent = offCard
    ? `${t(lang, 'counter.total', { trips: plural(lang, total, 'trip') })} · ${t(lang, 'counter.offCard', { trips: plural(lang, offCard, 'trip') })}`
    : t(lang, 'counter.total', { trips: plural(lang, total, 'trip') });

  const cpt = costPerTrip(s, n);
  ui.costPerTrip.textContent = cpt === null ? '—' : money(lang, cpt, rates);
  ui.costPerTrip.classList.toggle('is-empty', cpt === null);
  ui.costPerTripSub.textContent = cpt === null
    ? t(lang, 'cost.unused', { total: money(lang, s.membership, rates) })
    : t(lang, 'cost.sub', { total: money(lang, s.membership, rates), trips: plural(lang, n, 'trip') });

  ui.beLabel.textContent = t(lang, 'be.label', { n: s.cardTrips });
  ui.progressFill.style.width = `${Math.min(100, (n / be) * 100)}%`;
  if (n >= be) {
    ui.breakevenLine.textContent = n === be
      ? t(lang, 'be.exact')
      : t(lang, 'be.past', { trips: plural(lang, n - be, 'trip') });
  } else {
    ui.breakevenLine.textContent = n === 0
      ? t(lang, 'be.start', { trips: plural(lang, be, 'trip') })
      : t(lang, 'be.toGo', { left: plural(lang, be - n, 'trip'), total: be });
  }
  ui.breakevenNote.textContent = t(lang, 'be.note', {
    cardTrips: s.cardTrips, perTrip: money(lang, perCardTrip, rates), be, cashBe,
    cards: ordinal(lang, cards)      // "3." in is/pl, "3rd" in en
  });

  ui.cardPerTrip.textContent = money(lang, perCardTrip, rates);
  ui.cardPerTripSub.textContent = t(lang, 'stat.cardPerTripSub', {
    price: money(lang, s.cardPrice, rates), trips: plural(lang, s.cardTrips, 'trip')
  });

  const delta = perCardTrip * n - s.membership;
  ui.delta.textContent = (delta >= 0 ? '+' : '−') + money(lang, Math.abs(delta), rates);
  ui.delta.classList.toggle('is-good', delta >= 0);
  ui.delta.classList.toggle('is-bad', delta < 0);
  ui.deltaSub.textContent = delta >= 0 ? t(lang, 'stat.saved') : t(lang, 'stat.owed');

  renderRateNote();
  renderHere();
  renderPools(state);
  renderChart(state.trips);
  renderHistory(state.trips, state);

  if (document.activeElement !== ui.inMembership) ui.inMembership.value = s.membership;
  if (document.activeElement !== ui.inCardPrice) ui.inCardPrice.value = s.cardPrice;
  if (document.activeElement !== ui.inCardTrips) ui.inCardTrips.value = s.cardTrips;

  setStatus(status);
}

/* ---------- actions ---------- */

ui.plus.addEventListener('click', () => {
  const op = { kind: 'add', at: new Date().toISOString() };
  const pool = poolHere();
  if (pool) {
    op.pool = pool;
  } else if (position) {
    /* Somewhere the app does not know. Name it once and it is recognised from
       then on — which is how pools missing from the built-in survey get in. */
    const name = prompt(t(lang, 'pool.newPrompt'), '');
    if (name && name.trim()) {
      op.pool = { id: idFor(name, view().pools), name: name.trim(), lat: position.lat, lon: position.lon };
    }
  }
  enqueue(op);
});
ui.minus.addEventListener('click', () => {
  if (view().trips.length) enqueue({ kind: 'remove' });
});

document.addEventListener('keydown', (e) => {
  if (e.target.matches('input')) return;
  if (e.key === '+' || e.key === '=' || e.key === 'ArrowUp') { ui.plus.click(); e.preventDefault(); }
  if (e.key === '-' || e.key === 'ArrowDown') { ui.minus.click(); e.preventDefault(); }
});

/* Each option is written in its own language, so it is readable to the person
   looking for it regardless of which one is currently active. */
for (const code of LANGS) {
  const opt = document.createElement('option');
  opt.value = code;
  opt.textContent = LANG_NAMES[code];
  ui.langSelect.append(opt);
}
ui.langSelect.addEventListener('change', () => {
  setLang(ui.langSelect.value);
  if (!rates && currencyFor(lang) !== 'ISK') loadRates();   // retry for the new currency
});

ui.historyToggle.addEventListener('click', () => {
  const open = ui.historyPanel.hidden;
  ui.historyPanel.hidden = !open;
  ui.historyToggle.setAttribute('aria-expanded', String(open));
  if (open) { historySig = null; render(); }
});

function todayISODate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

ui.backdateDate.max = todayISODate();

ui.backdate.addEventListener('submit', (e) => {
  e.preventDefault();
  const [y, m, d] = ui.backdateDate.value.split('-').map(Number);
  if (!y || !m || !d) return showBackdateError(t(lang, 'backdate.noDate'));

  /* Anchored at local midday. Midnight round-trips fine in the timezone that
     logged it, but stored as 00:00Z it reads as the *previous day* on a device
     anywhere west of UTC. Midday leaves ~12 hours of slack either way. */
  const when = new Date(y, m - 1, d, 12, 0, 0, 0);
  if (when > new Date()) return showBackdateError(t(lang, 'backdate.future'));

  showBackdateError(null);
  ui.backdateDate.value = '';
  enqueue({ kind: 'add', at: when.toISOString() });
});

function showBackdateError(msg) {
  ui.backdateError.textContent = msg || '';
  ui.backdateError.hidden = !msg;
}

ui.historyBody.addEventListener('click', (e) => {
  const del = e.target.closest('.row-del');
  if (del) { enqueue({ kind: 'removeAt', at: del.dataset.at }); return; }
  const poolBtn = e.target.closest('.row-pool');
  if (poolBtn) openPoolPicker(poolBtn);
});

/* One picker at a time, swapped in place of the tapped label. Every pool the
   app knows about, plus an option to detach — which is how a mis-assigned trip
   gets put back. */
function openPoolPicker(button) {
  const at = button.dataset.at;
  const current = view().trips.find((x) => x.at === at)?.pool ?? '';
  const select = document.createElement('select');
  select.className = 'row-pool-select';

  const none = document.createElement('option');
  none.value = '';
  none.textContent = t(lang, 'pool.noneOption');
  select.append(none);

  for (const pool of allPools(view().pools).sort((a, b) => a.name.localeCompare(b.name))) {
    const opt = document.createElement('option');
    opt.value = pool.id;
    opt.textContent = pool.card ? pool.name : `${pool.name} · ${t(lang, 'pool.forFun')}`;
    select.append(opt);
  }
  select.value = current;

  const commit = () => {
    const chosen = select.value
      ? allPools(view().pools).find((p) => p.id === select.value) ?? null
      : null;
    historySig = null;                       // the row must be rebuilt either way
    enqueue({ kind: 'setPool', at, pool: chosen });
  };
  select.addEventListener('change', commit);
  select.addEventListener('blur', () => { historySig = null; render(); });

  button.replaceWith(select);
  select.focus();
  if (typeof select.showPicker === 'function') { try { select.showPicker(); } catch { /* not allowed here */ } }
}

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
    enqueue({ kind: 'settings', patch: { [key]: v } });
  });
}

ui.resetBtn.addEventListener('click', () => {
  const n = view().trips.length;
  if (!n) return;
  if (!confirm(t(lang, 'settings.resetConfirm', { trips: plural(lang, n, 'trip') }))) return;
  enqueue({ kind: 'clear' });
});

ui.exportBtn.addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(view(), null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `sund-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

ui.sync.addEventListener('click', () => {
  lastError = '';
  if (status === 'error') setStatus('syncing');
  queue.length ? flush() : poll({ force: true });
});

function askForToken() {
  const entered = prompt(t(lang, 'settings.tokenPrompt'), '');
  if (entered === null) return;
  token = entered.trim();
  localStorage.setItem(TOKEN_KEY, token);
  queue.length ? flush() : poll({ force: true });
}

/* ---------- start ---------- */

ui.langSelect.value = lang;
applyStaticStrings();
bindChartTooltip(ui.chart);
startWatching();
loadCache();
render();
/* flush() first: anything logged offline before the app was last closed is
   still in the queue, and poll() defers to a non-empty queue rather than
   overwriting it. flush() marks itself busy synchronously, so poll() then
   waits its turn instead of racing. */
flush();
poll({ force: true });
loadRates();

setInterval(poll, POLL_MS);
setInterval(loadRates, RATES_MS);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { stopWatching(); return; }
  startWatching();
  flush();
  poll({ force: true });
});
window.addEventListener('online', () => { flush(); poll({ force: true }); });
