param(
    [string]$WorkspaceRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path,

    [string]$ImageRepository = 'remnawave/backend',

    [string]$ImageTag,

    [string]$ProdHost = 'DC1',

    [string]$RemoteAppDir = '/opt/remnawave',

    [string]$RemoteComposeFile = '/opt/remnawave/docker-compose.yml',

    [string]$ServiceName = 'remnawave',

    [string]$NetworkName = 'remnawave-network',

    [string]$PanelUrl = 'https://panel.5555557.xyz',

    [switch]$RunMigrations,

    [switch]$SkipFrontendTypecheck,

    [switch]$SkipSmokeTest,

    [switch]$KeepTar,

    [switch]$PlanOnly
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Write-Step {
    param([Parameter(Mandatory = $true)][string]$Message)

    Write-Host ''
    Write-Host "==> $Message"
}

function Invoke-Native {
    param(
        [Parameter(Mandatory = $true)]
        [string]$FilePath,

        [string[]]$ArgumentList = @(),

        [string]$WorkingDirectory
    )

    $display = "$FilePath $($ArgumentList -join ' ')"

    if ($WorkingDirectory) {
        Write-Host "[$WorkingDirectory] > $display"
        Push-Location -LiteralPath $WorkingDirectory
    } else {
        Write-Host "> $display"
    }

    try {
        & $FilePath @ArgumentList

        if ($LASTEXITCODE -ne 0) {
            throw "Command failed with exit code ${LASTEXITCODE}: $display"
        }
    } finally {
        if ($WorkingDirectory) {
            Pop-Location
        }
    }
}

function Invoke-PowerShellFile {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,

        [string[]]$ArgumentList = @(),

        [string]$WorkingDirectory
    )

    $display = "$Path $($ArgumentList -join ' ')"

    if ($WorkingDirectory) {
        Write-Host "[$WorkingDirectory] > $display"
        Push-Location -LiteralPath $WorkingDirectory
    } else {
        Write-Host "> $display"
    }

    try {
        & $Path @ArgumentList
    } finally {
        if ($WorkingDirectory) {
            Pop-Location
        }
    }
}

function Invoke-GitOutput {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Repository,

        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    $output = & git -C $Repository @Arguments 2>$null

    if ($LASTEXITCODE -ne 0) {
        return $null
    }

    return ($output -join "`n").Trim()
}

function Invoke-SshScript {
    param(
        [Parameter(Mandatory = $true)]
        [string]$HostName,

        [Parameter(Mandatory = $true)]
        [string]$Script,

        [string[]]$ArgumentList = @()
    )

    Write-Host "> ssh $HostName bash -s -- $($ArgumentList -join ' ')"

    $sshArgs = @($HostName, 'bash', '-s', '--') + $ArgumentList
    $Script | & ssh @sshArgs

    if ($LASTEXITCODE -ne 0) {
        throw "Remote script failed with exit code $LASTEXITCODE."
    }
}

function Resolve-CommandName {
    param(
        [Parameter(Mandatory = $true)]
        [string]$WindowsName,

        [Parameter(Mandatory = $true)]
        [string]$OtherName
    )

    if ($env:OS -eq 'Windows_NT') {
        return $WindowsName
    }

    return $OtherName
}

$WorkspaceRoot = (Resolve-Path -LiteralPath $WorkspaceRoot).Path
$BackendRoot = Join-Path $WorkspaceRoot 'remnawave-backend'
$FrontendRoot = Join-Path $WorkspaceRoot 'remnawave-frontend'
$RootScripts = Join-Path $WorkspaceRoot 'scripts'
$ArtifactRoot = Join-Path $WorkspaceRoot '.remnawave-ci-artifacts'
$BackendPackagePath = Join-Path $BackendRoot 'package.json'
$FrontendPackagePath = Join-Path $FrontendRoot 'package.json'
$PrepareScript = Join-Path $BackendRoot 'prepare-custom-build.ps1'
$SmokeScript = Join-Path $RootScripts 'smoke-test-remnawave-image.ps1'

foreach ($requiredPath in @($BackendRoot, $FrontendRoot, $BackendPackagePath, $FrontendPackagePath, $PrepareScript)) {
    if (-not (Test-Path -LiteralPath $requiredPath)) {
        throw "Required path not found: $requiredPath"
    }
}

$BackendPackage = Get-Content -LiteralPath $BackendPackagePath -Raw | ConvertFrom-Json
$Version = [string]$BackendPackage.version
$Timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$BuildTime = [DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ')
$BuildNumber = if ($env:GITHUB_RUN_NUMBER) { $env:GITHUB_RUN_NUMBER } else { $Timestamp }
$BackendCommit = Invoke-GitOutput -Repository $BackendRoot -Arguments @('rev-parse', '--short', 'HEAD')
$FrontendCommit = Invoke-GitOutput -Repository $FrontendRoot -Arguments @('rev-parse', '--short', 'HEAD')
$BackendBranch = Invoke-GitOutput -Repository $BackendRoot -Arguments @('rev-parse', '--abbrev-ref', 'HEAD')
$BackendDirty = Invoke-GitOutput -Repository $BackendRoot -Arguments @('status', '--short')
$FrontendDirty = Invoke-GitOutput -Repository $FrontendRoot -Arguments @('status', '--short')

if (-not $BackendCommit) {
    $BackendCommit = 'unknown'
}

if (-not $FrontendCommit) {
    $FrontendCommit = 'unknown'
}

if (-not $BackendBranch) {
    $BackendBranch = 'custom'
}

if (-not $ImageTag) {
    $ImageTag = "$Version-local-ci-$Timestamp-b$BackendCommit-f$FrontendCommit"
}

$ImageTag = $ImageTag -replace '[^A-Za-z0-9_.-]', '-'
$Image = "${ImageRepository}:$ImageTag"
$SafeImageName = $Image -replace '[^A-Za-z0-9_.-]', '-'
$TarPath = Join-Path $ArtifactRoot "$SafeImageName.tar"
$RemoteTarPath = "$RemoteAppDir/$SafeImageName.tar"
$NpmCommand = Resolve-CommandName -WindowsName 'npm.cmd' -OtherName 'npm'
$RunMigrationsText = if ($RunMigrations.IsPresent) { 'true' } else { 'false' }

Write-Step 'Deployment plan'
Write-Host "Workspace:       $WorkspaceRoot"
Write-Host "Backend:         $BackendRoot"
Write-Host "Frontend:        $FrontendRoot"
Write-Host "Image:           $Image"
Write-Host "Prod host:       $ProdHost"
Write-Host "Remote compose:  $RemoteComposeFile"
Write-Host "Service:         $ServiceName"
Write-Host "Panel URL:       $PanelUrl"
Write-Host "Run migrations:  $RunMigrationsText"
Write-Host "Plan only:       $($PlanOnly.IsPresent)"

if ($BackendDirty) {
    Write-Host ''
    Write-Host 'Backend has uncommitted changes. They will be included in the local Docker build.'
}

if ($FrontendDirty) {
    Write-Host 'Frontend has uncommitted changes. They will be included in the local Docker build.'
}

if ($PlanOnly) {
    Write-Host ''
    Write-Host 'PlanOnly enabled. No build, upload, or production change was performed.'
    return
}

$RemoteDeployScript = @'
set -euo pipefail

IMAGE="$1"
TAR_PATH="$2"
APP_DIR="$3"
COMPOSE_FILE="$4"
SERVICE="$5"
NETWORK="$6"
PANEL_URL="$7"
RUN_MIGRATIONS="$8"

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

cleanup() {
    rm -f "$TAR_PATH" || true
}

on_exit() {
    rc="$?"
    trap - EXIT

    if [ "$rc" -ne 0 ]; then
        rollback
    fi

    cleanup
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

if [ ! -f "$TAR_PATH" ]; then
    echo "Uploaded image archive not found: $TAR_PATH" >&2
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

echo "Loading image archive..."
docker load -i "$TAR_PATH"
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
text = Path(source).read_text()
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

Path(target).write_text("\n".join(out) + ("\n" if keep_newline else ""))
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
cleanup

echo "Deployment complete: $IMAGE"
echo "Backup created: $BACKUP_DIR"
echo "Manual rollback command:"
echo "  cp -a '$BACKUP_DIR/docker-compose.before-ci.yml' '$COMPOSE_FILE' && cd '$APP_DIR' && docker compose -f '$COMPOSE_FILE' up -d '$SERVICE'"
'@

New-Item -ItemType Directory -Force -Path $ArtifactRoot | Out-Null

try {
    Write-Step 'Local preflight'
    Invoke-Native -FilePath 'docker' -ArgumentList @('info', '--format', '{{.ServerVersion}}')
    Invoke-Native -FilePath 'ssh' -ArgumentList @($ProdHost, 'docker --version')
    Invoke-Native -FilePath 'ssh' -ArgumentList @($ProdHost, "test -f '$RemoteComposeFile' && test -d '$RemoteAppDir'")

    Write-Step 'Build frontend locally'
    if (-not $SkipFrontendTypecheck) {
        Invoke-Native -FilePath $NpmCommand -ArgumentList @('run', 'typecheck') -WorkingDirectory $FrontendRoot
    }

    Invoke-Native -FilePath $NpmCommand -ArgumentList @('run', 'cb') -WorkingDirectory $FrontendRoot

    Write-Step 'Prepare backend Docker context'
    Invoke-PowerShellFile -Path $PrepareScript -WorkingDirectory $BackendRoot

    Write-Step 'Build backend image locally'
    Invoke-Native -FilePath 'docker' -ArgumentList @(
        'build',
        '-f', 'Dockerfile.custom',
        '-t', $Image,
        '--build-arg', "BRANCH=$BackendBranch",
        '--build-arg', "__RW_METADATA_VERSION=$ImageTag",
        '--build-arg', "__RW_METADATA_GIT_BACKEND_COMMIT=$BackendCommit",
        '--build-arg', "__RW_METADATA_GIT_FRONTEND_COMMIT=$FrontendCommit",
        '--build-arg', "__RW_METADATA_GIT_BRANCH=$BackendBranch",
        '--build-arg', "__RW_METADATA_BUILD_TIME=$BuildTime",
        '--build-arg', "__RW_METADATA_BUILD_NUMBER=$BuildNumber",
        '.'
    ) -WorkingDirectory $BackendRoot

    if (-not $SkipSmokeTest) {
        Write-Step 'Smoke test local image'

        if (Test-Path -LiteralPath $SmokeScript) {
            Invoke-PowerShellFile -Path $SmokeScript -ArgumentList @('-Image', $Image, '-Kind', 'backend') -WorkingDirectory $WorkspaceRoot
        } else {
            Invoke-Native -FilePath 'docker' -ArgumentList @(
                'run',
                '--rm',
                '--entrypoint',
                '/bin/sh',
                $Image,
                '-c',
                'test -f /opt/app/dist/src/main.js && test -f /opt/app/frontend/index.html && grep -q "/assets/index-" /opt/app/frontend/index.html'
            )
        }
    }

    Write-Step 'Save image archive locally'
    if (Test-Path -LiteralPath $TarPath) {
        Remove-Item -LiteralPath $TarPath -Force
    }

    Invoke-Native -FilePath 'docker' -ArgumentList @('save', '-o', $TarPath, $Image)

    Write-Step 'Upload image archive to production'
    Invoke-Native -FilePath 'ssh' -ArgumentList @($ProdHost, "mkdir -p '$RemoteAppDir'")
    Invoke-Native -FilePath 'scp' -ArgumentList @($TarPath, "${ProdHost}:$RemoteTarPath")

    Write-Step 'Load and switch production service'
    Invoke-SshScript -HostName $ProdHost -Script $RemoteDeployScript -ArgumentList @(
        $Image,
        $RemoteTarPath,
        $RemoteAppDir,
        $RemoteComposeFile,
        $ServiceName,
        $NetworkName,
        $PanelUrl,
        $RunMigrationsText
    )

    Write-Step 'Done'
    Write-Host "Image deployed: $Image"
} finally {
    if ((Test-Path -LiteralPath $TarPath) -and -not $KeepTar) {
        Remove-Item -LiteralPath $TarPath -Force
        Write-Host "Removed local archive: $TarPath"
    }
}
