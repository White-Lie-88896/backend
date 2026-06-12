#!/usr/bin/env bash
set -euo pipefail

USERNAME="${1:?GHCR username is required}"

if [[ ! "$USERNAME" =~ ^[A-Za-z0-9_.-]+$ ]]; then
    echo "Invalid GHCR username." >&2
    exit 64
fi

docker login ghcr.io -u "$USERNAME" --password-stdin
