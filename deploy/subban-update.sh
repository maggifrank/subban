#!/bin/bash
# Pull the latest Subban and restart it, but only if something actually changed
# and only if the new code comes up healthy. Run by subban-update.timer.
#
# Env: SUBBAN_REPO (default /opt/subban), SUBBAN_URL (default http://127.0.0.1:8080)
set -euo pipefail

REPO="${SUBBAN_REPO:-/opt/subban}"
URL="${SUBBAN_URL:-http://127.0.0.1:8080}"
# Remembers a revision that already failed here, so a bad push doesn't get
# retried — and the service restarted — every time the timer fires. Lives in
# .git/ because that is untracked, persistent and root-writable.
FAILED_MARK="$REPO/.git/subban-last-failed-rev"

cd "$REPO"

git fetch --quiet origin

local_rev=$(git rev-parse HEAD)
remote_rev=$(git rev-parse '@{u}')

if [ "$local_rev" = "$remote_rev" ]; then
  exit 0                              # nothing to do; stay quiet in the journal
fi

# Already tried this revision and it wouldn't start. Wait for a new push rather
# than thrashing the service every five minutes; the failure was logged then.
if [ -f "$FAILED_MARK" ] && [ "$(cat "$FAILED_MARK")" = "$remote_rev" ]; then
  exit 0
fi

# --ff-only rather than reset --hard: if someone edited files on the box, stop
# and say so instead of silently throwing their work away.
if ! git merge --ff-only "$remote_rev" >/dev/null 2>&1; then
  echo "cannot fast-forward $REPO onto ${remote_rev:0:7} — local commits or edits are in the way" >&2
  exit 1
fi

echo "updating ${local_rev:0:7} -> ${remote_rev:0:7}"
systemctl restart subban

# Give it a moment to bind the port, then check it actually serves. Requests the
# static index rather than the API, which may be behind SUBBAN_TOKEN.
healthy=false
for _ in $(seq 15); do
  if curl -fsS -o /dev/null --max-time 2 "$URL/"; then healthy=true; break; fi
  sleep 1
done

if [ "$healthy" = true ]; then
  rm -f "$FAILED_MARK"
  echo "updated to ${remote_rev:0:7} and healthy"
  exit 0
fi

echo "new revision ${remote_rev:0:7} failed its health check — rolling back to ${local_rev:0:7}" >&2
echo "$remote_rev" > "$FAILED_MARK"
git reset --hard "$local_rev" >/dev/null
systemctl restart subban
exit 1
