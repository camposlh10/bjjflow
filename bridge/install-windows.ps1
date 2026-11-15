# Installs the BJJ Flow Bridge to start with Windows and restart if it stops.
# Run in an Administrator PowerShell, from this folder:
#
#   powershell -ExecutionPolicy Bypass -File .\install-windows.ps1
#
# Needs Node.js 20+ (https://nodejs.org) and a config.json next to bridge.mjs
# (copy config.example.json and paste the bridge key from the CRM).

$ErrorActionPreference = 'Stop'
$TaskName = 'BJJ Flow Bridge'
$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$Config = Join-Path $Here 'config.json'

$principal = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Run this in PowerShell as Administrator.'
}

$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { throw 'Node.js not found. Install Node.js 20 or newer from https://nodejs.org first.' }
$major = [int]((& $node -v).TrimStart('v').Split('.')[0])
if ($major -lt 20) { throw "Node.js $major found; version 20 or newer is needed." }

if (-not (Test-Path $Config)) {
    throw "config.json not found. Copy config.example.json to config.json and paste the bridge key from the CRM."
}
$port = (Get-Content $Config -Raw | ConvertFrom-Json).listenPort
if (-not $port) { $port = 8085 }

# Start at boot as SYSTEM (no one needs to log in), restart every minute if it stops.
$action = New-ScheduledTaskAction -Execute $node -Argument "`"$(Join-Path $Here 'bridge.mjs')`" `"$Config`"" -WorkingDirectory $Here
$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit ([TimeSpan]::Zero) -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$runAs = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $runAs -Force | Out-Null

# Let devices on the gym's network reach the bridge (private networks only).
$rule = "BJJ Flow Bridge ($port)"
if (-not (Get-NetFirewallRule -DisplayName $rule -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -DisplayName $rule -Direction Inbound -Protocol TCP -LocalPort $port -Action Allow -Profile Private | Out-Null
}

Start-ScheduledTask -TaskName $TaskName
Start-Sleep -Seconds 3
try {
    $health = Invoke-RestMethod "http://127.0.0.1:$port/health"
    Write-Host "BJJ Flow Bridge $($health.version) is running on port $port ($($health.queueDepth) waiting)."
} catch {
    Write-Warning "Installed, but the bridge didn't answer yet. See data\bridge.log next to bridge.mjs."
}
$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.PrefixOrigin -in 'Dhcp', 'Manual' -and $_.IPAddress -notlike '169.*' } | Select-Object -First 1).IPAddress
if ($ip) { Write-Host "Point devices to http://$($ip):$port (give this PC a fixed IP in the router)." }
