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

  $scheduleInline = ($ScheduleArgs -join " ")
  $escapedCommand = $Command.Replace('"', '\"')
  $createCommand = "schtasks.exe /Create /F /TN `"$TaskName`" /TR `"$escapedCommand`" $scheduleInline /RL LIMITED"
  $process = Start-Process -FilePath "cmd.exe" -ArgumentList @("/d", "/c", $createCommand) -NoNewWindow -Wait -PassThru
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
$monitorTaskScript = (Join-Path $ProjectPath "scripts\ops\task-slo-monitor.ps1").Replace('"', '\"')
$recoveryTaskScript = (Join-Path $ProjectPath "scripts\ops\task-auto-recovery.ps1").Replace('"', '\"')
$summaryTaskScript = (Join-Path $ProjectPath "scripts\ops\task-daily-verify.ps1").Replace('"', '\"')

$monitorCommand = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$monitorTaskScript`" -ProjectPath `"$escapedProjectPath`" -BaseUrl `"$BaseUrl`""
$recoveryCommand = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$recoveryTaskScript`" -ProjectPath `"$escapedProjectPath`" -BaseUrl `"$BaseUrl`""
$summaryCommand = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$summaryTaskScript`" -ProjectPath `"$escapedProjectPath`" -BaseUrl `"$BaseUrl`""

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
