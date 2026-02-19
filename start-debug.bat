@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

echo [THchess] launcher

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js not found. Please install Node.js 20+ first.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm not found. Please reinstall Node.js.
  pause
  exit /b 1
)

for /f "tokens=1 delims=." %%v in ('node -v') do set NODE_MAJOR=%%v
set NODE_MAJOR=%NODE_MAJOR:v=%
if "%NODE_MAJOR%"=="" (
  echo [ERROR] failed to detect Node.js version.
  pause
  exit /b 1
)

if %NODE_MAJOR% LSS 20 (
  echo [ERROR] Your Node.js is too old for vite 7. Current: 
  node -v
  echo Please upgrade to Node.js 20.19+ or 22.12+.
  pause
  exit /b 1
)

if not exist node_modules (
  echo [THchess] installing dependencies...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
  )
)

echo.
echo Select launch mode:
echo   1. Normal mode
echo   2. Debug mode (^?debug)
echo   3. Test mode (^?test)
echo   4. Replay mode (^?replay)
set /p MODE_CHOICE=Input 1, 2, 3 or 4 [default 1]: 
if "%MODE_CHOICE%"=="" set MODE_CHOICE=1

set QUERY=
if "%MODE_CHOICE%"=="2" set QUERY=?debug
if "%MODE_CHOICE%"=="3" set QUERY=?test
if "%MODE_CHOICE%"=="4" set QUERY=?replay

echo [THchess] launching Vite dev server...
start "THchess Dev Server" cmd /k "cd /d %cd% && npm run dev -- --host 127.0.0.1 --port 5173"

echo [THchess] waiting for server startup...
timeout /t 3 /nobreak >nul

set URL=http://127.0.0.1:5173/%QUERY%
set URL_A=%URL%
set URL_B=%URL%

if "%MODE_CHOICE%"=="2" (
  set PAIR_TOKEN=%RANDOM%%RANDOM%
  set URL_A=http://127.0.0.1:5173/?debug^&autopair=1^&pair=!PAIR_TOKEN!^&side=blue
  set URL_B=http://127.0.0.1:5173/?debug^&autopair=1^&pair=!PAIR_TOKEN!^&side=red
)

echo [THchess] opening two pages:
echo   %URL_A%
echo   %URL_B%

start "" "%URL_A%"
start "" "%URL_B%"

echo [THchess] done. Keep the "THchess Dev Server" window open while debugging.
exit /b 0
