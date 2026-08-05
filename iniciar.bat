@echo off
title Sitio Web - Lic. en Psicologia
setlocal

rem ---------------------------------------------------------------------
rem  INICIAR.BAT - Sitio web (Lic. Juan Manuel Álvarez Basabe - Consumos Problemáticos y Adicciones)
rem  Doble clic: verifica dependencias, instala si falta, inicia el
rem  servidor, espera, abre el navegador y deja la consola abierta.
rem ---------------------------------------------------------------------

cd /d "%~dp0"

echo ============================================================
echo   Sitio Web - Lic. en Psicologia
echo   Consumos Problemáticos y Adicciones
echo ============================================================
echo.

rem --- 1) Verificar que Node.js este instalado ---
where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] No se encontro Node.js instalado.
    echo         Descargalo desde https://nodejs.org e instalalo.
    echo         Luego volve a ejecutar este archivo.
    echo.
    pause
    exit /b 1
)

rem --- 2) Verificar dependencias (npm install si hace falta) ---
if not exist "node_modules" (
    echo [1/3] No se encontraron las dependencias.
    echo        Instalando con npm install...
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo [ERROR] No se pudieron instalar las dependencias.
        echo         Revisa tu conexion a internet e intenta de nuevo.
        echo.
        pause
        exit /b 1
    )
    echo.
    echo        Dependencias instaladas correctamente.
) else (
    echo [1/3] Dependencias encontradas. OK.
)

echo.
echo [2/3] Iniciando el servidor en http://localhost:3000 ...
echo.
echo        Esta ventana muestra los errores del servidor.
echo        No la cierres mientras estes usando el sitio.
echo.

rem --- 3) Abrir el navegador unos segundos despues (servidor listo) ---
start "Abrir navegador" /min cmd /c "timeout /t 6 /nobreak >nul & start http://localhost:3000"

rem --- 4) Ejecutar el servidor en primer plano ---
call npm start

echo.
echo El servidor se detuvo.
echo.
pause
