# Keeps Holovant running. Started at logon by the scheduled task "Holovant".
#
# The server died after every reboot and nobody noticed until the page stopped
# opening: three times in two weeks. This starts it, and starts it again if it
# ever exits, with a pause so a build that is broken does not spin the CPU.
#
# Written as PowerShell and not as a .bat: cmd cannot read Cyrillic from a
# UTF-8 file, and this machine's home folder is Cyrillic.

$ErrorActionPreference = "Continue"
$root = Split-Path -Parent $PSScriptRoot
$app = Join-Path $root "apps\web"
$next = Join-Path $app "node_modules\next\dist\bin\next"
$log = Join-Path $root "serve.log"

Set-Location $app

while ($true) {
    # Port 3000 already answering means another copy is up; leave it alone.
    $busy = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
    if (-not $busy) {
        "$(Get-Date -Format s)  starting" | Out-File -Append -Encoding utf8 $log
        & node $next start -H 127.0.0.1 *>> $log
        "$(Get-Date -Format s)  exited with $LASTEXITCODE" | Out-File -Append -Encoding utf8 $log
    }
    Start-Sleep -Seconds 10
}
