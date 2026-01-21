@echo off
title SISTEMA MINERO - COPIA DE SEGURIDAD
color 0A

echo ==================================================
echo      INICIANDO RESPALDO DE BASE DE DATOS
echo ==================================================
echo.

:: 1. Crear carpeta de backups en el Disco C si no existe
if not exist "C:\Backups_Mineria" mkdir "C:\Backups_Mineria"

:: 2. Obtener fecha (Formato universal para que no falle)
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set FECHA=%datetime:~0,4%-%datetime:~4,2%-%datetime:~6,2%_%datetime:~8,2%hs

:: 3. Copiar la base de datos
copy "prisma\dev.db" "C:\Backups_Mineria\Respaldo_%FECHA%.db"

echo.
echo ==================================================
echo    EXITO: Copia guardada en C:\Backups_Mineria
echo ==================================================
timeout /t 5