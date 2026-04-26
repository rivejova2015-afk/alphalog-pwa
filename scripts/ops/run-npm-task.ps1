param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectPath,
  [Parameter(Mandatory = $true)]
  [string]$Task,
  [string]$TaskArgs = "",
  [Parameter(Mandatory = $true)]
  [string]$LogFile
)

$ErrorActionPreference = "Stop"

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
  "npm run $Task"
} else {
  "npm run $Task $TaskArgs"
}

$exitCode = 0
try {
  $proc = Start-Process -FilePath "cmd.exe" `
    -ArgumentList @("/d", "/c", "cd /d `"$ProjectPath`" && $command") `
    -WindowStyle Hidden `
    -RedirectStandardOutput "$LogFile.stdout.tmp" `
    -RedirectStandardError  "$LogFile.stderr.tmp" `
    -Wait -PassThru

  $exitCode = $proc.ExitCode

  if (Test-Path "$LogFile.stdout.tmp") {
    Get-Content "$LogFile.stdout.tmp" | Out-File -FilePath $LogFile -Append -Encoding utf8
    Remove-Item "$LogFile.stdout.tmp" -Force
  }
  if (Test-Path "$LogFile.stderr.tmp") {
    Get-Content "$LogFile.stderr.tmp" | Out-File -FilePath $LogFile -Append -Encoding utf8
    Remove-Item "$LogFile.stderr.tmp" -Force
  }
} catch {
  "ERROR: $_" | Out-File -FilePath $LogFile -Append -Encoding utf8
  $exitCode = 1
}

$end = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
"[$end] END task=$Task exit=$exitCode" | Out-File -FilePath $LogFile -Append -Encoding utf8

if ($exitCode -ne 0) {
  exit $exitCode
}
