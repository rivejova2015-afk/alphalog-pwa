param(
  [string]$ProjectPath = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path,
  [string]$BaseUrl = "https://www.alphalog.io"
)

$ErrorActionPreference = "Stop"
$runner = Join-Path $PSScriptRoot "run-npm-task.ps1"
$log = Join-Path $ProjectPath "docs\reports\ops-auto-recovery.log"

. $runner `
  -ProjectPath $ProjectPath `
  -Task "ops:bot-auto-recovery" `
  -TaskArgs "-- --baseUrl $BaseUrl --actionOn S1 --cooldownMin 15" `
  -LogFile $log
