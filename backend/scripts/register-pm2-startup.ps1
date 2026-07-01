$log = 'c:\proyectos\Soulmedical\backend\logs\pm2-startup.log'
"=== $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') PM2 Startup Install ===" | Out-File $log -Encoding utf8

try {
    $env:PATH = "C:\Users\biadmin\AppData\Roaming\npm;" + $env:PATH
    "PATH OK" | Out-File $log -Append -Encoding utf8

    $output = & 'C:\Users\biadmin\AppData\Roaming\npm\pm2-startup.cmd' install 2>&1
    $output | Out-File $log -Append -Encoding utf8
    Write-Host "pm2-startup install output:"
    $output | ForEach-Object { Write-Host $_ }

    Write-Host ""
    Write-Host "=== Verificando tarea programada PM2 ==="
    $t = Get-ScheduledTask -TaskName 'PM2' -ErrorAction SilentlyContinue
    if ($t) {
        "Tarea PM2 registrada. RunAs: $($t.Principal.UserId), Trigger: $($t.Triggers[0].CimClass.CimClassName)" | Out-File $log -Append -Encoding utf8
        Write-Host "Tarea PM2 OK | RunAs: $($t.Principal.UserId) | Trigger: $($t.Triggers[0].CimClass.CimClassName)" -ForegroundColor Green
    } else {
        "Tarea PM2 NO encontrada" | Out-File $log -Append -Encoding utf8
        Write-Host "Tarea PM2 NO encontrada" -ForegroundColor Red
    }
} catch {
    "ERROR: $($_.Exception.Message)" | Out-File $log -Append -Encoding utf8
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "Pulsa una tecla para cerrar..."
[void][System.Console]::ReadKey($true)
