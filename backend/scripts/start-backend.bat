@echo off
setlocal
set "BACKEND_DIR=c:\proyectos\Soulmedical\backend"
set "NODE_EXE=C:\Program Files\nodejs\node.exe"
set "LOG_DIR=%BACKEND_DIR%\logs"

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

cd /d "%BACKEND_DIR%"

for /f %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set "TS=%%I"
set "LOG_FILE=%LOG_DIR%\backend-%TS%.log"

set NODE_ENV=production
"%NODE_EXE%" dist\main.js >> "%LOG_FILE%" 2>&1
