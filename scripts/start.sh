#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

IMAGE_NAME="pm-app"
CONTAINER_NAME="pm-app"
PORT="8000"

docker build -t "$IMAGE_NAME" .
docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
docker run -d --name "$CONTAINER_NAME" -p "$PORT:$PORT" --env-file .env "$IMAGE_NAME"

echo "Running at http://localhost:$PORT"
