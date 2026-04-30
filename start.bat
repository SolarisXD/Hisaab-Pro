@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

REM Hisaab-Pro Startup Script
set APP_DIR=%~dp0
set PORT=3000

echo Starting Hisaab-Pro...

REM Check if Node.js is available
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js not found. Please install Node.js or use portable runtime.
    pause
    exit /b 1
)

REM Start server
cd /d "%APP_DIR%server"
start /min cmd /c "node index.js"

REM Wait for server to start
timeout /t 3 >nul

REM Open browser
start http://localhost:%PORT%

echo Hisaab-Pro started! Server running at http://localhost:%PORT%
