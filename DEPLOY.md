# Deploying Sund to an LXC container

Sund needs Node 18+ and nothing else — no `npm install`, no database, no reverse
proxy. A 512 MB container is generous.

Everything below is identical across LXC flavours once you have a shell in the
container; only steps 1 and 2 differ between Proxmox and LXD/Incus.

## 1. Create a container

Debian 12 or newer — its `nodejs` package is Node 18, which is what the code
needs. Debian 11 ships Node 12 and won't run this.

Proxmox:

```
pct create 110 local:vztmpl/debian-12-standard_12.7-1_amd64.tar.zst \
  --hostname sund --cores 1 --memory 512 --rootfs local-lvm:4 \
  --net0 name=eth0,bridge=vmbr0,ip=dhcp --unprivileged 1 \
  --features nesting=1 --start 1
```

LXD / Incus:

```
lxc launch images:debian/12 sund
```

## 2. Get a shell inside

```
pct enter 110          # Proxmox
lxc exec sund -- bash  # LXD / Incus
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
git clone https://github.com/maggifrank/sund.git /opt/sund
```

The repo is public, so no keys or tokens are needed.

## 5. Install and start the service

```
cp /opt/sund/deploy/sund.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now sund
systemctl status sund --no-pager
```

The unit runs as a `DynamicUser` with `ProtectSystem=strict`, so `/opt/sund`
stays read-only and the count is written to `/var/lib/sund/state.json` via
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
the problem is the host firewall, not Sund.

## 7. Access code (optional on a trusted LAN)

Uncomment and set `SUND_TOKEN` in `/etc/systemd/system/sund.service`:

```
systemctl daemon-reload && systemctl restart sund
```

Each device prompts for the code once and remembers it. Without it, anyone who
can reach the port can change the count — fine on a home LAN, not fine on a
public address.

## Updating

Manually:

```
cd /opt/sund && git pull && systemctl restart sund
```

### Automatically

`sund-update.timer` checks GitHub every 5 minutes and deploys anything new.
Install it once:

```
cp /opt/sund/deploy/sund-update.service /opt/sund/deploy/sund-update.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now sund-update.timer
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

If you have edited files directly in `/opt/sund`, the update refuses to
fast-forward and leaves both your changes and the running service alone. Commit
or discard them and it resumes.

Check on it:

```
systemctl list-timers sund-update.timer
```

```
journalctl -u sund-update -n 50 --no-pager
```

To pause automatic deploys: `systemctl disable --now sund-update.timer`.

## Backups

The count lives in `/var/lib/sund/state.json`, **not** in `/opt/sund`. That one
file is the only thing not reproducible from git. Everything else can be thrown
away and re-cloned.

## Bringing existing trips with you

If you have been counting on another machine, copy its state across once the
service is running:

```
curl -s http://<old-host>:8080/api/state | ssh root@<container-ip> \
  'systemctl stop sund && cat > /var/lib/sund/state.json && systemctl start sund'
```

Or use **Export data** in the app's settings on the old machine and write that
file to the same path.

## Troubleshooting

**Service won't start, `DynamicUser` or `ProtectSystem` errors.** Older systemd
in an unprivileged container may not support the hardening options. Comment out
`DynamicUser=true`, `ProtectSystem=strict` and `ProtectHome=true`, add
`User=root`, then `systemctl daemon-reload && systemctl restart sund`. You lose
some isolation but it will run.

**`SyntaxError: Unexpected token` or `Cannot use import statement`.** Node is
too old — check `node --version` is 18 or newer.

**Count resets to zero after a restart.** The state file isn't writable. Check
`journalctl -u sund` for `write failed:` and confirm `/var/lib/sund` exists and
is owned by the service user.

**Logs:**

```
journalctl -u sund -f
```
