# Arranca el backend NestJS en segundo plano, redirigiendo logs a archivos.
# Al cerrar esta ventana PowerShell, el backend sigue vivo.
#
# USO:
#   .\start-background.ps1         # arranca
#   Get-Content backend.log -Wait  # ver logs en vivo
#   Stop-Process -Id <PID>         # para apagarlo (ver backend.pid)

$ErrorActionPreference = 'Stop'

$backendDir = 'C:\proyectos\Soulmedical\backend'
$logDir     = Join-Path $backendDir 'logs'
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Force -Path $logDir | Out-Null }

$stdout = Join-Path $logDir 'backend.log'
$stderr = Join-Path $logDir 'backend.err.log'
$pidFile = Join-Path $backendDir 'backend.pid'

# Mata instancia previa si quedó alguna escuchando en 3001
$conn = Get-NetTCPConnection -State Listen -LocalPort 3001 -ErrorAction SilentlyContinue
if ($conn) {
  Write-Host "Puerto 3001 ocupado por PID $($conn.OwningProcess), terminando..."
  Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 2
}

# Rota el log si está muy grande (>10 MB)
if ((Test-Path $stdout) -and (Get-Item $stdout).Length -gt 10MB) {
  Move-Item $stdout "$stdout.$(Get-Date -Format 'yyyyMMdd-HHmmss')" -Force
}

Write-Host "Arrancando backend desde $backendDir ..."
$proc = Start-Process -FilePath 'node' `
  -ArgumentList 'dist\main.js' `
  -WorkingDirectory $backendDir `
  -RedirectStandardOutput $stdout `
  -RedirectStandardError $stderr `
  -WindowStyle Hidden `
  -PassThru

$proc.Id | Out-File $pidFile -Encoding ascii

Write-Host "Backend arrancado con PID $($proc.Id)"
Write-Host "Logs:    $stdout"
Write-Host "Errors:  $stderr"
Write-Host "PID file: $pidFile"
Write-Host ""
Write-Host "Para ver logs en vivo:   Get-Content '$stdout' -Wait -Tail 30"
Write-Host "Para parar el backend:   Stop-Process -Id $($proc.Id)"

# Espera hasta 20 segundos (Nest tarda ~8-10s en arrancar) verificando cada 2s
$started = $false
for ($i = 1; $i -le 10; $i++) {
  Start-Sleep -Seconds 2
  $check = Get-NetTCPConnection -State Listen -LocalPort 3001 -ErrorAction SilentlyContinue
  if ($check) { $started = $true; break }
  # Si el proceso ya murió, no sigas esperando
  if (-not (Get-Process -Id $proc.Id -ErrorAction SilentlyContinue)) { break }
}
if ($started) {
  Write-Host "`n[OK] Backend escuchando en puerto 3001" -ForegroundColor Green
} else {
  Write-Host "`n[ERROR] El puerto 3001 sigue libre tras 20s. Revisa $stderr" -ForegroundColor Red
  Get-Content $stderr -Tail 20
}
