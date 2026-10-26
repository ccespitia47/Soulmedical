# ─────────────────────────────────────────────────────────────────────────────
# Crea la Scheduled Task "SoulForms" que arranca el backend NestJS al inicio
# del sistema, corriendo como SYSTEM. Reemplaza la tarea si ya existe.
#
# EJECUTAR UNA VEZ, EN POWERSHELL COMO ADMINISTRADOR:
#   cd C:\proyectos\Soulmedical\scripts
#   .\register-soulforms-task.ps1
#
# Comportamiento:
# - Arranca al boot del sistema (sin esperar login).
# - Si el proceso se cae, Windows lo reinicia hasta 10 veces (1 min entre
#   intentos) — misma política del SO que teníamos antes.
# - Sin límite de duración (ExecutionTimeLimit = 0) — es un servicio.
# - Logs del backend en C:\proyectos\Soulmedical\backend\logs\backend.log y
#   stderr en backend.err.log (requeridos por el redirect del script wrapper).
# ─────────────────────────────────────────────────────────────────────────────

$ErrorActionPreference = 'Stop'

# Admin check — Register-ScheduledTask para SYSTEM lo requiere.
$isAdmin = ([Security.Principal.WindowsPrincipal] `
  [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
  Write-Error "Este script requiere PowerShell COMO ADMINISTRADOR."
  exit 1
}

$taskName   = 'SoulForms'
$nodeExe    = 'C:\Program Files\nodejs\node.exe'
$backendDir = 'C:\proyectos\Soulmedical\backend'
$entryJs    = Join-Path $backendDir 'dist\main.js'
$logsDir    = Join-Path $backendDir 'logs'
$logFile    = Join-Path $logsDir   'backend.log'
$errFile    = Join-Path $logsDir   'backend.err.log'

# Sanity checks previos para no crear la tarea apuntando a algo que no existe.
if (-not (Test-Path $nodeExe))    { Write-Error "No existe $nodeExe"; exit 1 }
if (-not (Test-Path $entryJs))    { Write-Error "No existe $entryJs. Corré: cd $backendDir; npm run build"; exit 1 }
if (-not (Test-Path $backendDir)) { Write-Error "No existe $backendDir"; exit 1 }
if (-not (Test-Path $logsDir))    { New-Item -ItemType Directory -Path $logsDir -Force | Out-Null }

# Wrapper que redirige stdout/stderr a archivos (sin esto perdemos los logs
# del backend porque SYSTEM no tiene consola).
$wrapperPath = Join-Path $backendDir 'start-backend.cmd'
$wrapperBody = @"
@echo off
cd /d "$backendDir"
"$nodeExe" "$entryJs" 1>>"$logFile" 2>>"$errFile"
"@
Set-Content -Path $wrapperPath -Value $wrapperBody -Encoding ASCII -Force

# Si ya existe la tarea, la removemos y la recreamos limpia.
if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
  Write-Host "Removiendo tarea existente '$taskName'..."
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

$action = New-ScheduledTaskAction `
  -Execute 'cmd.exe' `
  -Argument "/c `"$wrapperPath`"" `
  -WorkingDirectory $backendDir

$trigger = New-ScheduledTaskTrigger -AtStartup

$principal = New-ScheduledTaskPrincipal `
  -UserId 'SYSTEM' `
  -LogonType ServiceAccount `
  -RunLevel Highest

$settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -RestartCount 10 `
  -RestartInterval (New-TimeSpan -Minutes 1) `
  -ExecutionTimeLimit (New-TimeSpan -Seconds 0) `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -MultipleInstances IgnoreNew

Register-ScheduledTask `
  -TaskName $taskName `
  -Action $action `
  -Trigger $trigger `
  -Principal $principal `
  -Settings $settings `
  -Description 'Backend NestJS de SoulForms. Arranca al inicio del sistema. Logs en backend\logs\.' | Out-Null

Write-Host ""
Write-Host "Tarea '$taskName' creada correctamente." -ForegroundColor Green
Write-Host ""
Write-Host "Comandos útiles:" -ForegroundColor Cyan
Write-Host "  Arrancar ahora : Start-ScheduledTask -TaskName '$taskName'"
Write-Host "  Reiniciar      : Stop-ScheduledTask -TaskName '$taskName'; Start-Sleep 2; Start-ScheduledTask -TaskName '$taskName'"
Write-Host "  Estado         : Get-ScheduledTask -TaskName '$taskName'"
Write-Host "  Logs           : Get-Content '$logFile' -Tail 30 -Wait"
Write-Host "  Logs de error  : Get-Content '$errFile' -Tail 30 -Wait"
Write-Host "  Borrar tarea   : Unregister-ScheduledTask -TaskName '$taskName' -Confirm:`$false"
