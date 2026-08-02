# AlphaLog PWA — Lattice self-deploy script (no GitHub Actions involved).
#
# Same idea as coinarb's cron-coinarb-deploy.sh, ported to Windows: this
# machine pulls from GitHub on its own schedule and redeploys itself.
# GitHub only ever sees a plain `git fetch` — no runner registration, no
# repo secrets, nothing configured on github.com for this to work.
#
# Setup (once):
#   1. Clone this repo somewhere on the Lattice server, e.g.:
#        git clone https://github.com/rivejova2015-afk/alphalog-pwa.git C:\alphalog-pwa
#   2. Create C:\alphalog-pwa\deploy\lattice\.env with the same values as
#      .fly-secrets.example.sh (copy the ones you already use on Fly —
#      same secrets, just pasted into a local file instead of `fly secrets
#      set`). Never commit this file (deploy/lattice/.env is gitignored
#      via the repo's `.env*` rule).
#   3. Windows Task Scheduler → Create Task → Trigger: "On a schedule,
#      repeat every 5 minutes" → Action: "Start a program":
#        Program:  powershell.exe
#        Arguments: -NoProfile -ExecutionPolicy Bypass -File "C:\alphalog-pwa\deploy\lattice\deploy.ps1"
#      Run whether user is logged on or not, so it survives reboots/logout.
#
# Requires on PATH: git, node 24 + npm, docker (Desktop, Linux containers
# mode). This script does `git reset --hard` on the clone — treat that
# checkout as deploy-only, not a working copy you edit by hand.

$ErrorActionPreference = "Stop"

$RepoRoot   = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$LatticeDir = Join-Path $RepoRoot "deploy\lattice"
$EnvFile    = Join-Path $LatticeDir ".env"
$ShaFile    = Join-Path $LatticeDir ".last-deployed-sha"

# Paths that don't need a web/cron redeploy — mirrors fly-deploy.yml's
# paths-ignore (coinarb/polyarb have their own deploy path; docs/bots don't
# affect the running app).
$IgnorePattern = '^(coinarb/|polyarb/|lattice-desktop/|bots/|docs/|.*\.md$)'

function Write-Log($msg) {
    Write-Output "[$(Get-Date -Format o)] $msg"
}

Set-Location $RepoRoot

Write-Log "Fetching origin/main..."
git fetch origin main
$newSha = (git rev-parse origin/main).Trim()
$lastSha = if (Test-Path $ShaFile) { (Get-Content $ShaFile -Raw).Trim() } else { "" }

if ($newSha -eq $lastSha) {
    Write-Log "No new commits ($newSha) — nothing to do."
    exit 0
}

if ($lastSha -ne "") {
    $changed = git diff --name-only $lastSha $newSha
    $relevant = $changed | Where-Object { $_ -notmatch $IgnorePattern }
    if (-not $relevant -or $relevant.Count -eq 0) {
        Write-Log "New commits ($lastSha -> $newSha) but nothing web-relevant changed — skipping deploy."
        Set-Content -Path $ShaFile -Value $newSha -NoNewline
        exit 0
    }
}

Write-Log "Deploying $lastSha -> $newSha ..."
git reset --hard origin/main

if (-not (Test-Path $EnvFile)) {
    Write-Error "Missing $EnvFile — create it first (see header of this script)."
    exit 1
}

Write-Log "Loading env from $EnvFile ..."
Get-Content $EnvFile | ForEach-Object {
    $line = $_.Trim()
    if ($line -eq "" -or $line.StartsWith("#")) { return }
    $idx = $line.IndexOf("=")
    if ($idx -lt 1) { return }
    $key = $line.Substring(0, $idx).Trim()
    $val = $line.Substring($idx + 1).Trim()
    [System.Environment]::SetEnvironmentVariable($key, $val, "Process")
}
$env:NEXT_PUBLIC_BUILD_VERSION = $newSha

Write-Log "npm ci ..."
npm ci
if ($LASTEXITCODE -ne 0) { Write-Error "npm ci failed"; exit 1 }

Write-Log "npm run build ..."
npm run build
if ($LASTEXITCODE -ne 0) { Write-Error "npm run build failed"; exit 1 }

Write-Log "docker compose build + up (web, cloudflared) ..."
Set-Location $LatticeDir
docker compose build web cloudflared
if ($LASTEXITCODE -ne 0) { Write-Error "docker compose build failed"; exit 1 }
docker compose up -d --remove-orphans web cloudflared
if ($LASTEXITCODE -ne 0) { Write-Error "docker compose up failed"; exit 1 }

Write-Log "Health check ..."
$ok = $false
for ($i = 0; $i -lt 20; $i++) {
    try {
        $resp = Invoke-WebRequest -Uri "http://localhost:3000/api/health" -UseBasicParsing -TimeoutSec 5
        if ($resp.StatusCode -lt 500) { $ok = $true; break }
    } catch {}
    Start-Sleep -Seconds 3
}
if (-not $ok) {
    Write-Error "Health check failed after deploy — check 'docker compose logs web' in $LatticeDir."
    exit 1
}

Set-Content -Path $ShaFile -Value $newSha -NoNewline
Write-Log "Deployed $newSha successfully."
