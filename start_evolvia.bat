@echo off
title Evolvia Production Server
color 0B
echo ========================================================
echo       EVOLVIA TECHNOLOGIES - SMART SOFTWARE
echo ========================================================
echo.
echo Starting Evolvia Backend and Web Services...
cd /d "%~dp0backend"
if not exist node_modules (
    echo Installing dependencies...
    call npm install --omit=dev
)
echo Launching server on port 4000...
echo.
echo Public Website:   http://localhost:4000
echo Admin CRM:        http://localhost:4000/admin.html
echo Settings Panel:   http://localhost:4000/settings.html
echo.
echo Press Ctrl+C anytime to stop the server.
echo.
node server.js
pause
