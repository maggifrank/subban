# Sund

A swim-trip tracker. Tap **+** after each visit and watch the yearly membership
turn from an expensive mistake into a bargain.

The count is **shared across devices** — log a swim on your phone at the pool,
see it on your laptop at home.

It runs in two places behind **one address**, <https://sund.talva.is>. Inside
the LAN that name resolves to the container and you get the full read/write app.
From outside it resolves to Netlify and you get a read-only snapshot, with no
API behind it to write to. Same URL, two faces, decided by DNS.

## What it works out

| | |
|---|---|
| Membership | 36.400 kr / year |
| Valid | **23.08.26 – 23.08.27**, both days inclusive |
| Alternative | 30-trip card at 14.000 kr → **467 kr per trip** |
| Break-even | **78 trips** |

**Cost per trip so far** is the membership spread over the trips actually taken:
`36.400 ÷ trips`. First swim costs 36.400 kr, the second brings it to 18.200,
the tenth to 3.640, and so on down.

**Break-even** is where those two lines cross. A 30-trip card is 14.000 ÷ 30 =
466,67 kr a trip, so the membership catches up at `36.400 ÷ 466,67` = **78 trips**
— call it three swims a fortnight. Every trip after that is free.

There is a second, blunter reading the app also shows: cards are bought whole,
not by the trip. You'd buy the 3rd card on trip 61, and only at that point have
handed over more cash (42.000 kr) than the membership cost. So **61** is when
you're ahead on money spent, **78** is when you're ahead on value received.

All three numbers are editable under ⚙, along with everything else that defines
the card: [the dates it is valid between](#the-cards-dates) and
[which pools it covers](#pools). Every change syncs like everything else.

## Languages

Icelandic, English and Polish, picked from the header and remembered per device.
On a first visit the browser's own preference decides, defaulting to Icelandic.

All three are complete — labels, the break-even sentence, sync statuses, confirm
dialogs, month and weekday names, and the chart. Three things a plain string
table would get wrong are handled properly:

- **Plurals.** Icelandic takes the singular for any number ending in 1 except 11
  — *21 ferð* but *11 ferðir*. Polish has three forms — *1 wejście*, *2–4
  wejścia*, *5+ wejść* — with 12–14 falling back to the third (*12 wejść*, but
  *22 wejścia*). English is the plain `n === 1`.
- **Number grouping.** Icelandic groups with dots (36.400), Polish with
  non-breaking spaces (36 400), English with commas (36,400).
- **Case.** Polish inflects the month inside a date: the history heading reads
  *sierpień 2026* but a trip is dated *23 sierpnia 2026*. Languages without a
  separate in-date form fall back to the one list.

Dates and numbers are formatted by hand rather than through `Intl`, because the
browsers this runs in may not ship `is-IS` locale data and `Intl` fails soft — it
would quietly print Icelandic prices with US commas rather than erroring.

## Currency

The display currency follows the language: **ISK** in Icelandic, **USD** in
English, **PLN** in Polish.

Everything is *stored and entered* in ISK, because that is the money actually
handed over at the pool. Other currencies are a display conversion applied on
the way out, so the settings fields stay in kr in every language and a rounding
trip through zloty can never corrupt a recorded price. A line at the foot of the
app says which rate was used and when, so no converted figure is presented as if
it were a till receipt.

Rates come from the European Central Bank via
[frankfurter.dev](https://frankfurter.dev) — no API key, no account. The server
fetches them, caches for 12 hours (the ECB publishes once a working day) and
retries after 10 minutes if a fetch fails, so a rates outage costs one log line
rather than a stream of requests. **If no rate is available the app shows ISK and
says so** rather than inventing one.

This is the app's only outbound network call. `GET /api/rates` sits behind the
same access code as everything else, so an open instance can't be used to drive
outbound fetches on your behalf.

## Trips per month

A column chart above the history panel, one bar per month from your first trip
to now, capped at the last 12. **Months with no swimming are kept as gaps** — the
break in the bars is part of the picture, and dropping those months would space
the remaining bars evenly and misstate the timeline.

One series, so one color and no legend; the peak month is labelled and the rest
are left to the axis and the tooltip. Hovering or tapping a column gives the
month and its count. Colors were checked with a palette validator rather than by
eye: the chart mark is its own token because the UI accent falls outside the
required lightness band against the dark card surface.

The history panel below is the chart's table view — same data, every trip listed.

## The card's dates

A membership runs for a year, and the app used to have no idea when that year
started. Every trip ever logged counted, so a previous season — swum on 30-trip
cards at the very same three pools — was folded into the card's arithmetic and
made the cost per trip look far better than it really was.

Only swims between **valid from** and **valid until** pay the card off. Both
ends are inclusive, and either may be left blank: a card with only a start date
counts everything from that day on, and with neither set every trip counts,
exactly as it did before this existed.

The current card's dates live in `DEFAULT_SETTINGS` beside its prices, which are
the same card's facts. That matters for the changeover: a state file written
before this existed has no season fields at all, so `normalize()` fills them
from the defaults and the dates apply to the history already on disk — no
settings step, nothing to migrate. Both dates are still editable under ⚙, which
is where next year's card gets entered.

Nothing is deleted. The earlier trips stay in the history, the chart and the
pool table as they were; they are tagged *outside the dates* in the history
list, and the counter card says how many there are. **Rolling over to next
year's membership is now a matter of moving the two dates**, not **Reset
trips** — the record survives the renewal.

The bounds are compared as **local calendar dates**, not as instants. They are
the dates printed on the card, and every date the app shows — a history row, a
chart column, the midday anchor a backdated trip is stored at — is already the
local one.

A date is validated by round trip rather than by `Date.parse`, which is not a
validator: it takes `2026-02-30` happily and hands back the 2nd of March, so a
typo would be stored as a real but wrong bound.

**Neither field constrains the other.** They did at first, through `min` and
`max`, so that an end before its start could not be entered — and that quietly
made renewal impossible. Next year's card starts the day after this one ends,
so every valid new start date sat outside the old `max`: the native picker
greyed those days out, a typed one failed validation, and the field simply
sprang back to its old value with nothing saved and no reason given. The one
edit the feature exists to support was the one it refused.

So an inverted range is now stored like any other and **said out loud** — the
settings panel shows *the end date is before the start date, so no trip counts*
— rather than being silently undone. Set the start, then the end, and the
warning clears on the second edit.

## Pools

**The card covers three pools out of the box** — Suðurbæjarlaug, Sundhöll
Hafnarfjarðar and Ásvallalaug, all in Hafnarfjörður — and **which pools it
covers is a setting**, under ⚙, not something fixed in code. Only swims at the
chosen pools pay the card off, so only those feed the big counter, the cost per
trip, break-even and the ahead/behind figure. Anywhere else is logged for the record and shows in the chart, the
history and the pool table, but never in the money. Where is only half of it;
the other half is when, which is [the card's dates](#the-cards-dates) above.

The counter card says how many trips each of the two rules left out, as separate
figures rather than one lump: a swim outside the dates is reported as such
whatever pool it was at, so the three numbers always add up to the total. The
pool table tags the pools, and the history tags the dates. Both follow the
settings, so unticking a pool retags its rows immediately.

A trip with no pool attached — anything logged before this existed, or with
location switched off — still counts, which is what it did before. The app never
silently drops a swim because it could not work out where you were.

### Choosing them

⚙ lists every pool the app knows about, each with a checkbox and, for the ones
you have been to, how often — which is what makes a hundred-odd rows navigable.
A search box narrows the list, and the list is built once and then filtered by
hiding rows, so ticking a box does not throw away what you typed or where you
had scrolled.

`settings.cardPools` holds the choice as a list of ids. It starts `null`,
meaning *no choice saved, use the built-in list*, so the boxes already show the
card as it shipped and nothing has to be migrated. The first tick turns that
into an explicit list — starting from what is currently covered, so ticking a
fourth pool gives you four rather than one.

Two consequences of an explicit list are worth stating. It is **exhaustive**: on
the built-in path an unrecognised pool id counts, rather than being dropped for
being unfamiliar, but a list someone wrote by hand is the whole answer, so an id
that is not on it does not count. And **every pool unticked is a real choice**,
kept as an empty list rather than folded back into `null` — which would silently
restore three pools nobody asked for.

**The chosen ids never reach the public site.** A list of pools is a list of
neighbourhoods, which is the very thing the pool is stripped from every trip to
avoid saying, so `bin/publish.mjs` drops `cardPools` from the published settings
the same way it drops the pools themselves. The public page never needs it: its
trips arrive already filtered and its counts are worked out at publish time.

Tapping **+** attaches the pool you're standing at. The app keeps a position
warm while it is on screen, so the check-in resolves immediately rather than
making the count wait on a GPS fix, and a line under the counter says what it
thinks — *You're at Laugardalslaug*, *No known pool nearby*, or *Location
unavailable* — so it is never guessing behind your back.

`lib/pools.js` carries all 100 pools listed at
[sundlaugar.is](https://sundlaugar.is/sundlaugar/). That directory has names but
**no coordinates at all**, so positions were looked up in OpenStreetMap by name.
54 matched and can be detected by location; the other 46 carry a name only —
they cannot be auto-detected, but they appear in the History picker, so a swim
can still be attributed to them by hand.

OSM tags these inconsistently (Laugardalslaug is a `shelter`, Sundhöll
Reykjavíkur a `sauna`), so the matching is by name, and a point sits somewhere
inside a complex rather than at its door. Nothing is matched further than 250 m,
which absorbs that. Anywhere still unknown, the app asks for a name once,
remembers the coordinates, and recognises it from then on.

A table at the bottom counts visits per pool, most-visited first, with anything
logged without a pool last, and totals them. The counter card states the total
too — the big number is card swims only, so the total is said outright rather
than left to be worked out from the difference.

Every row in History shows its pool and **can be tapped to change it** — pick
another, or detach it entirely. That is how a backdated trip gets a pool at all
(you are not standing at the pool when you log one), how anything recorded
before pools existed gets attributed, and how a mis-matched check-in gets
corrected. The money follows immediately: move a swim to a pool the card does
not cover and the counter drops. Trips recorded before this existed, or with location
switched off, simply have no pool — the count is unaffected.

**Pools never reach the public site.** Which pool says which neighbourhood you
were in, so `bin/publish.mjs` drops the pool from every trip and publishes an
empty pool list, the same way it drops the time. Nothing is hidden in the page
that isn't also absent from `state.json`.

The public page shows the total number of swims and how many of those the card
did not cover, split by which rule left them out, but as **plain counts** — no
dates, no pools. It says that swimming happened outside the card, not where or
when. An older snapshot without those counts simply hides the line.

The public snapshot also contains **only the trips that count toward the card** —
inside its dates, at one of its pools.
That page is about what the membership costs per swim, so publishing the for-fun
ones would make its arithmetic disagree with the app — and stripping the pool
while keeping the trip would leave no way to tell them apart. Its monthly chart
therefore shows card swims only, where the app's shows everything.

## History

Every trip is timestamped, and the **History** panel lists them newest-first,
grouped by month with a count per month — enough to see whether you're on pace
for 78 without doing arithmetic. Each row can be deleted individually, which is
the only way to fix a mis-tap from three weeks ago; the − button only ever
removes the most recent trip.

Deletes are matched by timestamp rather than position, so removing a trip on one
device does the right thing even if the other device added one meanwhile. A
delete that has already been applied is a no-op rather than an error, so a queued
offline delete can't remove two trips if it gets retried.

**Log a past swim** at the top of the panel backdates a trip you forgot to
record. Future dates are refused, by the date picker and again by the server.

Backdated trips are stored at local **midday**, not midnight. Midnight would
round-trip correctly on the device that logged it, but stored as `00:00Z` it
reads as the previous day on any device west of UTC; midday leaves twelve hours
of slack either way. Since a backdated entry has no real clock time, the history
shows it as a date alone — only live taps display a time.

## The saved data

State is one JSON file. Every shape this app has ever written still loads:
bare ISO strings from before pools existed, trip objects without a card flag,
and the current form. `normalize()` in `lib/state.js` is the single entry point,
and it drops anything malformed rather than refusing the file — a corrupt entry
costs you that entry, not the whole history.

Card membership is read from the built-in list first, not from the saved pool
record. A pool saved before `card` existed carries no flag, and trusting the
saved copy alone would silently stop counting real card swims the moment an
older backup was restored. Which pools the card covers is a property of the
card, not of whatever happens to be on disk.

## How syncing works

Taps apply **instantly** and sync in the background, so the app stays usable on
one bar of signal in a changing room. Offline taps queue up in `localStorage`
and flush when you reconnect — the status pill in the header tells you where
things stand (`Synced`, `Syncing…`, `Offline — will sync later`).

Operations are sent as **deltas** ("add a trip"), never as "set the count to 11".
If your phone and laptop each log a swim while out of contact, the server ends up
with both, instead of one silently overwriting the other.

Other devices' changes arrive on a 15-second poll, plus an immediate refresh
whenever you open or return to the app. There is no websocket — for a counter you
touch a few times a week, polling is less to go wrong.

### The API

| | |
|---|---|
| `GET /api/state` | full state — trips, settings, `rev` |
| `POST /api/trips` | log a swim — optional `{ at }` to backdate |
| `DELETE /api/trips/last` | undo the last one |
| `DELETE /api/trips/one` | remove one trip by timestamp (`{ at }`) |
| `DELETE /api/trips` | clear the season |
| `GET /api/rates` | cached ECB rates for the display conversion |
| `PUT /api/settings` | change the prices, or the card's dates |

`lib/state.js` (the domain logic) and `lib/api.js` (the routing) are shared by
both backends *and* by the browser, so the two deployments can't drift apart and
the break-even maths exists in exactly one place.

## Running it locally

```bash
node serve.js
```

Then open <http://localhost:8080>. Still no `npm install` needed — `serve.js`
uses only the Node standard library. The `@netlify/blobs` dependency in
`package.json` is imported solely by the Netlify function.

State is written to `data/state.json`, or wherever `SUND_DATA` points.

### In an LXC container

Full runbook in **[DEPLOY.md](DEPLOY.md)** — container creation, systemd, access
codes, backups and troubleshooting. The short version:

```bash
apt-get install -y nodejs git
git clone https://github.com/maggifrank/sund.git /opt/sund
cp /opt/sund/deploy/sund.service /etc/systemd/system/
systemctl enable --now sund
```

It listens on `0.0.0.0:8080`, so every device on the LAN — including the phone in
your swim bag — points at the container's IP and shares one count.

The count lives in `/var/lib/sund/state.json`, not in the repo. Back up that file.

Install `deploy/sund-update.timer` as well and the container polls GitHub every
five minutes, deploying anything you push — with a health check and automatic
rollback if the new revision won't start. See [DEPLOY.md](DEPLOY.md).

## The public read-only site

<https://sund.talva.is> from outside the LAN — a snapshot of the count, the
cost per trip, break-even and the chart, with no way to change anything. Its
direct Netlify address is <https://sund-swim.netlify.app>.

The same hostname serves the private app inside the LAN, through split-horizon
DNS: internally it resolves to Caddy and on to the container, externally to
Cloudflare and on to Netlify. The container itself is on a private address and
is not routable from the internet, so the writable app is only ever reachable
from home. Nothing distinguishes the two by path or port — the split is entirely
in what the name resolves to.

It is read-only **by construction, not by hiding buttons**: the deploy is static
files plus a `state.json` snapshot, with no API and no function behind it. There
is nothing to authenticate because there is nothing to write to.

The history shows **dates without times**. The times are stripped from the
snapshot itself, not merely hidden in the page — otherwise they would still sit
in `state.json` for anyone who opened it directly. Every published trip is
anchored at local midday, which preserves the date and the count (two swims on
one day stay two rows) while dropping the hour. Nothing on the public page needs
the time: the count, cost per trip, break-even and the monthly chart all work
off dates alone. The private app is unaffected and still records and shows exact
times.

The container republishes within seconds of a swim — see
[DEPLOY.md](DEPLOY.md#publishing-the-public-read-only-site). To publish by hand
from anywhere that can reach a running instance:

```bash
node bin/publish.mjs --source http://<container-ip>:8080 --deploy
```

It deploys through Netlify's file API rather than the CLI, uploading exactly the
files it lists and nothing else, then asks Netlify what it actually published and
**fails if any function is present**. It also walks the built module graph and
**refuses to publish if an import points at a file the build does not contain** —
that list of files is maintained by hand, so a shared module growing a new import
would otherwise 404 in the browser, break the whole graph and render a blank
page, while `state.json` kept serving perfectly and every other check looked
fine. Both of those exist because of a real
mistake: the CLI resolves its project base by walking up from the deploy
directory, found `netlify/functions`, and put the read/write API on the public
site even though `--dir dist` was passed. Enumerating the files makes that
impossible rather than merely guarded against.

Publishing is **event-driven**: `serve.js` touches a trigger file after every
change and a systemd path unit republishes within seconds. A six-hourly timer
remains as a safety net, so `--if-changed` still guards against redundant
deploys — it compares the trip count *and* the ECB rate date, so the safety net
also refreshes a stale rate when nobody has been swimming. Set `SUND_TOKEN` if the source instance requires
an access code, and `NETLIFY_AUTH_TOKEN` to deploy from a machine without the
Netlify CLI signed in.

## Running the whole app on Netlify

`netlify.toml` and `netlify/functions/trips.js` implement the full read/write API
against [Netlify Blobs](https://docs.netlify.com/blobs/overview/) instead of a
file, claiming `/api/*` through the function's own `config.path`. It is unused —
the app runs on the LXC — but kept working as an escape hatch.

> **Do not run `netlify deploy` from this directory.** The repo's `.netlify`
> link points at `sund-swim`, which is the *public read-only site*. A deploy
> from here would replace that static snapshot with the read/write app and put
> an API on a public URL. Publishing is done by `bin/publish.mjs`, which uploads
> an explicit file list and refuses to finish if a function lands in the deploy.

If you ever do want the whole app on Netlify, create a **separate site** for it,
and set `SUND_TOKEN` in its environment first — otherwise anyone who finds the
URL can edit the count.

## The access code

Optional, off by default. Set `SUND_TOKEN` on the server (systemd `Environment=`,
or Netlify environment variables) and every device will prompt for it once and
remember it. Without it the API is open to anyone who can reach the port.

Note this guards the API, not the static files — it keeps people from *changing*
your count, and is a shared code rather than real per-user accounts.

## Known limits

- **Last write wins on settings.** Two devices changing prices in the same second
  could have one overwrite the other. Trips aren't affected — those are deltas.
- **On Netlify, the blob read-modify-write isn't transactional.** Two swims
  logged in the same instant from different devices could theoretically collapse
  into one. The LXC backend serializes writes and doesn't have this problem.
- **Backdating is date-only.** You can log that you swam last Tuesday, but not
  that it was at 7am. The entry is stored at midday and displayed without a time.
- **The Icelandic and Polish are mine, not a native speaker's.** The grammar and
  plural rules are right, but term choices are worth a second opinion —
  *núllpunktur* / *fjölnotakort* in Icelandic, and *wejście* (pool admission)
  and *próg opłacalności* in Polish.
- **Conversion is display-only and follows the language.** Someone reading in
  Polish still pays ISK at the pool; the zloty figure is a convenience, not a
  price. There is no way to pick a currency independently of the language.
- **The public page can be up to six hours behind on exchange rates.** The count
  itself republishes within seconds of a swim; only the ECB rate waits for the
  safety-net timer, and the page always names the rate's date.
- **A pool can only be set from the History list.** There is no bulk edit, so
  attributing a long backlog is one tap per trip.
- **Export has no matching import.** Settings offers *Export data*, which writes
  the current state as JSON, but there is no way to load one back through the
  app. Restoring means writing the file to `/var/lib/sund/state.json` and
  restarting — see [DEPLOY.md](DEPLOY.md).
- **One membership at a time.** The card has a single pair of dates and a single
  set of pools, so the app shows this year's card or last year's, not both.
  Older seasons stay in the history and the chart, but their own cost per trip
  is gone once the dates move on.
- **A pool has to be in the list to be picked.** The ⚙ list is the built-in 107
  plus anywhere you have named on the spot. Somewhere you have never been and
  that `lib/pools.js` has never heard of cannot be ticked until a swim there
  puts it in the list.

## Files

| | |
|---|---|
| `index.html` `styles.css` `app.js` | the private read/write app |
| `public/` | the public read-only page |
| `lib/state.js` | trips, settings and the break-even arithmetic |
| `lib/api.js` | HTTP routing and validation, shared by both backends |
| `lib/i18n.js` | Icelandic, English and Polish strings, plurals, dates, number formats |
| `lib/money.js` | currency per language, conversion and formatting |
| `lib/chart.js` | the trips-per-month chart, shared by both pages |
| `lib/rates.js` | ECB rate fetching and cache freshness |
| `serve.js` | LXC backend — static files + API, file-backed, no dependencies |
| `netlify/functions/trips.js` | unused Netlify backend — same API, Blobs-backed |
| `bin/publish.mjs` | snapshot, build and deploy the public site |
| `deploy/sund.service` | the app |
| `deploy/sund-update.*` | poll GitHub every 5 min, deploy with rollback |
| `deploy/sund-publish.*` | publish the public snapshot every 15 min |
| `DEPLOY.md` | LXC deployment runbook |
