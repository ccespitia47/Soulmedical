@echo off
cd /d "C:\proyectos\Soulmedical\backend"
"C:\Program Files\nodejs\node.exe" "C:\proyectos\Soulmedical\backend\dist\main.js" 1>>"C:\proyectos\Soulmedical\backend\logs\backend.log" 2>>"C:\proyectos\Soulmedical\backend\logs\backend.err.log"
