@echo off
chcp 65001 >nul
title LinguaVerse - mahalliy server

echo.
echo   ==========================================
echo     LinguaVerse ishga tushmoqda...
echo   ==========================================
echo.

cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo   [XATO] Node.js topilmadi.
  echo.
  echo   Node.js ni o'rnating: https://nodejs.org
  echo.
  pause
  exit /b 1
)

echo   Brauzer ochilmoqda: http://localhost:5500
echo.
start "" http://localhost:5500

node dev-server.js 5500

echo.
echo   Server to'xtadi.
pause
