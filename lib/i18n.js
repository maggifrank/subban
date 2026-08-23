/* Icelandic and English strings, plus the formatting each language needs.
   Dates and numbers are built by hand rather than through Intl: the browsers
   this runs in may not ship is-IS locale data, and Intl fails soft by falling
   back to en-US, which would quietly print Icelandic prices with US commas. */

export const LANGS = ['is', 'en'];
export const LANG_NAMES = { is: 'Íslenska', en: 'English' };
export const DEFAULT_LANG = 'is';

/* Countable nouns carry both forms; see PLURAL_RULE for which one is picked. */
const S = {
  is: {
    'lang.switch': 'English',
    'a11y.langSwitch': 'Switch to English',
    'a11y.settings': 'Stillingar',
    'a11y.syncNow': 'Samstilla núna',

    'counter.label': 'Ferðir á árskortinu',
    'counter.add': 'Bæta við ferð',
    'counter.remove': 'Fjarlægja ferð',
    'counter.lastSwim': 'Síðasta ferð {date}',
    'counter.none': 'Engar ferðir skráðar enn',

    'cost.label': 'Kostnaður á ferð hingað til',
    'cost.sub': '{total} ÷ {trips}',
    'cost.unused': 'Árskort á {total}, ónotað',

    'be.label': 'Núllpunktur m.v. {n} skipta kort',
    'be.toGo': '{left} eftir — {total} alls',
    'be.start': '{trips} að núllpunkti',
    'be.exact': 'Nákvæmlega á núlli — næsta ferð er frí',
    'be.past': 'Komið yfir núllið — {trips} í hreinan gróða',
    'be.note': '{cardTrips} skipta kort kostar {perTrip} á ferð, svo árskortið borgar sig upp á {be} ferðum. Miðað við heil kort sem raunverulega eru keypt hefðirðu borgað meira frá ferð {cashBe} (þá þarf {cards}. kortið).',

    'stat.cardPerTrip': 'Verð á ferð með korti',
    'stat.cardPerTripSub': '{price} ÷ {trips}',
    'stat.delta': 'Staða',
    'stat.saved': 'sparað m.v. kort',
    'stat.owed': 'á eftir að vinnast upp',

    'chart.label': 'Ferðir á mánuði',
    'chart.empty': 'Ekkert til að teikna enn',
    'chart.tooltip': '{month}: {trips}',

    'history.label': 'Ferðaskrá',
    'history.summary': '{trips} · síðast {date}',
    'history.none': 'Ekkert skráð enn',
    'history.empty': 'Engar ferðir enn. Ýttu á + eftir næstu sundferð.',
    'history.removeAria': 'Fjarlægja ferð {date}',
    'backdate.label': 'Skrá fyrri ferð',
    'backdate.add': 'Bæta við',
    'backdate.noDate': 'Veldu fyrst dagsetningu.',
    'backdate.future': 'Þetta er í framtíðinni.',

    'settings.label': 'Stillingar',
    'settings.membership': 'Verð á árskorti (kr)',
    'settings.cardPrice': 'Verð á fjölnotakorti (kr)',
    'settings.cardTrips': 'Ferðir á korti',
    'settings.export': 'Flytja út gögn',
    'settings.reset': 'Núllstilla ferðir',
    'settings.note': 'Talningin er sameiginleg: öll tæki sem tengjast þessum þjóni sjá sömu tölu. Ferðir sem skráðar eru án nettengingar samstillast þegar tengingin kemur aftur.',
    'settings.resetConfirm': 'Eyða öllum {trips} á öllum tækjum? Þessu verður ekki hægt að afturkalla.',
    'settings.tokenPrompt': 'Aðgangskóði fyrir þennan Sund-þjón:',

    'sync.syncing': 'Samstilli…',
    'sync.synced': 'Samstillt',
    'sync.offline': 'Ónettengt — samstilli síðar',
    'sync.locked': 'Aðgangskóða vantar',
    'sync.error': 'Breytingu hafnað',
    'sync.pending': '{status} ({changes} bíða)',

    'n.trip': { one: '{n} ferð', other: '{n} ferðir' },
    'n.change': { one: '{n} breyting', other: '{n} breytingar' }
  },

  en: {
    'lang.switch': 'Íslenska',
    'a11y.langSwitch': 'Skipta yfir á íslensku',
    'a11y.settings': 'Settings',
    'a11y.syncNow': 'Sync now',

    'counter.label': 'Trips this membership',
    'counter.add': 'Add a trip',
    'counter.remove': 'Remove a trip',
    'counter.lastSwim': 'Last swim {date}',
    'counter.none': 'No trips logged yet',

    'cost.label': 'Cost per trip so far',
    'cost.sub': '{total} ÷ {trips}',
    'cost.unused': '{total} membership, not used yet',

    'be.label': 'Break-even vs {n}-trip cards',
    'be.toGo': '{left} to go — {total} in total',
    'be.start': '{trips} to break even',
    'be.exact': 'Broken even exactly — the next trip is free',
    'be.past': 'Broken even — {trips} of pure profit',
    'be.note': 'A {cardTrips}-trip card works out at {perTrip} per trip, so the membership pays for itself at {be} trips. Counting whole cards actually bought, you would have overpaid from trip {cashBe} (that is when a {cards} card is needed).',

    'stat.cardPerTrip': 'Card price per trip',
    'stat.cardPerTripSub': '{price} ÷ {trips}',
    'stat.delta': 'Ahead / behind',
    'stat.saved': 'saved vs cards',
    'stat.owed': 'still to earn back',

    'chart.label': 'Trips per month',
    'chart.empty': 'Nothing to plot yet',
    'chart.tooltip': '{month}: {trips}',

    'history.label': 'History',
    'history.summary': '{trips} · last {date}',
    'history.none': 'Nothing logged yet',
    'history.empty': 'No trips yet. Tap + after your next swim.',
    'history.removeAria': 'Remove trip on {date}',
    'backdate.label': 'Log a past swim',
    'backdate.add': 'Add',
    'backdate.noDate': 'Pick a date first.',
    'backdate.future': "That's in the future.",

    'settings.label': 'Settings',
    'settings.membership': 'Membership cost (kr)',
    'settings.cardPrice': 'Multi-trip card price (kr)',
    'settings.cardTrips': 'Trips per card',
    'settings.export': 'Export data',
    'settings.reset': 'Reset trips',
    'settings.note': 'The count is shared: every device pointed at this server sees the same number. Taps made offline sync when you reconnect.',
    'settings.resetConfirm': 'Delete all {trips} on every device? This cannot be undone.',
    'settings.tokenPrompt': 'Access code for this Sund server:',

    'sync.syncing': 'Syncing…',
    'sync.synced': 'Synced',
    'sync.offline': 'Offline — will sync later',
    'sync.locked': 'Access code needed',
    'sync.error': 'Change rejected',
    'sync.pending': '{status} ({changes} pending)',

    'n.trip': { one: '{n} trip', other: '{n} trips' },
    'n.change': { one: '{n} change', other: '{n} changes' }
  }
};

/* Icelandic takes the singular for anything ending in 1 except 11 — 21 ferð,
   31 ferð, but 11 ferðir. English is the plain n === 1. */
const PLURAL_RULE = {
  is: (n) => (Math.abs(n) % 10 === 1 && Math.abs(n) % 100 !== 11 ? 'one' : 'other'),
  en: (n) => (Math.abs(n) === 1 ? 'one' : 'other')
};

const interpolate = (template, vars) =>
  template.replace(/\{(\w+)\}/g, (whole, key) => (key in vars ? vars[key] : whole));

export function t(lang, key, vars = {}) {
  const entry = S[lang]?.[key] ?? S[DEFAULT_LANG][key];
  if (entry === undefined) return key;                  // surface the typo
  return interpolate(entry, vars);
}

/* "3 ferðir" / "3 trips" — the number and its noun agreed. */
export function plural(lang, n, noun) {
  const forms = S[lang]?.[`n.${noun}`] ?? S[DEFAULT_LANG][`n.${noun}`];
  return interpolate(forms[PLURAL_RULE[lang](n)], { n: groupNumber(lang, n) });
}

/* Icelandic groups with dots (36.400), English with commas (36,400). */
export function groupNumber(lang, n) {
  const sep = lang === 'is' ? '.' : ',';
  return String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}

export const kr = (lang, v) => `${groupNumber(lang, v)} kr`;

/* Icelandic writes ordinals as "3."; English needs the suffix. */
export function ordinal(lang, n) {
  if (lang === 'is') return `${n}.`;
  const t1 = n % 10, t2 = n % 100;
  if (t1 === 1 && t2 !== 11) return `${n}st`;
  if (t1 === 2 && t2 !== 12) return `${n}nd`;
  if (t1 === 3 && t2 !== 13) return `${n}rd`;
  return `${n}th`;
}

const MONTHS = {
  is: ['janúar', 'febrúar', 'mars', 'apríl', 'maí', 'júní', 'júlí', 'ágúst', 'september', 'október', 'nóvember', 'desember'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
};
const MONTHS_SHORT = {
  is: ['jan', 'feb', 'mar', 'apr', 'maí', 'jún', 'júl', 'ágú', 'sep', 'okt', 'nóv', 'des'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
};
const WEEKDAYS_SHORT = {
  is: ['sun', 'mán', 'þri', 'mið', 'fim', 'fös', 'lau'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
};

/* full  -> 18. ágúst 2026        / 18 August 2026
   day   -> þri. 18. ágú          / Tue 18 Aug
   month -> ágúst 2026            / August 2026
   short -> ágú                   / Aug              (chart axis) */
export function formatDate(lang, value, style = 'full') {
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d)) return '';
  const day = d.getDate(), mon = d.getMonth(), year = d.getFullYear();
  const isIS = lang === 'is';
  switch (style) {
    case 'day':
      return isIS
        ? `${WEEKDAYS_SHORT.is[d.getDay()]}. ${day}. ${MONTHS_SHORT.is[mon]}`
        : `${WEEKDAYS_SHORT.en[d.getDay()]} ${day} ${MONTHS_SHORT.en[mon]}`;
    case 'month':
      return `${MONTHS[lang][mon]} ${year}`;
    case 'short':
      return MONTHS_SHORT[lang][mon];
    default:
      return isIS
        ? `${day}. ${MONTHS.is[mon]} ${year}`
        : `${day} ${MONTHS.en[mon]} ${year}`;
  }
}

/* 24-hour in both languages — Iceland uses it, and it avoids AM/PM clutter in
   a list where the time is secondary information. */
export function formatTime(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d)) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/* Honour the browser's preference on first visit, then whatever was chosen. */
export function detectLang() {
  const stored = localStorage.getItem('sund.lang');
  if (LANGS.includes(stored)) return stored;
  const nav = (navigator.languages || [navigator.language || ''])
    .map((l) => String(l).slice(0, 2).toLowerCase());
  return nav.includes('is') ? 'is' : nav.includes('en') ? 'en' : DEFAULT_LANG;
}
