# Removes the BJJ Flow Bridge task and firewall rule. Run as Administrator.
# Notifications still waiting in data\queue are kept on disk.

$ErrorActionPreference = 'Stop'
$TaskName = 'BJJ Flow Bridge'
if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}
Get-NetFirewallRule -DisplayName 'BJJ Flow Bridge (*' -ErrorAction SilentlyContinue | Remove-NetFirewallRule
Write-Host 'BJJ Flow Bridge removed.'
