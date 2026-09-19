@echo off
taskkill /F /IM electron.exe >nul 2>&1
timeout /t 1 /nobreak >nul
start "" "%~dp0..\..\App\electron.exe" "%~dp0..\..\App"