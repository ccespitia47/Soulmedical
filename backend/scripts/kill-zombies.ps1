$log = 'c:\proyectos\Soulmedical\backend\logs\kill-zombies.log'
$logDir = Split-Path $log -Parent
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }
"=== $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') Cleanup ===" | Out-File $log -Encoding utf8

$port = 3001

$listeners = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
if (-not $listeners) {
    "Puerto $port ya estaba libre. Nada que matar." | Out-File $log -Append -Encoding utf8
    Write-Host "Puerto $port ya estaba libre." -ForegroundColor Green
} else {
    $pids = $listeners | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($id in $pids) {
        try {
            $p = Get-Process -Id $id -ErrorAction Stop
            Stop-Process -Id $id -Force -ErrorAction Stop
            "OK PID $id ($($p.ProcessName))" | Out-File $log -Append -Encoding utf8
            Write-Host "OK PID $id ($($p.ProcessName))"
        } catch {
            "skip PID $id : $($_.Exception.Message)" | Out-File $log -Append -Encoding utf8
            Write-Host "skip PID $id : $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }
}

Start-Sleep -Seconds 1
$still = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
if ($still) {
    "Puerto $port SIGUE ocupado por PID $($still.OwningProcess)" | Out-File $log -Append -Encoding utf8
    Write-Host "Puerto $port SIGUE ocupado por PID $($still.OwningProcess)" -ForegroundColor Red
} else {
    "Puerto $port LIBRE." | Out-File $log -Append -Encoding utf8
    Write-Host "Puerto $port LIBRE." -ForegroundColor Green
}

Write-Host ""
Write-Host "Pulsa una tecla para cerrar..."
[void][System.Console]::ReadKey($true)
