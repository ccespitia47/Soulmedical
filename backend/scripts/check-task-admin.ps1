$log = 'c:\proyectos\Soulmedical\backend\logs\check-task.log'
"=== $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') Check ===" | Out-File $log -Encoding utf8

try {
    $t = Get-ScheduledTask -TaskName 'SoulForms-Backend' -ErrorAction Stop
    "EXISTE: $($t.TaskName) | Path: $($t.TaskPath) | State: $($t.State) | RunAs: $($t.Principal.UserId) | RunLevel: $($t.Principal.RunLevel)" | Out-File $log -Append -Encoding utf8
    "TriggerType: $($t.Triggers[0].CimClass.CimClassName)" | Out-File $log -Append -Encoding utf8
    "Action: $($t.Actions[0].Execute) $($t.Actions[0].Arguments)" | Out-File $log -Append -Encoding utf8
    $info = Get-ScheduledTaskInfo -TaskName 'SoulForms-Backend'
    "LastRunTime: $($info.LastRunTime) | LastTaskResult: $($info.LastTaskResult) | NextRunTime: $($info.NextRunTime)" | Out-File $log -Append -Encoding utf8
    Write-Host "TAREA EXISTE. Detalles en el log." -ForegroundColor Green
} catch {
    "NO EXISTE o ERROR: $($_.Exception.Message)" | Out-File $log -Append -Encoding utf8
    Write-Host "NO EXISTE o ERROR: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "Pulsa una tecla para cerrar..."
[void][System.Console]::ReadKey($true)
