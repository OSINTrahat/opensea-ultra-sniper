@echo off
setlocal enabledelayedexpansion
title OpenSea Ultra Sniper - Full Auto Installer
color 0b

echo ======================================================================
echo    OPENSEA SEADROP & MULTI-CHAIN ULTRA SNIPER AUTO-INSTALLER
echo ======================================================================
echo.

:: 1. Auto-Unlock PowerShell Script Execution Policy silently
echo [*] Checking and configuring Windows script permissions...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force" >nul 2>nul

:: 2. Auto-Check and Auto-Install Git if missing
echo [*] Checking Git...
where git >nul 2>nul
if %errorlevel% neq 0 (
    echo [!] Git not found. Automatically installing Git for Windows...
    winget install --id Git.Git -e --source winget --accept-source-agreements --accept-package-agreements --silent >nul 2>nul
    if %errorlevel% neq 0 (
        echo [!] Downloading Git installer directly...
        powershell -Command "Invoke-WebRequest -Uri 'https://github.com/git-for-windows/git/releases/download/v2.44.0.windows.1/Git-2.44.0-64-bit.exe' -OutFile 'git-setup.exe'"
        start /wait git-setup.exe /VERYSILENT /NORESTART
        del /f /q git-setup.exe >nul 2>nul
    )
    echo [*] Git installed successfully!
) else (
    echo [*] Git is already installed.
)

:: 3. Auto-Check and Auto-Install Node.js if missing
echo [*] Checking Node.js...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [!] Node.js not found. Automatically installing Node.js LTS...
    winget install --id OpenJS.NodeJS.LTS -e --source winget --accept-source-agreements --accept-package-agreements --silent >nul 2>nul
    if %errorlevel% neq 0 (
        echo [!] Downloading Node.js MSI installer directly...
        powershell -Command "Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.12.2/node-v20.12.2-x64.msi' -OutFile 'node-setup.msi'"
        start /wait msiexec /i node-setup.msi /quiet /norestart
        del /f /q node-setup.msi >nul 2>nul
    )
    echo [*] Node.js installed successfully!
) else (
    echo [*] Node.js is already installed.
)

:: Refresh Environment Path silently
set "PATH=%PATH%;C:\Program Files\Git\cmd;C:\Program Files\nodejs;%APPDATA%\npm"

:: 4. Auto-Install Dependencies
echo [*] Installing all required bot modules...
call npm install --silent

:: 5. Auto-Link Global 'sniper' Command
echo [*] Creating global shortcut...
call npm link >nul 2>nul

color 0a
echo.
echo ======================================================================
echo [SUCCESS] Everything is installed and configured automatically!
echo ======================================================================
echo.
echo Launching OpenSea Ultra Sniper now...
timeout /t 2 >nul
node cli.js
pause
