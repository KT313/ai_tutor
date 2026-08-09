@echo off
setlocal enabledelayedexpansion
title AI Tutor

echo.
echo  ===================================================
echo     AI Tutor - Setup and Launcher
echo  ===================================================
echo.

cd /d "%~dp0"

REM --- Check for Node.js ---
where node >/dev/null 2>&1
if %errorlevel% equ 0 goto node_found

echo  Node.js is not installed. Installing it now...
echo.

where winget >/dev/null 2>&1
if %errorlevel% equ 0 (
    echo  Installing via Windows Package Manager...
    echo.
    winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
    if %errorlevel% equ 0 goto node_installed_refresh
)

echo  Downloading Node.js installer...
echo.

set "NODE_MSI=%TEMP%\nodejs-install.msi"
powershell -Command "try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://nodejs.org/dist/v22.15.0/node-v22.15.0-x64.msi' -OutFile '%NODE_MSI%' -UseBasicParsing; exit 0 } catch { Write-Host $_.Exception.Message; exit 1 }"

if %errorlevel% neq 0 (
    echo.
    echo  Could not download Node.js automatically.
    echo  Please install it manually from https://nodejs.org
    echo  Then double-click start.bat again.
    echo.
    pause
    exit /b 1
)

echo  Download complete. Running installer...
echo.
msiexec /i "%NODE_MSI%" /qb
del "%NODE_MSI%" >/dev/null 2>&1

:node_installed_refresh
set "PATH=C:\Program Files\nodejs;%PATH%"

where node >/dev/null 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  Node.js was installed but this window needs to restart.
    echo  Please close this window and double-click start.bat again.
    echo.
    pause
    exit /b 0
)

echo.
echo  Node.js installed successfully!
echo.

:node_found
for /f "tokens=*" %%v in ('node --version') do set "NODE_VER=%%v"
echo  [OK] Node.js %NODE_VER%
echo.

where npm >/dev/null 2>&1
if %errorlevel% neq 0 (
    echo  ERROR: npm not found. Reinstall Node.js from https://nodejs.org
    pause
    exit /b 1
)

REM --- Install dependencies ---
if exist "node_modules\.bin\tsx.cmd" goto deps_ok

echo  [..] Installing dependencies (first run, takes about a minute)...
echo.
call npm install
if %errorlevel% neq 0 (
    echo.
    echo  Dependency install failed. Check your internet connection.
    echo  Try deleting the node_modules folder and running start.bat again.
    echo.
    pause
    exit /b 1
)
echo.
echo  [OK] Dependencies installed
echo.

:deps_ok

REM --- Build frontend ---
if exist "dist\index.html" goto build_ok

echo  [..] Building frontend (first run, takes a moment)...
echo.
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo  Build failed. Delete node_modules and dist folders, then try again.
    echo.
    pause
    exit /b 1
)
echo.
echo  [OK] Frontend built
echo.

:build_ok

REM --- Start server ---
echo  ===================================================
echo.
echo     AI Tutor is running!
echo.
echo     Your browser should open automatically.
echo     If not, open: http://localhost:5174
echo.
echo     To stop: close this window or press Ctrl+C
echo.
echo  ===================================================
echo.

start "" "http://localhost:5174"
call npm start

echo.
echo  Server stopped. You can close this window.
pause
