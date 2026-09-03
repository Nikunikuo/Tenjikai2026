@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js 22.13 or newer, then run this file again.
  pause
  exit /b 1
)
node -e "const [a,b]=process.versions.node.split('.').map(Number);if(a<22||(a===22&&b<13)){console.error('Node.js 22.13 or newer is required.');process.exit(1)}"
if errorlevel 1 (
  pause
  exit /b 1
)
call npm ci
if errorlevel 1 (
  pause
  exit /b 1
)
call npm run build:local
if errorlevel 1 (
  pause
  exit /b 1
)
echo.
echo AIR LOOP setup complete. Double-click START-AIR-LOOP.cmd to open the player.
pause
