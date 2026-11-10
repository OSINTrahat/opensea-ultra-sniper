@echo off
title OpenSea Ultra Sniper
color 0b
node cli.js
if %errorlevel% neq 0 (
    echo.
    echo Something went wrong. Make sure you ran setup.bat first.
    pause
)
