param(
  [string]$ProjectPath = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path,
  [string]$BaseUrl = "https://www.alphalog.io"
)

$ErrorActionPreference = "Stop"
$runner = Join-Path $PSScriptRoot "run-npm-task.ps1"
$log = Join-Path $ProjectPath "docs\reports\ops-slo-monitor.log"

powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File $runner `
  -ProjectPath $ProjectPath `
  -Task "ops:bot-slo-monitor" `
  -TaskArgs "-- --baseUrl $BaseUrl --window-min 15 --market-policy auto" `
  -LogFile $log
