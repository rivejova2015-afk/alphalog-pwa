param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectPath,
  [Parameter(Mandatory = $true)]
  [string]$Task,
  [string]$TaskArgs = "",
  [Parameter(Mandatory = $true)]
  [string]$LogFile
)

$ErrorActionPreference = "SilentlyContinue"

if (-not (Test-Path $ProjectPath)) {
  throw "ProjectPath not found: $ProjectPath"
}

$logDir = Split-Path -Parent $LogFile
if ($logDir -and -not (Test-Path $logDir)) {
  New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}

$timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
"[$timestamp] START task=$Task args=$TaskArgs" | Out-File -FilePath $LogFile -Append -Encoding utf8

$command = if ([string]::IsNullOrWhiteSpace($TaskArgs)) {
  "cd /d `"$ProjectPath`" && npm run $Task"
} else {
  "cd /d `"$ProjectPath`" && npm run $Task $TaskArgs"
}

# Run cmd.exe directly inside this already-hidden PS process — no new window created
$output = & cmd.exe /d /c $command 2>&1
$exitCode = $LASTEXITCODE

$output | Out-File -FilePath $LogFile -Append -Encoding utf8

$end = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
"[$end] END task=$Task exit=$exitCode" | Out-File -FilePath $LogFile -Append -Encoding utf8

if ($exitCode -ne 0) { exit $exitCode }
