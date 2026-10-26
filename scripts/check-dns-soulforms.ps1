# ─────────────────────────────────────────────────────────────────────────────
# Verifica a qué IP está apuntando soulforms.com.co y la compara contra la IP
# pública real del servidor. Útil para enviar como evidencia a IT cuando el
# registro A del dominio queda desactualizado en Bluehost.
#
# Uso: desde cualquier PowerShell (no requiere admin):
#   cd C:\proyectos\Soulmedical\scripts
#   .\check-dns-soulforms.ps1
# ─────────────────────────────────────────────────────────────────────────────

$ErrorActionPreference = 'SilentlyContinue'

Write-Host ""
Write-Host "===== EVIDENCIA DNS - soulforms.com.co =====" -ForegroundColor Yellow
Write-Host "Fecha: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor DarkGray
Write-Host ""

Write-Host ">>> DNS Google (8.8.8.8) resuelve a:" -ForegroundColor Cyan
$ipGoogle = (Resolve-DnsName soulforms.com.co -Type A -Server 8.8.8.8).IPAddress
Write-Host "    $ipGoogle"
Write-Host ""

Write-Host ">>> DNS Cloudflare (1.1.1.1) resuelve a:" -ForegroundColor Cyan
$ipCloudflare = (Resolve-DnsName soulforms.com.co -Type A -Server 1.1.1.1).IPAddress
Write-Host "    $ipCloudflare"
Write-Host ""

Write-Host ">>> Nameservers del dominio:" -ForegroundColor Cyan
foreach ($ns in (Resolve-DnsName soulforms.com.co -Type NS -Server 8.8.8.8).NameHost) {
  Write-Host "    $ns"
}
Write-Host ""

Write-Host ">>> IP publica REAL del servidor donde corre SoulForms:" -ForegroundColor Green
$ipReal = $null
try { $ipReal = (Invoke-RestMethod -Uri 'https://api.ipify.org?format=json' -TimeoutSec 5).ip } catch {}
if (-not $ipReal) {
  try { $ipReal = (Invoke-RestMethod -Uri 'https://ifconfig.me/ip' -TimeoutSec 5) } catch {}
}
Write-Host "    $ipReal"
Write-Host ""

if ($ipGoogle -eq $ipReal) {
  Write-Host "===== OK =====" -ForegroundColor Green
  Write-Host "El dominio apunta correctamente al servidor actual."
} else {
  Write-Host "===== PROBLEMA =====" -ForegroundColor Red
  Write-Host "El dominio apunta a:    $ipGoogle" -ForegroundColor Red
  Write-Host "La IP real del server:  $ipReal" -ForegroundColor Green
  Write-Host ""
  Write-Host "Accion requerida:" -ForegroundColor Yellow
  Write-Host "  En el panel de Bluehost (DNS del dominio soulforms.com.co),"
  Write-Host "  cambiar el registro A de"
  Write-Host "      @  ->  $ipGoogle"
  Write-Host "  a"
  Write-Host "      @  ->  $ipReal"
  Write-Host "  TTL: puede dejarse en 3600 (1h) para propagacion mas rapida."
}
Write-Host ""
