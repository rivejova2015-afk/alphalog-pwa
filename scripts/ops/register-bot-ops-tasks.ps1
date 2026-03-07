param(
  [string]$ProjectPath = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path,
  [string]$TaskPrefix = "AlphaLog-BotOps",
  [string]$BaseUrl = "https://www.alphalog.io",
  [switch]$RunNow
)

$ErrorActionPreference = "Stop"

function Invoke-ScheduledTaskCreate {
  param(
    [string]$TaskName,
    [string[]]$ScheduleArgs,
    [string]$Command
  )

  $arguments = @(
    "/Create",
    "/F",
    "/TN", $TaskName,
    "/TR", $Command
  ) + $ScheduleArgs + @("/RL", "LIMITED")

  $process = Start-Process -FilePath "schtasks.exe" -ArgumentList $arguments -NoNewWindow -Wait -PassThru
  if ($process.ExitCode -ne 0) {
    throw "Failed creating task '$TaskName' (ExitCode=$($process.ExitCode))."
  }
}

function Invoke-ScheduledTaskRun {
  param([string]$TaskName)
  $process = Start-Process -FilePath "schtasks.exe" -ArgumentList @("/Run", "/TN", $TaskName) -NoNewWindow -Wait -PassThru
  if ($process.ExitCode -ne 0) {
    Write-Warning "Task '$TaskName' created but failed to run immediately (ExitCode=$($process.ExitCode))."
  }
}

$escapedProjectPath = $ProjectPath.Replace('"', '\"')
$monitorLog = Join-Path $ProjectPath "docs\reports\ops-slo-monitor.log"
$recoveryLog = Join-Path $ProjectPath "docs\reports\ops-auto-recovery.log"
$summaryLog = Join-Path $ProjectPath "docs\reports\ops-daily-summary.log"

$monitorCommand = "cmd /c cd /d `"$escapedProjectPath`" && npm run ops:bot-slo-monitor -- --baseUrl $BaseUrl --window-min 15 --market-policy auto >> `"$monitorLog`" 2>>&1"
$recoveryCommand = "cmd /c cd /d `"$escapedProjectPath`" && npm run ops:bot-auto-recovery -- --baseUrl $BaseUrl --actionOn S1 --cooldownMin 15 >> `"$recoveryLog`" 2>>&1"
$summaryCommand = "cmd /c cd /d `"$escapedProjectPath`" && npm run ops:bot-daily-summary -- --timezone America/Puerto_Rico --keepDays 14 >> `"$summaryLog`" 2>>&1"

$tasks = @(
  @{
    Name = "$TaskPrefix-SLO-Monitor"
    Schedule = @("/SC", "MINUTE", "/MO", "15", "/ST", "00:00")
    Command = $monitorCommand
  },
  @{
    Name = "$TaskPrefix-Auto-Recovery"
    Schedule = @("/SC", "MINUTE", "/MO", "15", "/ST", "00:03")
    Command = $recoveryCommand
  },
  @{
    Name = "$TaskPrefix-Daily-Summary"
    Schedule = @("/SC", "DAILY", "/ST", "23:55")
    Command = $summaryCommand
  }
)

Write-Host "[ops] Registering bot ops tasks with prefix '$TaskPrefix'..."
foreach ($task in $tasks) {
  Invoke-ScheduledTaskCreate -TaskName $task.Name -ScheduleArgs $task.Schedule -Command $task.Command
  Write-Host "[ops] OK -> $($task.Name)"
  if ($RunNow) {
    Invoke-ScheduledTaskRun -TaskName $task.Name
  }
}

Write-Host "[ops] Done. Use 'npm run ops:tasks:unregister' to remove tasks."
