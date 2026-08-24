# Deploying Subban to an LXC container

Subban needs Node 18+ and nothing else — no `npm install`, no database, no reverse
proxy. A 512 MB container is generous.

Everything below is identical across LXC flavours once you have a shell in the
container; only steps 1 and 2 differ between Proxmox and LXD/Incus.

## 1. Create a container

Debian 12 or newer — its `nodejs` package is Node 18, which is what the code
needs. Debian 11 ships Node 12 and won't run this.

Proxmox:

```
pct create 110 local:vztmpl/debian-12-standard_12.7-1_amd64.tar.zst \
  --hostname subban --cores 1 --memory 512 --rootfs local-lvm:4 \
  --net0 name=eth0,bridge=vmbr0,ip=dhcp --unprivileged 1 \
  --features nesting=1 --start 1
```

LXD / Incus:

```
lxc launch images:debian/12 subban
```

## 2. Get a shell inside

```
pct enter 110          # Proxmox
lxc exec subban -- bash  # LXD / Incus
```

Everything from here runs **inside the container**.

## 3. Install Node and git

```
apt-get update && apt-get install -y nodejs git
```

Confirm the version and the binary path:

```
node --version && command -v node
```

If `node` is not at `/usr/bin/node`, change `ExecStart=` in the unit file in
step 5 to match.

## 4. Clone

```
git clone https://github.com/maggifrank/subban.git /opt/subban
```

The repo is public, so no keys or tokens are needed.

## 5. Install and start the service

```
cp /opt/subban/deploy/subban.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now subban
systemctl status subban --no-pager
```

The unit runs as a `DynamicUser` with `ProtectSystem=strict`, so `/opt/subban`
stays read-only and the count is written to `/var/lib/subban/state.json` via
`StateDirectory`.

## 6. Check it

```
hostname -I
curl -s http://localhost:8080/api/state
```

The API should return `{"trips":[],"settings":{...},"rev":0}`.

Then open `http://<container-ip>:8080` on a laptop and a phone. Both should show
the same count, and a swim logged on one appears on the other within 15 seconds —
immediately if you switch to the app rather than leaving it in the background.

If `curl` works inside the container but nothing else on the LAN can reach it,
the problem is the host firewall, not Subban.

## 7. Access code (optional on a trusted LAN)

Uncomment and set `SUBBAN_TOKEN` in `/etc/systemd/system/subban.service`:

```
systemctl daemon-reload && systemctl restart subban
```

Each device prompts for the code once and remembers it. Without it, anyone who
can reach the port can change the count — fine on a home LAN, not fine on a
public address.

## Updating

Manually:

```
cd /opt/subban && git pull && systemctl restart subban
```

### Automatically

`subban-update.timer` checks GitHub every 5 minutes and deploys anything new.
Install it once:

```
cp /opt/subban/deploy/subban-update.service /opt/subban/deploy/subban-update.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now subban-update.timer
```

From then on, pushing to `main` from your laptop puts the change on the
container within five minutes. The container polls GitHub rather than GitHub
pushing to it, so nothing needs to be exposed to the internet.

It only acts when the revision actually changed, so an unchanged check writes
nothing to the journal. After restarting it fetches `/` until the app answers,
up to 15 seconds. If it never does, the update is **rolled back** to the
previous revision and that revision is recorded as failed, so a bad push
restarts the service once rather than every five minutes forever — push a fix
and the next run picks it up and clears the mark.

If you have edited files directly in `/opt/subban`, the update refuses to
fast-forward and leaves both your changes and the running service alone. Commit
or discard them and it resumes.

Check on it:

```
systemctl list-timers subban-update.timer
```

```
journalctl -u subban-update -n 50 --no-pager
```

To pause automatic deploys: `systemctl disable --now subban-update.timer`.

## Publishing the public read-only site

The container can publish its own snapshot to Netlify on a timer. It reaches
*out* to Netlify, exactly like the GitHub poller — nothing new is exposed
inbound, and the LAN-only rule is unchanged.

First create a Netlify **personal access token** at
<https://app.netlify.com/user/applications#personal-access-tokens>. Then, on the
container, create the environment file with restrictive permissions *before*
putting the token in it, so it is never briefly world-readable and never lands
in your shell history:

```
install -m 600 /dev/null /etc/subban-publish.env
```

```
nano /etc/subban-publish.env
```

with a single line:

```
NETLIFY_AUTH_TOKEN=nfp_your_token_here
```

Then install the timer:

```
cp /opt/subban/deploy/subban-publish.service /opt/subban/deploy/subban-publish.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now subban-publish.timer
```

Publish immediately rather than waiting for the first tick:

```
systemctl start subban-publish.service && journalctl -u subban-publish -n 5 --no-pager
```

A successful run logs `deployed <id> to https://... — no functions, verified`.
A run with no new trips logs `no change since rev N — nothing to publish` and
does not deploy at all, so the 15-minute schedule costs one local HTTP request
almost every time.

The site id is set in the unit; only the token lives in the environment file.
Revoke it from the same Netlify page if the container is ever compromised —
it grants deploy access to your Netlify account, nothing on the container.

## Backups

The count lives in `/var/lib/subban/state.json`, **not** in `/opt/subban`. That one
file is the only thing not reproducible from git. Everything else can be thrown
away and re-cloned.

## Bringing existing trips with you

If you have been counting on another machine, copy its state across once the
service is running:

```
curl -s http://<old-host>:8080/api/state | ssh root@<container-ip> \
  'systemctl stop subban && cat > /var/lib/subban/state.json && systemctl start subban'
```

Or use **Export data** in the app's settings on the old machine and write that
file to the same path.

## Troubleshooting

**Service won't start, `DynamicUser` or `ProtectSystem` errors.** Older systemd
in an unprivileged container may not support the hardening options. Comment out
`DynamicUser=true`, `ProtectSystem=strict` and `ProtectHome=true`, add
`User=root`, then `systemctl daemon-reload && systemctl restart subban`. You lose
some isolation but it will run.

**`SyntaxError: Unexpected token` or `Cannot use import statement`.** Node is
too old — check `node --version` is 18 or newer.

**Count resets to zero after a restart.** The state file isn't writable. Check
`journalctl -u subban` for `write failed:` and confirm `/var/lib/subban` exists and
is owned by the service user.

**`status=238/STATE_DIRECTORY`, journal says `Failed to set up special
execution directory in /var/lib: File exists`.** Something is sitting where
systemd wants to manage its own state directory. Because the unit uses
`DynamicUser=true`, the real directory is `/var/lib/private/subban` and
`/var/lib/subban` is only a **symlink** to it — so moving or restoring
`/var/lib/subban` by hand leaves a stale entry systemd refuses to touch.

Fix it in `/var/lib/private`, not `/var/lib`:

```
systemctl stop subban
rm -f /var/lib/subban                 # a symlink, not your data
mv /var/lib/private/<old> /var/lib/private/subban
chown --reference=/var/lib/private/subban /var/lib/private/subban/state.json
systemctl start subban
```

Check the destination does not already exist before that `mv` — if it does, `mv`
puts the source *inside* it and the app starts on an empty state. The startup
log tells you which happened: `State file: ... (will be created)` means it is
not finding the file. The dynamic user's UID changes with the service name, so
the `chown` matters — without it the count reads correctly but new trips fail
to save.

**Logs:**

```
journalctl -u subban -f
```
