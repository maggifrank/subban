/* Sund front end. The count lives on the server so every device sees the same
   number; taps apply optimistically and sync in the background, so the app
   still works with a phone in a pool changing room on one bar of signal. */

import {
  emptyState, normalize, addTrip, removeLastTrip, removeTripAt, clearTrips, updateSettings,
  costPerTrip, cardPerTrip, breakEvenTrips, cashBreakEvenTrips
} from './lib/state.js';

const CACHE_KEY = 'sund.cache.v2';
const TOKEN_KEY = 'sund.token';
const POLL_MS = 15000;

/* `confirmed` is the last state the server acknowledged. `queue` holds taps it
   hasn't accepted yet. What we render is confirmed + queue, so the number moves
   the instant you tap and still converges on whatever the server says. */
let confirmed = emptyState();
let queue = [];
let token = localStorage.getItem(TOKEN_KEY) || '';
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
  add: (s, op) => addTrip(s, op.at),
  remove: (s) => removeLastTrip(s),
  removeAt: (s, op) => removeTripAt(s, op.at),
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
  add: (op) => api('POST', '/api/trips', { at: op.at }),
  remove: () => api('DELETE', '/api/trips/last'),
  removeAt: (op) => api('DELETE', '/api/trips/one', { at: op.at }),
  clear: () => api('DELETE', '/api/trips'),
  settings: (op) => api('PUT', '/api/settings', op.patch)
};

/* Send queued taps oldest-first. Each one is a delta, so if the other device
   logged a swim meanwhile the server ends up with both, not one overwriting
   the other. */
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

/* Pull in changes made on other devices. Skipped while taps are pending, so a
   poll can't undo a number the user is looking at, and skipped for background
   tabs — except `force`, used on load and when a tab comes back to the front,
   where the whole point is to refresh before anyone reads the number. */
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

/* ---------- formatting ---------- */

// Icelandic grouping (36.400) written out by hand — browsers in the LXC may not
// ship is-IS locale data, and Intl silently falls back to en-US commas.
const group = (n) => String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const kr = (v) => `${group(v)} kr`;
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function formatDate(iso) {
  const d = new Date(iso);
  return isNaN(d) ? '' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function nth(k) {
  const t = k % 10, h = k % 100;
  if (t === 1 && h !== 11) return 'st';
  if (t === 2 && h !== 12) return 'nd';
  if (t === 3 && h !== 13) return 'rd';
  return 'th';
}

/* ---------- elements ---------- */

const el = (id) => document.getElementById(id);
const ui = {
  trips: el('trips'), lastSwim: el('last-swim'), plus: el('plus'), minus: el('minus'),
  costPerTrip: el('cost-per-trip'), costPerTripSub: el('cost-per-trip-sub'),
  progressFill: el('progress-fill'), breakevenLine: el('breakeven-line'), breakevenNote: el('breakeven-note'),
  cardPerTrip: el('card-per-trip'), cardPerTripSub: el('card-per-trip-sub'),
  delta: el('delta'), deltaSub: el('delta-sub'),
  sync: el('sync'), syncText: el('sync-text'),
  historyToggle: el('history-toggle'), historyPanel: el('history-panel'), historyBody: el('history-body'),
  historySummary: el('history-summary'),
  backdate: el('backdate'), backdateDate: el('backdate-date'), backdateError: el('backdate-error'),
  settings: el('settings'), settingsToggle: el('settings-toggle'),
  inMembership: el('in-membership'), inCardPrice: el('in-card-price'), inCardTrips: el('in-card-trips'),
  exportBtn: el('export'), resetBtn: el('reset')
};

const STATUS_TEXT = {
  syncing: 'Syncing…',
  synced: 'Synced',
  offline: 'Offline — will sync later',
  locked: 'Access code needed',
  error: 'Change rejected'
};

function setStatus(next) {
  status = next;
  ui.sync.dataset.status = next;
  if (next === 'error') {
    ui.syncText.textContent = lastError || STATUS_TEXT.error;
    return;
  }
  ui.syncText.textContent = queue.length && next !== 'synced'
    ? `${STATUS_TEXT[next]} (${plural(queue.length, 'change')} pending)`
    : STATUS_TEXT[next];
}

/* ---------- history ---------- */

const monthKey = (d) => `${d.getFullYear()}-${d.getMonth()}`;
const monthName = (d) => d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
const dayName = (d) => d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const timeName = (d) => d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

/* Backdated trips are anchored at exactly local noon, so showing a time would
   claim a precision the entry doesn't have. Live taps never land on the
   millisecond. */
const isBackdated = (d) =>
  d.getHours() === 12 && d.getMinutes() === 0 && d.getSeconds() === 0 && d.getMilliseconds() === 0;

let historySig = null;

/* Rebuilt only when the trips actually change — render() also runs on every
   poll, and throwing the list away mid-scroll would yank it under the reader. */
function renderHistory(trips) {
  ui.historySummary.textContent = trips.length
    ? `${plural(trips.length, 'trip')} · last ${formatDate(trips[trips.length - 1])}`
    : 'Nothing logged yet';

  const sig = trips.join('|');
  if (ui.historyPanel.hidden || sig === historySig) return;
  historySig = sig;

  if (!trips.length) {
    ui.historyBody.innerHTML = '<p class="history-empty">No trips yet. Tap + after your next swim.</p>';
    return;
  }

  // Group by local month. The stored timestamps are UTC, so an evening swim
  // would land in the wrong month if we sliced the ISO string instead.
  const frag = document.createDocumentFragment();
  let openMonth = null;

  trips.forEach((iso, i) => {
    const d = new Date(iso);
    const key = monthKey(d);
    if (key !== openMonth) {
      openMonth = key;
      const head = document.createElement('div');
      head.className = 'month';
      const n = trips.filter((t) => monthKey(new Date(t)) === key).length;
      head.innerHTML = `<span></span><span class="month-count"></span>`;
      head.firstChild.textContent = monthName(d);
      head.lastChild.textContent = plural(n, 'trip');
      frag.append(head);
    }

    const row = document.createElement('div');
    row.className = 'trip-row';
    row.innerHTML = `<span class="n"></span><span class="when"><span class="date"></span><span class="time"></span></span>` +
                    `<button class="row-del" type="button">×</button>`;
    row.querySelector('.n').textContent = `#${i + 1}`;
    row.querySelector('.date').textContent = dayName(d);
    row.querySelector('.time').textContent = isBackdated(d) ? '' : timeName(d);
    const del = row.querySelector('.row-del');
    del.dataset.at = iso;
    del.setAttribute('aria-label', `Remove trip on ${dayName(d)}`);
    frag.append(row);
  });

  // Newest first, but numbered in the order they happened.
  const rows = [...frag.children];
  ui.historyBody.replaceChildren();
  ui.historyBody.append(...reverseKeepingMonths(rows));
}

/* Reverses the flat list back into newest-first order while keeping each month
   heading above its own trips. */
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
  const n = state.trips.length;
  const be = breakEvenTrips(s);
  const cashBe = cashBreakEvenTrips(s);
  const perCardTrip = cardPerTrip(s);
  const cards = Math.ceil(s.membership / s.cardPrice);

  ui.trips.textContent = n;
  ui.minus.disabled = n === 0;
  ui.lastSwim.textContent = n ? `Last swim ${formatDate(state.trips[n - 1])}` : 'No trips logged yet';

  const cpt = costPerTrip(s, n);
  ui.costPerTrip.textContent = cpt === null ? '—' : kr(cpt);
  ui.costPerTrip.classList.toggle('is-empty', cpt === null);
  ui.costPerTripSub.textContent = cpt === null
    ? `${kr(s.membership)} membership, not used yet`
    : `${kr(s.membership)} ÷ ${plural(n, 'trip')}`;

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
    `(that's when a ${cards}${nth(cards)} card is needed).`;

  ui.cardPerTrip.textContent = kr(perCardTrip);
  ui.cardPerTripSub.textContent = `${kr(s.cardPrice)} ÷ ${s.cardTrips} trips`;

  const delta = perCardTrip * n - s.membership;
  ui.delta.textContent = (delta >= 0 ? '+' : '−') + kr(Math.abs(delta));
  ui.delta.classList.toggle('is-good', delta >= 0);
  ui.delta.classList.toggle('is-bad', delta < 0);
  ui.deltaSub.textContent = delta >= 0 ? 'saved vs cards' : 'still to earn back';

  renderHistory(state.trips);

  if (document.activeElement !== ui.inMembership) ui.inMembership.value = s.membership;
  if (document.activeElement !== ui.inCardPrice) ui.inCardPrice.value = s.cardPrice;
  if (document.activeElement !== ui.inCardTrips) ui.inCardTrips.value = s.cardTrips;

  setStatus(status);
}

/* ---------- actions ---------- */

ui.plus.addEventListener('click', () => enqueue({ kind: 'add', at: new Date().toISOString() }));
ui.minus.addEventListener('click', () => {
  if (view().trips.length) enqueue({ kind: 'remove' });
});

document.addEventListener('keydown', (e) => {
  if (e.target.matches('input')) return;
  if (e.key === '+' || e.key === '=' || e.key === 'ArrowUp') { ui.plus.click(); e.preventDefault(); }
  if (e.key === '-' || e.key === 'ArrowDown') { ui.minus.click(); e.preventDefault(); }
});

ui.historyToggle.addEventListener('click', () => {
  const open = ui.historyPanel.hidden;
  ui.historyPanel.hidden = !open;
  ui.historyToggle.setAttribute('aria-expanded', String(open));
  if (open) { historySig = null; render(); }     // build the list on first open
});

/* Today in the local timezone, as the yyyy-mm-dd a date input expects. */
function todayISODate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

ui.backdateDate.max = todayISODate();

ui.backdate.addEventListener('submit', (e) => {
  e.preventDefault();
  const value = ui.backdateDate.value;          // "2026-08-18"
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return showBackdateError('Pick a date first.');

  /* Anchored at local midday. Midnight round-trips fine in the timezone that
     logged it, but stored as 00:00Z it reads as the *previous day* on a device
     anywhere west of UTC. Midday leaves ~12 hours of slack either way. */
  const when = new Date(y, m - 1, d, 12, 0, 0, 0);
  if (when > new Date()) return showBackdateError("That's in the future.");

  showBackdateError(null);
  ui.backdateDate.value = '';
  enqueue({ kind: 'add', at: when.toISOString() });
});

function showBackdateError(msg) {
  ui.backdateError.textContent = msg || '';
  ui.backdateError.hidden = !msg;
}

ui.historyBody.addEventListener('click', (e) => {
  const btn = e.target.closest('.row-del');
  if (!btn) return;
  enqueue({ kind: 'removeAt', at: btn.dataset.at });
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
    enqueue({ kind: 'settings', patch: { [key]: v } });
  });
}

ui.resetBtn.addEventListener('click', () => {
  const n = view().trips.length;
  if (!n) return;
  if (!confirm(`Delete all ${plural(n, 'trip')} on every device? This cannot be undone.`)) return;
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
  const entered = prompt('Access code for this Sund server:', '');
  if (entered === null) return;
  token = entered.trim();
  localStorage.setItem(TOKEN_KEY, token);
  queue.length ? flush() : poll({ force: true });
}

/* ---------- start ---------- */

loadCache();
render();
/* flush() first: anything logged offline before the app was last closed is
   still in the queue, and poll() defers to a non-empty queue rather than
   overwriting it. flush() marks itself busy synchronously, so poll() then
   waits its turn instead of racing. */
flush();
poll({ force: true });

setInterval(poll, POLL_MS);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { flush(); poll({ force: true }); } });
window.addEventListener('online', () => { flush(); poll({ force: true }); });
