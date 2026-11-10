@echo off
title OpenSea Ultra Sniper - One Click Auto Installer
color 0b
echo ======================================================================
echo    OPENSEA SEADROP & MULTI-CHAIN ULTRA SNIPER AUTO-INSTALLER
echo ======================================================================
echo.

:: 1. Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0c
    echo [ERROR] Node.js is not installed!
    echo Please download and install Node.js from: https://nodejs.org/
    echo Press any key to open the download page...
    pause >nul
    start https://nodejs.org/
    exit /b 1
)

echo [*] Node.js detected:
node --version
echo.

:: 2. Install dependencies
echo [*] Installing dependencies via npm...
call npm install
if %errorlevel% neq 0 (
    color 0c
    echo [ERROR] npm install failed. Please check your internet connection.
    pause
    exit /b 1
)

:: 3. Link globally
echo.
echo [*] Setting up global 'sniper' shortcut...
call npm link >nul 2>nul

color 0a
echo.
echo ======================================================================
echo [SUCCESS] OpenSea Ultra Sniper is ready to use!
echo.
echo You can now:
echo   1. Double click 'run.bat' anytime to start the bot.
echo   2. Or type 'sniper' in any terminal window.
echo ======================================================================
echo.
pause
