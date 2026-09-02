/* Icelandic and English strings, plus the formatting each language needs.
   Dates and numbers are built by hand rather than through Intl: the browsers
   this runs in may not ship is-IS locale data, and Intl fails soft by falling
   back to en-US, which would quietly print Icelandic prices with US commas. */

export const LANGS = ['is', 'en', 'pl'];
export const LANG_NAMES = { is: 'Íslenska', en: 'English', pl: 'Polski' };
export const DEFAULT_LANG = 'is';

/* Countable nouns carry both forms; see PLURAL_RULE for which one is picked. */
const S = {
  is: {
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
    'be.note': '{cardTrips} skipta kort kostar {perTrip} á ferð, svo árskortið borgar sig upp á {be} ferðum. Miðað við heil kort sem raunverulega eru keypt hefðirðu borgað meira frá ferð {cashBe} (þá þarf {cards} kortið).',

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
    'settings.tokenPrompt': 'Aðgangskóði fyrir þennan Subban-þjón:',

    'rate.note': 'Upphæðir eru skráðar í ISK og umreiknaðar á gengi Seðlabanka Evrópu {date} (1 kr = {rate} {code}).',
    'rate.unavailable': 'Gengi ekki tiltækt — sýni upphæðir í ISK.',

    'public.updated': 'Uppfært {date}',
    'public.readonly': 'Skoðunarútgáfa — engar breytingar mögulegar.',

    'counter.offCard': '{trips} utan kortsins',
    'pool.forFun': 'utan kortsins',
    'pool.label': 'Laugar',
    'pool.empty': 'Engar laugar skráðar enn',
    'pool.unattributed': 'Engin laug skráð',
    'pool.locating': 'Leita að staðsetningu…',
    'pool.off': 'Staðsetning ekki tiltæk',
    'pool.here': 'Þú ert við {name}',
    'pool.away': 'Engin þekkt laug nálægt',
    'pool.newPrompt': 'Hvaða laug er þetta?',

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
    'settings.tokenPrompt': 'Access code for this Subban server:',

    'rate.note': 'Amounts are recorded in ISK and converted at the European Central Bank rate of {date} (1 kr = {rate} {code}).',
    'rate.unavailable': 'Exchange rate unavailable — showing amounts in ISK.',

    'public.updated': 'Updated {date}',
    'public.readonly': 'Read-only view — nothing here can be changed.',

    'counter.offCard': '{trips} not on the card',
    'pool.forFun': 'not on the card',
    'pool.label': 'Pools',
    'pool.empty': 'No pools recorded yet',
    'pool.unattributed': 'No pool recorded',
    'pool.locating': 'Finding your location…',
    'pool.off': 'Location unavailable',
    'pool.here': "You're at {name}",
    'pool.away': 'No known pool nearby',
    'pool.newPrompt': 'Which pool is this?',

    'sync.syncing': 'Syncing…',
    'sync.synced': 'Synced',
    'sync.offline': 'Offline — will sync later',
    'sync.locked': 'Access code needed',
    'sync.error': 'Change rejected',
    'sync.pending': '{status} ({changes} pending)',

    'n.trip': { one: '{n} trip', other: '{n} trips' },
    'n.change': { one: '{n} change', other: '{n} changes' }
  },

  pl: {
    'a11y.langSwitch': 'Zmień język',
    'a11y.settings': 'Ustawienia',
    'a11y.syncNow': 'Synchronizuj teraz',

    'counter.label': 'Wejścia na karnecie',
    'counter.add': 'Dodaj wejście',
    'counter.remove': 'Usuń wejście',
    'counter.lastSwim': 'Ostatnie wejście {date}',
    'counter.none': 'Brak zapisanych wejść',

    'cost.label': 'Koszt jednego wejścia',
    'cost.sub': '{total} ÷ {trips}',
    'cost.unused': 'Karnet za {total}, jeszcze nieużywany',

    'be.label': 'Próg opłacalności — karnet na {n} wejść',
    'be.toGo': 'Zostało {left} — łącznie {total}',
    'be.start': '{trips} do progu opłacalności',
    'be.exact': 'Dokładnie na zero — następne wejście za darmo',
    'be.past': 'Próg przekroczony — {trips} czystego zysku',
    'be.note': 'Karnet na {cardTrips} wejść kosztuje {perTrip} za wejście, więc karnet roczny zwraca się po {be} wejściach. Licząc całe karnety faktycznie kupione, od wejścia {cashBe} trzeba by zapłacić więcej (wtedy potrzebny jest {cards} karnet).',

    'stat.cardPerTrip': 'Cena wejścia z karnetu',
    'stat.cardPerTripSub': '{price} ÷ {trips}',
    'stat.delta': 'Bilans',
    'stat.saved': 'zaoszczędzone wobec karnetów',
    'stat.owed': 'pozostało do odrobienia',

    'chart.label': 'Wejścia miesięcznie',
    'chart.empty': 'Nie ma jeszcze czego pokazać',
    'chart.tooltip': '{month}: {trips}',

    'history.label': 'Historia',
    'history.summary': '{trips} · ostatnio {date}',
    'history.none': 'Nic jeszcze nie zapisano',
    'history.empty': 'Brak wejść. Naciśnij + po następnym pływaniu.',
    'history.removeAria': 'Usuń wejście z {date}',
    'backdate.label': 'Zapisz wcześniejsze wejście',
    'backdate.add': 'Dodaj',
    'backdate.noDate': 'Najpierw wybierz datę.',
    'backdate.future': 'To jest w przyszłości.',

    'settings.label': 'Ustawienia',
    'settings.membership': 'Cena karnetu rocznego (kr)',
    'settings.cardPrice': 'Cena karnetu wielokrotnego (kr)',
    'settings.cardTrips': 'Wejścia na karnecie',
    'settings.export': 'Eksportuj dane',
    'settings.reset': 'Wyzeruj wejścia',
    'settings.note': 'Licznik jest wspólny: wszystkie urządzenia połączone z tym serwerem widzą tę samą liczbę. Wejścia zapisane bez internetu zsynchronizują się po ponownym połączeniu.',
    'settings.resetConfirm': 'Usunąć wszystkie {trips} na wszystkich urządzeniach? Tej operacji nie można cofnąć.',
    'settings.tokenPrompt': 'Kod dostępu do tego serwera Subban:',

    'rate.note': 'Kwoty są zapisywane w ISK i przeliczane po kursie Europejskiego Banku Centralnego z {date} (1 kr = {rate} {code}).',
    'rate.unavailable': 'Kurs niedostępny — kwoty w ISK.',

    'public.updated': 'Zaktualizowano {date}',
    'public.readonly': 'Widok tylko do odczytu — nic nie można zmienić.',

    'counter.offCard': '{trips} poza karnetem',
    'pool.forFun': 'poza karnetem',
    'pool.label': 'Baseny',
    'pool.empty': 'Nie zapisano jeszcze żadnego basenu',
    'pool.unattributed': 'Bez basenu',
    'pool.locating': 'Ustalanie lokalizacji…',
    'pool.off': 'Lokalizacja niedostępna',
    'pool.here': 'Jesteś przy {name}',
    'pool.away': 'Brak znanego basenu w pobliżu',
    'pool.newPrompt': 'Który to basen?',

    'sync.syncing': 'Synchronizuję…',
    'sync.synced': 'Zsynchronizowano',
    'sync.offline': 'Offline — zsynchronizuję później',
    'sync.locked': 'Wymagany kod dostępu',
    'sync.error': 'Zmiana odrzucona',
    'sync.pending': '{status} ({changes} oczekuje)',

    'n.trip': { one: '{n} wejście', few: '{n} wejścia', many: '{n} wejść' },
    'n.change': { one: '{n} zmiana', few: '{n} zmiany', many: '{n} zmian' }
  }
};

/* Icelandic takes the singular for anything ending in 1 except 11 — 21 ferð,
   31 ferð, but 11 ferðir. English is the plain n === 1. */
const PLURAL_RULE = {
  is: (n) => (Math.abs(n) % 10 === 1 && Math.abs(n) % 100 !== 11 ? 'one' : 'other'),
  en: (n) => (Math.abs(n) === 1 ? 'one' : 'other'),
  /* Polish has three: 1 wejście; 2–4 wejścia (but not 12–14); everything
     else, including 0 and 5–21, wejść. */
  pl: (n) => {
    const a = Math.abs(n), t = a % 10, h = a % 100;
    if (a === 1) return 'one';
    if (t >= 2 && t <= 4 && !(h >= 12 && h <= 14)) return 'few';
    return 'many';
  }
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
  const cat = PLURAL_RULE[lang](n);
  const form = forms[cat] ?? forms.other ?? forms.many ?? forms.one;
  return interpolate(form, { n: groupNumber(lang, n) });
}

/* Icelandic groups with dots (36.400), English with commas (36,400). */
export function groupNumber(lang, n) {
  // Polish groups with a non-breaking space (36 400), Icelandic with a dot.
  const sep = lang === 'is' ? '.' : lang === 'pl' ? '\u00a0' : ',';
  return String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}

export const kr = (lang, v) => `${groupNumber(lang, v)} kr`;

/* Icelandic writes ordinals as "3."; English needs the suffix. */
export function ordinal(lang, n) {
  if (lang === 'is' || lang === 'pl') return `${n}.`;
  const t1 = n % 10, t2 = n % 100;
  if (t1 === 1 && t2 !== 11) return `${n}st`;
  if (t1 === 2 && t2 !== 12) return `${n}nd`;
  if (t1 === 3 && t2 !== 13) return `${n}rd`;
  return `${n}th`;
}

const MONTHS = {
  is: ['janúar', 'febrúar', 'mars', 'apríl', 'maí', 'júní', 'júlí', 'ágúst', 'september', 'október', 'nóvember', 'desember'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  pl: ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień']
};

/* Polish inflects the month inside a date: a heading is "sierpień 2026" but a
   date is "22 sierpnia 2026". Languages without a separate form fall back to
   MONTHS above. */
const MONTHS_IN_DATE = {
  pl: ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia']
};
const MONTHS_SHORT = {
  is: ['jan', 'feb', 'mar', 'apr', 'maí', 'jún', 'júl', 'ágú', 'sep', 'okt', 'nóv', 'des'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  pl: ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru']
};
const WEEKDAYS_SHORT = {
  is: ['sun', 'mán', 'þri', 'mið', 'fim', 'fös', 'lau'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  pl: ['niedz.', 'pon.', 'wt.', 'śr.', 'czw.', 'pt.', 'sob.']
};

/* full  -> 18. ágúst 2026        / 18 August 2026
   day   -> þri. 18. ágú          / Tue 18 Aug
   month -> ágúst 2026            / August 2026
   short -> ágú                   / Aug              (chart axis) */
export function formatDate(lang, value, style = 'full') {
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d)) return '';
  const day = d.getDate(), mon = d.getMonth(), year = d.getFullYear();
  const wd = WEEKDAYS_SHORT[lang][d.getDay()];
  switch (style) {
    case 'day':
      return lang === 'is'
        ? `${wd}. ${day}. ${MONTHS_SHORT.is[mon]}`
        : `${wd} ${day} ${MONTHS_SHORT[lang][mon]}`;
    case 'month':
      return `${MONTHS[lang][mon]} ${year}`;
    case 'short':
      return MONTHS_SHORT[lang][mon];
    default: {
      const name = (MONTHS_IN_DATE[lang] ?? MONTHS[lang])[mon];
      return lang === 'is' ? `${day}. ${name} ${year}` : `${day} ${name} ${year}`;
    }
  }
}

/* 24-hour in both languages — Iceland uses it, and it avoids AM/PM clutter in
   a list where the time is secondary information. */
export function formatTime(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d)) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/* Icelandic unless this device has explicitly chosen otherwise. The browser's
   own language is deliberately ignored: it is an Icelandic pool, so a phone set
   to English should still open in Icelandic until someone says otherwise. */
export function detectLang() {
  const stored = localStorage.getItem('subban.lang');
  return LANGS.includes(stored) ? stored : DEFAULT_LANG;
}
