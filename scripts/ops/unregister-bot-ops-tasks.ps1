param(
  [string]$TaskPrefix = "AlphaLog-BotOps"
)

$ErrorActionPreference = "Stop"

function Remove-ScheduledTaskSafe {
  param([string]$TaskName)

  $process = Start-Process -FilePath "schtasks.exe" -ArgumentList @("/Delete", "/TN", $TaskName, "/F") -NoNewWindow -Wait -PassThru
  if ($process.ExitCode -eq 0) {
    Write-Host "[ops] Removed -> $TaskName"
    return
  }

  Write-Warning "Task '$TaskName' not removed (ExitCode=$($process.ExitCode)). It may not exist."
}

$taskNames = @(
  "$TaskPrefix-SLO-Monitor",
  "$TaskPrefix-Auto-Recovery",
  "$TaskPrefix-Daily-Summary"
)

foreach ($taskName in $taskNames) {
  Remove-ScheduledTaskSafe -TaskName $taskName
}
