/* Sund front end. The count lives on the server so every device sees the same
   number; taps apply optimistically and sync in the background, so the app
   still works with a phone in a pool changing room on one bar of signal. */

import {
  emptyState, normalize, addTrip, removeLastTrip, removeTripAt, clearTrips, updateSettings,
  costPerTrip, cardPerTrip, breakEvenTrips, cashBreakEvenTrips
} from './lib/state.js';
import {
  LANGS, LANG_NAMES, DEFAULT_LANG, detectLang, t, plural, ordinal, formatDate, formatTime
} from './lib/i18n.js';
import { money, isConverted, rateString, currencyFor } from './lib/money.js';

const CACHE_KEY = 'sund.cache.v2';
const TOKEN_KEY = 'sund.token';
const LANG_KEY = 'sund.lang';
const POLL_MS = 15000;
const RATES_MS = 30 * 60 * 1000;   // the server caches for 12h; this is just a nudge
const CHART_MONTHS = 12;

let confirmed = emptyState();
let queue = [];
let token = localStorage.getItem(TOKEN_KEY) || '';
let lang = detectLang();
let rates = null;         // whatever /api/rates last returned, or null
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
  rateNote: el('rate-note'),
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

/* ---------- chart: trips per month ---------- */

const monthKey = (d) => `${d.getFullYear()}-${d.getMonth()}`;

/* Every month from the first trip to now, including the empty ones — a gap in
   the swimming is part of the story, and dropping those months would space the
   bars evenly and misstate the timeline. */
function monthlySeries(trips, limit = CHART_MONTHS) {
  if (!trips.length) return [];
  const counts = new Map();
  for (const iso of trips) {
    const k = monthKey(new Date(iso));
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  const first = new Date(trips[0]);
  const now = new Date();
  const out = [];
  const cursor = new Date(first.getFullYear(), first.getMonth(), 1);
  const endY = now.getFullYear(), endM = now.getMonth();
  while (cursor.getFullYear() < endY || (cursor.getFullYear() === endY && cursor.getMonth() <= endM)) {
    out.push({ date: new Date(cursor), count: counts.get(monthKey(cursor)) || 0 });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return out.slice(-limit);
}

/* Round the axis up to a clean number so the ticks read 0/2/4 rather than 0/3/7. */
function axisTicks(max) {
  const step = max <= 4 ? 1 : max <= 8 ? 2 : max <= 20 ? 5 : 10;
  const top = Math.max(step, Math.ceil(max / step) * step);
  const ticks = [];
  for (let v = 0; v <= top; v += step) ticks.push(v);
  return { top, ticks };
}

const svgEsc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* Column with a 4px rounded cap and a square foot on the baseline. */
function barPath(x, y, w, h) {
  const r = Math.min(4, h, w / 2);
  if (h <= 0) return '';
  return `M${x},${y + h}V${y + r}a${r},${r} 0 0 1 ${r},-${r}h${w - 2 * r}a${r},${r} 0 0 1 ${r},${r}V${y + h}Z`;
}

let chartSig = null;

function renderChart(trips) {
  const series = monthlySeries(trips);
  const sig = lang + '|' + series.map((m) => monthKey(m.date) + ':' + m.count).join(',');
  if (sig === chartSig) return;
  chartSig = sig;

  if (!series.length) {
    ui.chart.innerHTML = `<p class="chart-empty">${svgEsc(t(lang, 'chart.empty'))}</p>`;
    return;
  }

  const W = 320, H = 168;
  const PAD = { top: 14, right: 4, bottom: 22, left: 24 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const { top, ticks } = axisTicks(Math.max(...series.map((m) => m.count), 1));
  const band = plotW / series.length;
  // 2px of surface between neighbours does the separating; never a stroke.
  const barW = Math.min(24, Math.max(3, band - 2));
  const yOf = (v) => PAD.top + plotH * (1 - v / top);

  const peak = series.reduce((best, m, i) => (m.count > series[best].count ? i : best), 0);
  /* Thin by measured band width, not by month count: 12 months still leaves
     ~24 units per band, which fits a three-letter month at 9px. */
  const labelEvery = band >= 20 ? 1 : band >= 13 ? 2 : 3;

  const parts = [];

  for (const v of ticks) {
    const y = yOf(v);
    parts.push(`<line class="gridline" x1="${PAD.left}" y1="${y}" x2="${W - PAD.right}" y2="${y}"/>`);
    parts.push(`<text class="axis-text" x="${PAD.left - 5}" y="${y + 3}" text-anchor="end">${v}</text>`);
  }

  series.forEach((m, i) => {
    const cx = PAD.left + band * i + band / 2;
    const h = plotH * (m.count / top);
    const y = yOf(m.count);
    if (m.count > 0) {
      parts.push(`<path class="bar" d="${barPath(cx - barW / 2, y, barW, h)}"/>`);
    }
    // Label the peak only — a number on every column is noise.
    if (i === peak && m.count > 0) {
      parts.push(`<text class="bar-label" x="${cx}" y="${y - 5}" text-anchor="middle">${m.count}</text>`);
    }
    if (i % labelEvery === 0 || i === series.length - 1) {
      parts.push(`<text class="axis-text" x="${cx}" y="${H - 7}" text-anchor="middle">${svgEsc(formatDate(lang, m.date, 'short'))}</text>`);
    }
    const tip = t(lang, 'chart.tooltip', {
      month: formatDate(lang, m.date, 'month'),
      trips: plural(lang, m.count, 'trip')
    });
    parts.push(
      /* No tabindex: focus events don't fire reliably on SVG shapes, so a tab
         stop here would land with no tooltip. role + title still expose the
         value to assistive tech, and the history panel is the table view. */
      `<rect class="hit" x="${PAD.left + band * i}" y="${PAD.top}" width="${band}" height="${plotH}" ` +
      `data-tip="${svgEsc(tip)}" data-cx="${cx}" data-cy="${y}" role="img" aria-label="${svgEsc(tip)}">` +
      `<title>${svgEsc(tip)}</title></rect>`
    );
  });

  ui.chart.innerHTML =
    `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${svgEsc(t(lang, 'chart.label'))}">${parts.join('')}</svg>` +
    `<div class="chart-tip" id="chart-tip"></div>`;
}

/* Hover on a pointer, tap on a phone — the hit rects span the full plot height
   so the target is never the width of a thin bar. */
function bindChartTooltip() {
  const show = (e) => {
    const hit = e.target.closest('.hit');
    const tip = el('chart-tip');
    if (!hit || !tip) return;
    const box = ui.chart.getBoundingClientRect();
    const svg = ui.chart.querySelector('svg').getBoundingClientRect();
    const scale = svg.width / 320;
    tip.textContent = hit.dataset.tip;
    tip.style.left = `${Number(hit.dataset.cx) * scale}px`;
    tip.style.top = `${Number(hit.dataset.cy) * scale + (svg.top - box.top)}px`;
    tip.dataset.show = '1';
  };
  const hide = () => { const tip = el('chart-tip'); if (tip) tip.dataset.show = '0'; };

  ui.chart.addEventListener('pointerover', show);
  ui.chart.addEventListener('pointermove', show);
  ui.chart.addEventListener('pointerleave', hide);
}

/* ---------- history ---------- */

const isBackdated = (d) =>
  d.getHours() === 12 && d.getMinutes() === 0 && d.getSeconds() === 0 && d.getMilliseconds() === 0;

let historySig = null;

function renderHistory(trips) {
  ui.historySummary.textContent = trips.length
    ? t(lang, 'history.summary', {
        trips: plural(lang, trips.length, 'trip'),
        date: formatDate(lang, trips[trips.length - 1], 'full')
      })
    : t(lang, 'history.none');

  const sig = lang + '|' + trips.join('|');
  if (ui.historyPanel.hidden || sig === historySig) return;
  historySig = sig;

  if (!trips.length) {
    ui.historyBody.innerHTML = `<p class="history-empty">${t(lang, 'history.empty')}</p>`;
    return;
  }

  const frag = document.createDocumentFragment();
  let openMonth = null;

  trips.forEach((iso, i) => {
    const d = new Date(iso);
    const key = monthKey(d);
    if (key !== openMonth) {
      openMonth = key;
      const head = document.createElement('div');
      head.className = 'month';
      const n = trips.filter((x) => monthKey(new Date(x)) === key).length;
      head.innerHTML = `<span></span><span class="month-count"></span>`;
      head.firstChild.textContent = formatDate(lang, d, 'month');
      head.lastChild.textContent = plural(lang, n, 'trip');
      frag.append(head);
    }

    const row = document.createElement('div');
    row.className = 'trip-row';
    row.innerHTML = `<span class="n"></span><span class="when"><span class="date"></span><span class="time"></span></span>` +
                    `<button class="row-del" type="button">×</button>`;
    row.querySelector('.n').textContent = `#${i + 1}`;
    row.querySelector('.date').textContent = formatDate(lang, d, 'day');
    row.querySelector('.time').textContent = isBackdated(d) ? '' : formatTime(d);
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
  const n = state.trips.length;
  const be = breakEvenTrips(s);
  const cashBe = cashBreakEvenTrips(s);
  const perCardTrip = cardPerTrip(s);
  const cards = Math.ceil(s.membership / s.cardPrice);

  ui.trips.textContent = n;
  ui.minus.disabled = n === 0;
  ui.lastSwim.textContent = n
    ? t(lang, 'counter.lastSwim', { date: formatDate(lang, state.trips[n - 1], 'full') })
    : t(lang, 'counter.none');

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
  renderChart(state.trips);
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
bindChartTooltip();
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
document.addEventListener('visibilitychange', () => { if (!document.hidden) { flush(); poll({ force: true }); } });
window.addEventListener('online', () => { flush(); poll({ force: true }); });
