#!/usr/bin/env bash
set -euo pipefail

IMAGE="${1:?IMAGE is required}"
APP_DIR="${2:-/opt/remnawave}"
COMPOSE_FILE="${3:-/opt/remnawave/docker-compose.yml}"
SERVICE="${4:-remnawave}"
NETWORK="${5:-remnawave-network}"
PANEL_URL="${6:-https://panel.5555557.xyz}"
RUN_MIGRATIONS="${7:-true}"

TS="$(date +%Y%m%d-%H%M%S)"
TAG_SAFE="$(printf '%s' "$IMAGE" | tr '/:' '--' | tr -c 'A-Za-z0-9_.-' '-')"
BACKUP_DIR="/opt/remnawave-backups/${TS}-${TAG_SAFE}"
SWITCHED="false"

rollback() {
    if [ "$SWITCHED" = "true" ] && [ -f "$BACKUP_DIR/docker-compose.before-ci.yml" ]; then
        echo "Rolling back compose file and service..."
        cp -a "$BACKUP_DIR/docker-compose.before-ci.yml" "$COMPOSE_FILE"
        (cd "$APP_DIR" && docker compose -f "$COMPOSE_FILE" up -d "$SERVICE") || true
    fi
}

on_exit() {
    rc="$?"
    trap - EXIT

    if [ "$rc" -ne 0 ]; then
        rollback
    fi

    exit "$rc"
}

trap on_exit EXIT

echo "Remote host: $(hostname)"
echo "Image:       $IMAGE"
echo "Backup dir:  $BACKUP_DIR"

if [ ! -f "$COMPOSE_FILE" ]; then
    echo "Compose file not found: $COMPOSE_FILE" >&2
    exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
    echo "python3 is required on the production server." >&2
    exit 1
fi

mkdir -p "$BACKUP_DIR"
cp -a "$COMPOSE_FILE" "$BACKUP_DIR/docker-compose.yml"

if [ -f "$APP_DIR/.env" ]; then
    cp -a "$APP_DIR/.env" "$BACKUP_DIR/.env"
fi

docker inspect "$SERVICE" > "$BACKUP_DIR/${SERVICE}.inspect.json" 2>/dev/null || true
CURRENT_IMAGE="$(docker inspect "$SERVICE" --format '{{.Config.Image}}' 2>/dev/null || true)"
printf '%s\n' "$CURRENT_IMAGE" > "$BACKUP_DIR/current-image.txt"

if [ -n "$CURRENT_IMAGE" ]; then
    docker image inspect "$CURRENT_IMAGE" > "$BACKUP_DIR/current-image.inspect.json" 2>/dev/null || true
fi

(cd "$APP_DIR" && docker compose -f "$COMPOSE_FILE" config > "$BACKUP_DIR/docker-compose.resolved.yml") || true

echo "Pulling image..."
docker pull "$IMAGE"
docker image inspect "$IMAGE" >/dev/null

if [ "$RUN_MIGRATIONS" = "true" ]; then
    echo "Running Prisma migrations with the new image..."
    docker run --rm \
        --network "$NETWORK" \
        --env-file "$APP_DIR/.env" \
        --entrypoint sh \
        "$IMAGE" \
        -lc 'DATABASE_URL="${DATABASE_URL%\"}"; DATABASE_URL="${DATABASE_URL#\"}"; export DATABASE_URL; npm run migrate:deploy'
fi

cp -a "$COMPOSE_FILE" "$BACKUP_DIR/docker-compose.before-ci.yml"
TMP_COMPOSE="${COMPOSE_FILE}.ci-tmp.${TS}"

python3 - "$COMPOSE_FILE" "$TMP_COMPOSE" "$SERVICE" "$IMAGE" <<'PY'
import re
import sys
from pathlib import Path

source, target, service, image = sys.argv[1:]
text = Path(source).read_text(encoding="utf-8")
lines = text.splitlines()
keep_newline = text.endswith("\n")

out = []
in_services = False
services_indent = None
service_level = None
current_service = None
found_service = False
replaced_image = False

services_re = re.compile(r"^(\s*)services:\s*(?:#.*)?$")
service_re = re.compile(r"^(\s*)([A-Za-z0-9_.-]+):\s*(?:#.*)?$")
image_re = re.compile(r"^(\s*)image:\s*")


def append_missing_image():
    global replaced_image
    out.append(" " * (service_level + 2) + f"image: {image}")
    replaced_image = True


for line in lines:
    services_match = services_re.match(line)
    if services_match:
        in_services = True
        services_indent = len(services_match.group(1))
        service_level = services_indent + 2
        out.append(line)
        continue

    if in_services and service_level is not None:
        stripped = line.strip()
        indent = len(line) - len(line.lstrip(" "))

        if stripped and not line.lstrip().startswith("#"):
            service_match = service_re.match(line)

            if indent <= services_indent:
                if current_service == service and not replaced_image:
                    append_missing_image()

                current_service = None
                in_services = False
            elif service_match and indent == service_level:
                if current_service == service and not replaced_image:
                    append_missing_image()

                current_service = service_match.group(2)
                found_service = found_service or current_service == service

        if in_services and current_service == service:
            image_match = image_re.match(line)

            if image_match:
                out.append(f"{image_match.group(1)}image: {image}")
                replaced_image = True
                continue

    out.append(line)

if current_service == service and not replaced_image:
    append_missing_image()

if not found_service:
    sys.stderr.write(f"Service {service!r} was not found in {source}.\n")
    sys.exit(42)

if not replaced_image:
    sys.stderr.write(f"Image field for service {service!r} was not updated in {source}.\n")
    sys.exit(43)

Path(target).write_text("\n".join(out) + ("\n" if keep_newline else ""), encoding="utf-8")
PY

if [ ! -s "$TMP_COMPOSE" ]; then
    echo "Temporary compose file was not created: $TMP_COMPOSE" >&2
    exit 1
fi

mv "$TMP_COMPOSE" "$COMPOSE_FILE"
SWITCHED="true"

echo "Starting service..."
(cd "$APP_DIR" && docker compose -f "$COMPOSE_FILE" up -d "$SERVICE")

echo "Waiting for service health..."
healthy="false"
for i in $(seq 1 60); do
    status="$(docker inspect "$SERVICE" --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}} {{.State.Status}} {{.Config.Image}}' 2>/dev/null || true)"
    echo "[$i] $status"

    if [ "$status" = "healthy running $IMAGE" ] || [ "$status" = "no-healthcheck running $IMAGE" ]; then
        healthy="true"
        break
    fi

    sleep 5
done

if [ "$healthy" != "true" ]; then
    echo "Service did not become healthy with image $IMAGE." >&2
    docker logs --tail 200 "$SERVICE" || true
    exit 1
fi

if [ -n "$PANEL_URL" ] && command -v curl >/dev/null 2>&1; then
    echo "Checking panel URL..."
    homepage="$(curl -kfsSL "$PANEL_URL/" || true)"

    if [ -z "$homepage" ]; then
        echo "Panel homepage check failed: $PANEL_URL" >&2
        exit 1
    fi

    asset="$(printf '%s' "$homepage" | grep -o '/assets/index-[^"]*\.js' | head -n 1 || true)"

    if [ -z "$asset" ]; then
        echo "Could not find frontend index asset in panel homepage." >&2
        exit 1
    fi

    curl -kfsSI "$PANEL_URL$asset" >/dev/null
    echo "Panel asset check passed: $asset"
fi

trap - EXIT

echo "Deployment complete: $IMAGE"
echo "Backup created: $BACKUP_DIR"
echo "Manual rollback command:"
echo "  cp -a '$BACKUP_DIR/docker-compose.before-ci.yml' '$COMPOSE_FILE' && cd '$APP_DIR' && docker compose -f '$COMPOSE_FILE' up -d '$SERVICE'"
