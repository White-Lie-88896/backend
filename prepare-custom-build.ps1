$ErrorActionPreference = 'Stop'

$BackendRoot = $PSScriptRoot
$WorkspaceRoot = Split-Path -Parent $BackendRoot
$FrontendDist = Join-Path (Join-Path $WorkspaceRoot 'remnawave-frontend') 'dist'
$Target = Join-Path $BackendRoot 'custom-frontend-dist'

if (-not (Test-Path (Join-Path $FrontendDist 'index.html'))) {
    throw "Frontend dist not found. Run 'npx vite build' in remnawave-frontend first."
}

function Remove-DirectoryWithRetry {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,

        [int]$Attempts = 5,

        [int]$DelayMilliseconds = 500
    )

    for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
        try {
            Remove-Item -LiteralPath $Path -Recurse -Force -ErrorAction Stop
            return
        } catch {
            if ($attempt -eq $Attempts) {
                throw
            }

            Start-Sleep -Milliseconds $DelayMilliseconds
        }
    }
}

if (Test-Path $Target) {
    Remove-DirectoryWithRetry -Path $Target
}

Copy-Item -LiteralPath $FrontendDist -Destination $Target -Recurse

Write-Host "Custom frontend copied to $Target"
Write-Host "Build with: docker build -f Dockerfile.custom -t remnawave/backend:2.7.4-custom ."
