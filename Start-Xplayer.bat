@echo off
rem Runs Xplayer straight from Source (new interface). Data goes to .dev-data.
cd /d "%~dp0"
if not exist node_modules call npm install
call npm start -- %*
