/* Read-only Sund. No API, no writes — the data is a static snapshot written
   at publish time, so this page is read-only by construction rather than by
   hiding buttons. All the arithmetic, wording and the chart come from the same
   lib/ modules the private app uses, so the two cannot disagree. */

import { normalize, costPerTrip, cardPerTrip, breakEvenTrips, cashBreakEvenTrips, tripAt } from './lib/state.js';
import { LANGS, LANG_NAMES, detectLang, t, plural, ordinal, formatDate } from './lib/i18n.js';
import { money, isConverted, rateString, currencyFor } from './lib/money.js';
import { chartHTML, chartSignature, bindChartTooltip, monthKey } from './lib/chart.js';

const LANG_KEY = 'sund.lang';

let snapshot = { trips: [], settings: null, generatedAt: null };
let rates = null;
let lang = detectLang();

const el = (id) => document.getElementById(id);
const ui = {
  trips: el('trips'), lastSwim: el('last-swim'), updated: el('updated'),
  beLabel: el('be-label'), costPerTrip: el('cost-per-trip'), costPerTripSub: el('cost-per-trip-sub'),
  progressFill: el('progress-fill'), breakevenLine: el('breakeven-line'), breakevenNote: el('breakeven-note'),
  cardPerTrip: el('card-per-trip'), cardPerTripSub: el('card-per-trip-sub'),
  delta: el('delta'), deltaSub: el('delta-sub'),
  langSelect: el('lang-select'), chart: el('chart'), rateNote: el('rate-note'),
  historyToggle: el('history-toggle'), historyBody: el('history-body'), historySummary: el('history-summary')
};

/* ---------- language ---------- */

function applyStaticStrings() {
  document.documentElement.lang = lang;
  for (const node of document.querySelectorAll('[data-i18n]')) {
    node.textContent = t(lang, node.dataset.i18n);
  }
  for (const node of document.querySelectorAll('[data-i18n-aria]')) {
    node.setAttribute('aria-label', t(lang, node.dataset.i18nAria));
  }
}

function setLang(next) {
  if (!LANGS.includes(next)) return;
  lang = next;
  localStorage.setItem(LANG_KEY, lang);
  ui.langSelect.value = lang;
  applyStaticStrings();
  chartSig = null;
  historySig = null;
  render();
}

/* ---------- chart & history ---------- */

let chartSig = null;

function renderChart(trips) {
  const sig = chartSignature(lang, trips);
  if (sig === chartSig) return;
  chartSig = sig;
  ui.chart.innerHTML = chartHTML(lang, trips);
}

let historySig = null;

function renderHistory(trips) {
  ui.historySummary.textContent = trips.length
    ? t(lang, 'history.summary', {
        trips: plural(lang, trips.length, 'trip'),
        date: formatDate(lang, tripAt(trips[trips.length - 1]), 'full')
      })
    : t(lang, 'history.none');

  const sig = lang + '|' + trips.map(tripAt).join('|');
  if (ui.historyBody.hidden || sig === historySig) return;
  historySig = sig;

  if (!trips.length) {
    ui.historyBody.innerHTML = `<p class="history-empty">${t(lang, 'history.empty')}</p>`;
    return;
  }

  // Newest first, but numbered in the order the swims happened.
  const rows = [];
  let openMonth = null;
  trips.forEach((trip, i) => {
    const d = new Date(tripAt(trip));
    const key = monthKey(d);
    if (key !== openMonth) {
      openMonth = key;
      const n = trips.filter((x) => monthKey(new Date(tripAt(x))) === key).length;
      rows.push({ month: formatDate(lang, d, 'month'), count: plural(lang, n, 'trip'), items: [] });
    }
    /* Dates only. The snapshot has no real times in it either — see
       stripTimes() in bin/publish.mjs — but never render one regardless. */
    rows[rows.length - 1].items.push({ n: i + 1, date: formatDate(lang, d, 'day') });
  });

  const frag = document.createDocumentFragment();
  for (const group of rows.reverse()) {
    const head = document.createElement('div');
    head.className = 'month';
    head.innerHTML = '<span></span><span class="month-count"></span>';
    head.firstChild.textContent = group.month;
    head.lastChild.textContent = group.count;
    frag.append(head);
    for (const item of group.items.reverse()) {
      const row = document.createElement('div');
      row.className = 'trip-row trip-row--readonly';
      row.innerHTML = '<span class="n"></span><span class="when"><span class="date"></span></span>';
      row.querySelector('.n').textContent = `#${item.n}`;
      row.querySelector('.date').textContent = item.date;
      frag.append(row);
    }
  }
  ui.historyBody.replaceChildren(frag);
}

/* ---------- render ---------- */

function renderRateNote() {
  if (currencyFor(lang) === 'ISK') {
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

function render() {
  const s = snapshot.settings;
  if (!s) return;
  const trips = snapshot.trips;
  const n = trips.length;
  const be = breakEvenTrips(s);
  const cashBe = cashBreakEvenTrips(s);
  const perCardTrip = cardPerTrip(s);
  const cards = Math.ceil(s.membership / s.cardPrice);

  ui.updated.textContent = snapshot.generatedAt
    ? t(lang, 'public.updated', { date: formatDate(lang, snapshot.generatedAt, 'full') })
    : '';

  ui.trips.textContent = n;
  ui.lastSwim.textContent = n
    ? t(lang, 'counter.lastSwim', { date: formatDate(lang, tripAt(trips[n - 1]), 'full') })
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
    cards: ordinal(lang, cards)
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
  renderChart(trips);
  renderHistory(trips);
}

/* ---------- start ---------- */

for (const code of LANGS) {
  const opt = document.createElement('option');
  opt.value = code;
  opt.textContent = LANG_NAMES[code];
  ui.langSelect.append(opt);
}
ui.langSelect.value = lang;
ui.langSelect.addEventListener('change', () => setLang(ui.langSelect.value));

ui.historyToggle.addEventListener('click', () => {
  const open = ui.historyBody.hidden;
  ui.historyBody.hidden = !open;
  ui.historyToggle.setAttribute('aria-expanded', String(open));
  if (open) { historySig = null; render(); }
});

applyStaticStrings();
bindChartTooltip(ui.chart);

const loadJSON = async (path) => {
  try {
    const res = await fetch(path, { cache: 'no-cache' });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
};

const [state, rateData] = await Promise.all([loadJSON('./state.json'), loadJSON('./rates.json')]);
rates = rateData;
if (state) {
  const clean = normalize(state);
  snapshot = { trips: clean.trips, settings: clean.settings, generatedAt: state.generatedAt ?? null };
}
render();
