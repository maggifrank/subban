/* Everything is stored and entered in ISK — that is the money actually spent at
   the pool. Other currencies are a display conversion only, so a rounding trip
   through zloty can never corrupt the recorded prices. */

export const CURRENCY_FOR_LANG = { is: 'ISK', en: 'USD', pl: 'PLN' };
export const BASE = 'ISK';

/* Each currency carries its own conventions, which line up with the language it
   is paired to: dots in Icelandic, commas in English, spaces in Polish. */
const SPEC = {
  ISK: { symbol: 'kr', before: false, group: '.', decimal: ',' },
  USD: { symbol: '$', before: true, group: ',', decimal: '.' },
  PLN: { symbol: 'zł', before: false, group: ' ', decimal: ',' }
};

export const currencyFor = (lang) => CURRENCY_FOR_LANG[lang] ?? BASE;

/* Small amounts need the minor unit — 467 kr is $3.86, and rounding that to $4
   throws away the comparison the whole app is about. Large ones don't. */
const decimalsFor = (v, code) => (code === 'ISK' ? 0 : Math.abs(v) < 100 ? 2 : 0);

export function formatIn(code, value) {
  const spec = SPEC[code] ?? SPEC[BASE];
  const dp = decimalsFor(value, code);
  const [int, frac] = Math.abs(value).toFixed(dp).split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, spec.group);
  const num = frac ? `${grouped}${spec.decimal}${frac}` : grouped;
  return spec.before ? `${spec.symbol}${num}` : `${num} ${spec.symbol}`;
}

/* `rates` is whatever /api/rates last returned, or null. Without a usable rate
   the amount stays in ISK rather than being silently shown at a made-up one. */
export function money(lang, isk, rates) {
  const code = currencyFor(lang);
  if (code === BASE) return formatIn(BASE, isk);
  const rate = rates?.rates?.[code];
  if (!rate) return formatIn(BASE, isk);
  return formatIn(code, isk * rate);
}

/* True when the display is showing a converted amount, so the UI can say so. */
export const isConverted = (lang, rates) => {
  const code = currencyFor(lang);
  return code !== BASE && Boolean(rates?.rates?.[code]);
};

/* The rate itself, for the disclosure line — enough digits to be checkable, and
   punctuated the way the reader's language writes decimals. */
export const rateString = (lang, rates) => {
  const code = currencyFor(lang);
  const rate = rates?.rates?.[code];
  if (!rate) return '';
  const spec = SPEC[code] ?? SPEC[BASE];
  return rate.toPrecision(3).replace('.', spec.decimal);
};
