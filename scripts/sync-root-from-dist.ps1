$ErrorActionPreference = "Stop"

if (-not (Test-Path "dist/index.html")) {
  throw "dist/index.html not found. Run 'npm run build' first."
}

if (-not (Test-Path "dist/assets")) {
  throw "dist/assets not found. Run 'npm run build' first."
}

Copy-Item -Path "dist/index.html" -Destination "index.html" -Force

if (-not (Test-Path "assets")) {
  New-Item -ItemType Directory -Path "assets" | Out-Null
}

Copy-Item -Path "dist/assets/*" -Destination "assets" -Recurse -Force

Write-Host "Synced dist => root index.html + assets/"
