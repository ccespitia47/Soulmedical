$log = 'c:\proyectos\Soulmedical\backend\logs\register-task.log'
$logDir = Split-Path $log -Parent
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }
"=== $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') Inicio registro ===" | Out-File $log -Encoding utf8

try {
    $taskName = 'SoulForms-Backend'

    try {
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction Stop
        "Tarea previa eliminada." | Out-File $log -Append -Encoding utf8
    } catch {
        "No habia tarea previa: $($_.Exception.Message)" | Out-File $log -Append -Encoding utf8
    }

    $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument '-NoProfile -ExecutionPolicy Bypass -File "c:\proyectos\Soulmedical\backend\scripts\start-backend.ps1" -NonInteractive' -WorkingDirectory 'c:\proyectos\Soulmedical\backend'
    $trigger = New-ScheduledTaskTrigger -AtStartup
    $principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit ([TimeSpan]::Zero)

    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description 'Inicia el backend NestJS de SoulForms al arrancar el equipo (corre como SYSTEM)' -Force | Out-Null

    $t = Get-ScheduledTask -TaskName $taskName
    "Tarea registrada OK: $($t.TaskName) | RunAs: $($t.Principal.UserId) | Trigger: AtStartup" | Out-File $log -Append -Encoding utf8
    Write-Host "Tarea registrada correctamente como SYSTEM."
} catch {
    "ERROR: $($_.Exception.Message)" | Out-File $log -Append -Encoding utf8
    "Stack: $($_.ScriptStackTrace)" | Out-File $log -Append -Encoding utf8
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "Pulsa una tecla para cerrar..."
[void][System.Console]::ReadKey($true)
