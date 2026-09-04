/* The visits-per-pool table, as one renderer shared by the private app and the
   public read-only page, so the two cannot disagree about what it says.

   It takes the rows poolCounts() produces rather than a whole state: the app
   has the trips to count, while the public page is handed the counts already
   totalled at publish time, and neither needs to know that about the other.

   Nodes rather than an HTML string — a pool name can be typed by hand at a
   check-in, and textContent keeps that out of the parser. */

import { t } from './i18n.js';

export function renderPoolTable(container, lang, rows) {
  if (!rows.length) {
    container.innerHTML = `<p class="pool-empty">${t(lang, 'pool.empty')}</p>`;
    return;
  }
  const most = Math.max(...rows.map((r) => r.count));
  const frag = document.createDocumentFragment();
  for (const row of rows) {
    const el = document.createElement('div');
    el.className = 'pool-row';
    el.innerHTML = '<span class="pool-name"></span>' +
                   '<span class="pool-bar"><span></span></span>' +
                   '<span class="pool-count"></span>';
    const name = el.querySelector('.pool-name');
    name.textContent = row.name ?? t(lang, 'pool.unattributed');
    name.classList.toggle('is-muted', row.name === null);
    el.classList.toggle('is-off-card', !row.card);
    if (!row.card) {
      const tag = document.createElement('span');
      tag.className = 'pool-tag';
      tag.textContent = t(lang, 'pool.forFun');
      name.after(tag);
      el.style.gridTemplateColumns = '1fr auto auto auto';
    }
    el.querySelector('.pool-bar > span').style.width = `${(row.count / most) * 100}%`;
    el.querySelector('.pool-count').textContent = row.count;
    frag.append(el);
  }

  const sum = rows.reduce((a, r) => a + r.count, 0);
  const totalRow = document.createElement('div');
  totalRow.className = 'pool-row pool-row--total';
  totalRow.innerHTML = '<span class="pool-name"></span><span></span><span class="pool-count"></span>';
  totalRow.querySelector('.pool-name').textContent = t(lang, 'pool.total');
  totalRow.querySelector('.pool-count').textContent = sum;
  frag.append(totalRow);

  container.replaceChildren(frag);
}
