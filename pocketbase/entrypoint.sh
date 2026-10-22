#!/bin/sh
# Starts as root only to hand pb_data to `pb`, then runs PocketBase as `pb`.
# Fly mounts the volume over /pb/pb_data root-owned, and the data written before
# PocketBase ran unprivileged is root's too; once handed over it stays `pb`'s, so
# the recursive chown runs on the first boot only.
set -e
mkdir -p /pb/pb_data
if [ -n "$(find /pb/pb_data ! -user pb -print -quit)" ]; then
  chown -R pb:pb /pb/pb_data
fi
exec su-exec pb "$@"
