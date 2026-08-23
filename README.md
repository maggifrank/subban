# Sund

A swim-trip tracker. Tap **+** after each visit and watch the yearly membership
turn from an expensive mistake into a bargain.

No dependencies, no build step, no backend — three static files and a counter in
`localStorage`. It runs off a USB stick, an LXC container, or Netlify, unchanged.

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

All three numbers are editable under ⚙ if prices change.

## Running it locally

```bash
node serve.js
```

Then open <http://localhost:8080>. Any static server does just as well —
`python3 -m http.server 8080` or pointing nginx at this directory.

### In an LXC container

```bash
pct exec <ctid> -- bash -c 'apt-get update && apt-get install -y nodejs git'
pct exec <ctid> -- git clone https://github.com/maggifrank/sund.git /opt/sund
pct exec <ctid> -- useradd --system --home /opt/sund sund
pct exec <ctid> -- cp /opt/sund/deploy/sund.service /etc/systemd/system/
pct exec <ctid> -- systemctl enable --now sund
```

It listens on `0.0.0.0:8080`, so it's reachable at the container's IP from
anywhere on the LAN — including the phone in your swim bag. `git pull &&
systemctl restart sund` to update.

## Moving to Netlify later

Nothing to change. `netlify.toml` is already here and publishes the repo root
with an empty build command:

```bash
netlify deploy --prod
```

Or connect the GitHub repo in the Netlify UI and take the defaults. Because the
app is pure static files with no server-side anything, the LXC and Netlify
copies behave identically.

## A caveat worth knowing

Trips are stored in `localStorage`, which means **per browser, per device**.
Counting on your phone and your laptop gives you two separate tallies. For one
shared count you'd need a backend, which would also end the "deploy it anywhere"
simplicity — so for now, pick one device and use **Export data** in settings to
take a JSON backup.

## Files

| | |
|---|---|
| `index.html` `styles.css` `app.js` | the whole app |
| `serve.js` | zero-dependency static server |
| `deploy/sund.service` | systemd unit for the LXC |
| `netlify.toml` | Netlify config, unused until you deploy there |
