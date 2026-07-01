$log = 'c:\proyectos\Soulmedical\backend\logs\run-task.log'
"=== $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') Trigger ===" | Out-File $log -Encoding utf8

try {
    Start-ScheduledTask -TaskName 'SoulForms-Backend'
    "Tarea disparada OK." | Out-File $log -Append -Encoding utf8
    Write-Host "Tarea disparada. Esperando 8s para verificar..." -ForegroundColor Green
    Start-Sleep -Seconds 8
    $info = Get-ScheduledTaskInfo -TaskName 'SoulForms-Backend'
    "LastRunTime: $($info.LastRunTime) | LastTaskResult: $($info.LastTaskResult)" | Out-File $log -Append -Encoding utf8
    Write-Host "LastRunTime: $($info.LastRunTime)"
    Write-Host "LastTaskResult: $($info.LastTaskResult) (0 = OK, otros valores = revisar)"
} catch {
    "ERROR: $($_.Exception.Message)" | Out-File $log -Append -Encoding utf8
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "Pulsa una tecla para cerrar..."
[void][System.Console]::ReadKey($true)
