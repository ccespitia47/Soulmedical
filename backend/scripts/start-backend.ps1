param(
    [switch]$NonInteractive
)

$ErrorActionPreference = 'Stop'

function Wait-AnyKey {
    if ($NonInteractive) { return }
    Write-Host ""
    Write-Host "Pulsa una tecla para cerrar..."
    try { [void][System.Console]::ReadKey($true) } catch {}
}

$backendDir = 'c:\proyectos\Soulmedical\backend'
$nodeExe    = 'C:\Program Files\nodejs\node.exe'
$entry      = Join-Path $backendDir 'dist\main.js'
$logDir     = Join-Path $backendDir 'logs'
$port       = 3001
$logRetentionDays = 7

if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }

if (-not (Test-Path $entry)) {
    Write-Host "No existe $entry. Ejecuta 'npm run build' primero." -ForegroundColor Red
    Wait-AnyKey; exit 1
}

$listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
if ($listener) {
    Write-Host "Puerto $port ya esta ocupado por PID $($listener.OwningProcess). Ejecuta kill-zombies.ps1 primero." -ForegroundColor Red
    Wait-AnyKey; exit 1
}

Get-ChildItem $logDir -Filter 'backend-*.log' -ErrorAction SilentlyContinue |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$logRetentionDays) } |
    ForEach-Object {
        Remove-Item $_.FullName -Force -ErrorAction SilentlyContinue
        Write-Host "Log antiguo eliminado: $($_.Name)" -ForegroundColor DarkGray
    }

$ts      = Get-Date -Format 'yyyyMMdd-HHmmss'
$logFile = Join-Path $logDir "backend-$ts.log"
$errFile = Join-Path $logDir "backend-$ts.err.log"

$env:NODE_ENV = 'production'

$proc = Start-Process -FilePath $nodeExe `
    -ArgumentList $entry `
    -WorkingDirectory $backendDir `
    -RedirectStandardOutput $logFile `
    -RedirectStandardError  $errFile `
    -WindowStyle Hidden `
    -PassThru

Start-Sleep -Seconds 2

$still = Get-Process -Id $proc.Id -ErrorAction SilentlyContinue
if (-not $still) {
    Write-Host "El proceso murio al arrancar. Revisa el log:" -ForegroundColor Red
    Write-Host "  $errFile"
    Wait-AnyKey; exit 1
}

Write-Host ""
Write-Host "Backend SoulForms arrancado en segundo plano." -ForegroundColor Green
Write-Host "  PID:   $($proc.Id)"
Write-Host "  Port:  $port"
Write-Host "  Log:   $logFile"
Write-Host "  Errs:  $errFile"
Write-Host ""
Write-Host "Para detenerlo:   Stop-Process -Id $($proc.Id) -Force"
Write-Host "O ejecuta:        .\kill-zombies.ps1"
if ($NonInteractive) {
    Wait-Process -Id $proc.Id
    "=== $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') Proceso $($proc.Id) termino ===" |
        Out-File (Join-Path $logDir 'task-supervisor.log') -Append -Encoding utf8
} else {
    Write-Host ""
    Write-Host "Pulsa una tecla para cerrar esta ventana (el backend sigue corriendo)..."
    try { [void][System.Console]::ReadKey($true) } catch {}
}
