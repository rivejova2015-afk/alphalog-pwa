param(
  [string]$ProjectPath = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path,
  [string]$BaseUrl = "https://www.alphalog.io"
)

$ErrorActionPreference = "Stop"
$runner = Join-Path $PSScriptRoot "run-npm-task.ps1"
$log = Join-Path $ProjectPath "docs\reports\ops-daily-summary.log"

. $runner `
  -ProjectPath $ProjectPath `
  -Task "ops:bot-daily-verify" `
  -TaskArgs "-- --baseUrl $BaseUrl --timezone America/Puerto_Rico --marketPolicy auto" `
  -LogFile $log
