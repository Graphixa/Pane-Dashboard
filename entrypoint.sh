#!/bin/sh
set -e

if [ -n "$PUID" ] && ! echo "$PUID" | grep -Eq '^[0-9]+$'; then
	echo "[entrypoint] ERROR: PUID must be a numeric integer or unset." >&2
	exit 1
fi
if [ -n "$PGID" ] && ! echo "$PGID" | grep -Eq '^[0-9]+$'; then
	echo "[entrypoint] ERROR: PGID must be a numeric integer or unset." >&2
	exit 1
fi
if [ -z "$PUID" ] && [ -n "$PGID" ]; then
	echo "[entrypoint] ERROR: PGID requires PUID." >&2
	exit 1
fi

# Unset or 0: run as root (matches ConvertX-style default when PUID is unset).
if [ -z "$PUID" ] || [ "$PUID" -eq 0 ]; then
	if [ -n "$UMASK" ]; then
		umask "$UMASK"
	fi
	exec /usr/local/bin/pane "$@"
fi

PGID=${PGID:-$PUID}
UMASK=${UMASK:-002}
umask "$UMASK"

mkdir -p /config
if [ "$(stat -c '%u:%g' /config 2>/dev/null)" != "$PUID:$PGID" ]; then
	chown -R "$PUID:$PGID" /config
fi

exec su-exec "$PUID:$PGID" /usr/local/bin/pane "$@"
