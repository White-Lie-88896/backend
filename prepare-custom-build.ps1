$ErrorActionPreference = 'Stop'

$BackendRoot = $PSScriptRoot
$FrontendDist = Join-Path $BackendRoot '..\remnawave-frontend\dist'
$Target = Join-Path $BackendRoot 'custom-frontend-dist'

if (-not (Test-Path (Join-Path $FrontendDist 'index.html'))) {
    throw "Frontend dist not found. Run 'npx vite build' in remnawave-frontend first."
}

if (Test-Path $Target) {
    Remove-Item -LiteralPath $Target -Recurse -Force
}

Copy-Item -LiteralPath $FrontendDist -Destination $Target -Recurse

Write-Host "Custom frontend copied to $Target"
Write-Host "Build with: docker build -f Dockerfile.custom -t remnawave/backend:2.7.4-custom ."
