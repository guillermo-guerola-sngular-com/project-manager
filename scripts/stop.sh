#!/usr/bin/env bash
set -euo pipefail

CONTAINER_NAME="pm-app"

if [ -n "$(docker ps -a --filter "name=^/${CONTAINER_NAME}\$" --format '{{.Names}}')" ]; then
  docker rm -f "$CONTAINER_NAME" >/dev/null
  echo "Stopped $CONTAINER_NAME."
else
  echo "$CONTAINER_NAME was not running."
fi
