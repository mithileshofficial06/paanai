# Paanai build watchdog. Run hourly by the "Paanai Build Watchdog" scheduled task.
# If the build has been idle > 75 min (e.g. stopped by a usage limit), start a headless
# Claude Code run that resumes from PROGRESS.md. Never runs twice at once (lock file).
$ErrorActionPreference = 'Continue'
$proj = 'D:\Projects\2-In-Progress\paanai'
$state = Join-Path $proj '.paanai'
New-Item -ItemType Directory -Force $state | Out-Null
$log = Join-Path $state ('watchdog-' + (Get-Date -Format 'yyyy-MM-dd') + '.log')
function Log([string]$m) { Add-Content -Path $log -Value ('[' + (Get-Date -Format 's') + '] ' + $m) -Encoding utf8 }

$progress = Join-Path $proj 'PROGRESS.md'
if (-not (Test-Path $progress)) { Log 'No PROGRESS.md; exiting'; exit 0 }
if (Select-String -Path $progress -Pattern '^BUILD-COMPLETE-MARKER$' -CaseSensitive -Quiet) { Log 'Build finished; nothing to do'; exit 0 }

$lock = Join-Path $state 'watchdog.lock'
if (Test-Path $lock) {
  $age = (Get-Date) - (Get-Item $lock).LastWriteTime
  if ($age.TotalHours -lt 4) { Log 'A resume run holds the lock; exiting'; exit 0 }
}

# Last activity = newest of PROGRESS.md, heartbeat file, last git commit.
$times = @((Get-Item $progress).LastWriteTime)
$hb = Join-Path $state 'heartbeat'
if (Test-Path $hb) { $times += (Get-Item $hb).LastWriteTime }
Push-Location $proj
$ct = git log -1 --format=%ct 2>$null
Pop-Location
if ($ct) { $times += [DateTimeOffset]::FromUnixTimeSeconds([int64]$ct).LocalDateTime }
$last = ($times | Measure-Object -Maximum).Maximum
$idle = ((Get-Date) - $last).TotalMinutes
if ($idle -lt 75) { Log ("Build active (last activity {0} min ago)" -f [int]$idle); exit 0 }

Set-Content -Path $lock -Value (Get-Date -Format 's') -Encoding utf8
Log ("Idle {0} min; starting headless resume run" -f [int]$idle)
$prompt = @'
You are the Paanai watchdog resume run (headless). Read PROGRESS.md in this folder first and continue the build from its "Next action", following the brief and the USAGE RULES in that file exactly: never push, never run devvit publish or any launch script. Work in this main session at high effort; if you delegate, use at most ONE Agent subagent at a time (model opus, effort high for 3D/visual work, effort medium for simple tasks; never effort max) and keep screenshot review rounds to at most 3 per task. Commit after each step, update PROGRESS.md and touch .paanai/heartbeat after each step. Keep working through the milestones for as long as you can. Do not delete .paanai/watchdog.lock yourself; the watchdog removes it when you exit.
'@
Set-Location $proj
& 'C:\Users\MITHILESH KS\.local\bin\claude.exe' -p $prompt --model opus --effort high --permission-mode auto *>> $log
Remove-Item $lock -ErrorAction SilentlyContinue
Log 'Headless resume run exited'
