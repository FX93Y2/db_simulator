@echo off
echo Starting DB Simulator with Administrator privileges...
echo.

REM Check if we're already running as administrator
net session >nul 2>&1
if %errorLevel% == 0 (
    echo Already running as Administrator.
    echo Starting Electron application...
    npm run start
) else (
    echo Requesting Administrator privileges...
    powershell -Command "Start-Process cmd -ArgumentList '/c cd /d \"%~dp0\" && npm run start && pause' -Verb RunAs"
)

pause