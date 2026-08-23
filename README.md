# Sund

A swim-trip tracker. Tap **+** after each visit and watch the yearly membership
turn from an expensive mistake into a bargain.

The count is **shared across devices** — log a swim on your phone at the pool,
see it on your laptop at home. Same tree runs from an LXC container or from
Netlify, with no code changes.

## What it works out

| | |
|---|---|
| Membership | 36.400 kr / year |
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

All three numbers are editable under ⚙, and the change syncs like everything else.

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
| `POST /api/trips` | log a swim |
| `DELETE /api/trips/last` | undo the last one |
| `DELETE /api/trips` | clear the season |
| `PUT /api/settings` | change the prices |

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

## Moving to Netlify later

`netlify.toml` and `netlify/functions/trips.js` are already here. The function
serves the same API backed by [Netlify Blobs](https://docs.netlify.com/blobs/overview/)
instead of a file, and claims `/api/*` through its own `config.path`.

```bash
netlify deploy --prod
```

Or connect the GitHub repo in the Netlify UI and take the defaults — Netlify
installs `@netlify/blobs` and bundles the function itself.

**Set `SUND_TOKEN` before you do this.** On the LAN an open endpoint is fine; on
a public URL it means anyone who finds it can edit your swim count.

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
- **No history view.** Trips are timestamped and included in the export, but the
  UI only shows the count and the date of the last swim.

## Files

| | |
|---|---|
| `index.html` `styles.css` `app.js` | the app |
| `lib/state.js` `lib/api.js` | domain logic and routing, shared by everything |
| `serve.js` | LXC backend — static files + API, file-backed, no dependencies |
| `netlify/functions/trips.js` | Netlify backend — same API, Blobs-backed |
| `deploy/sund.service` | systemd unit |
| `DEPLOY.md` | LXC deployment runbook |
