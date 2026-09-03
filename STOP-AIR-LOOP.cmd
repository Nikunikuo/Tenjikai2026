@echo off
cd /d "%~dp0"
node scripts\launcher.mjs --stop
if errorlevel 1 pause
