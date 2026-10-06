@echo off
title Arduino Hub
echo Starting Arduino Hub server...
cd /d "%~dp0server"
if not exist node_modules (
    echo Installing dependencies, please wait...
    call npm.cmd install --no-audit --no-fund
)
start "" "http://localhost:3000"
node server.js
pause
