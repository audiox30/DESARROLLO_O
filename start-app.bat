@echo off
title Sistema de Control de Vacaciones - Grupo JAMA
color 0B
echo =======================================================================
echo          GRUPO JAMA - CONTROL DE VACACIONES (ON-PREMISE)
echo               Desarrollo Organizacional y TI
echo =======================================================================
echo.
echo Iniciando servidor web unificado en http://localhost:5001...
echo.
cd /d "%~dp0server"
node src/app.js
pause
