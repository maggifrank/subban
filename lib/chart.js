/* The trips-per-month column chart, as pure functions so the private app and
   the public read-only page render an identical chart from one source. */

import { t, plural, formatDate } from './i18n.js';

export const CHART_MONTHS = 12;

export const monthKey = (d) => `${d.getFullYear()}-${d.getMonth()}`;

/* Every month from the first trip to now, including the empty ones — a gap in
   the swimming is part of the story, and dropping those months would space the
   bars evenly and misstate the timeline. */
export function monthlySeries(trips, limit = CHART_MONTHS) {
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

/* Callers cache this and skip re-rendering when it is unchanged — render() runs
   on every poll, and rebuilding would drop the tooltip mid-hover. */
export function chartSignature(lang, trips, limit = CHART_MONTHS) {
  return lang + '|' + monthlySeries(trips, limit).map((m) => monthKey(m.date) + ':' + m.count).join(',');
}

export function chartHTML(lang, trips, limit = CHART_MONTHS) {
  const series = monthlySeries(trips, limit);
  if (!series.length) return `<p class="chart-empty">${svgEsc(t(lang, 'chart.empty'))}</p>`;

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
    if (m.count > 0) parts.push(`<path class="bar" d="${barPath(cx - barW / 2, y, barW, h)}"/>`);
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
    /* No tabindex: focus events don't fire reliably on SVG shapes, so a tab
       stop here would land with no tooltip. role + title still expose the value
       to assistive tech, and the history list is the table view. */
    parts.push(
      `<rect class="hit" x="${PAD.left + band * i}" y="${PAD.top}" width="${band}" height="${plotH}" ` +
      `data-tip="${svgEsc(tip)}" data-cx="${cx}" data-cy="${y}" role="img" aria-label="${svgEsc(tip)}">` +
      `<title>${svgEsc(tip)}</title></rect>`
    );
  });

  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${svgEsc(t(lang, 'chart.label'))}">${parts.join('')}</svg>` +
         `<div class="chart-tip" id="chart-tip"></div>`;
}

/* Hover on a pointer, tap on a phone — the hit rects span the full plot height
   so the target is never the width of a thin bar. */
export function bindChartTooltip(container) {
  const show = (e) => {
    const hit = e.target.closest('.hit');
    const tip = container.querySelector('.chart-tip');
    if (!hit || !tip) return;
    const box = container.getBoundingClientRect();
    const svg = container.querySelector('svg').getBoundingClientRect();
    const scale = svg.width / 320;
    tip.textContent = hit.dataset.tip;
    tip.style.left = `${Number(hit.dataset.cx) * scale}px`;
    tip.style.top = `${Number(hit.dataset.cy) * scale + (svg.top - box.top)}px`;
    tip.dataset.show = '1';
  };
  const hide = () => {
    const tip = container.querySelector('.chart-tip');
    if (tip) tip.dataset.show = '0';
  };
  container.addEventListener('pointerover', show);
  container.addEventListener('pointermove', show);
  container.addEventListener('pointerleave', hide);
}
