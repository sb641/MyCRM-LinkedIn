@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo ============================================================
echo  MyCRM LinkedIn - One-Click Test Sync Launcher
echo ============================================================
echo.

REM ---- Load .env values ----
if exist ".env" (
  for /f "usebackq tokens=1,* delims==" %%A in (".env") do (
    set "%%A=%%B"
  )
)

echo [1/3] Checking app is running at http://localhost:3000 ...
curl -s -o nul -w "%%{http_code}" http://localhost:3000 | findstr /r "200 301 302" >nul
if errorlevel 1 (
  echo.
  echo  WARNING: App doesn't seem to be running.
  echo  Start the app first with: start-app.bat
  echo  Then run this launcher again.
  echo.
  pause
  exit /b 1
)
echo  -> App is reachable.

echo.
echo [2/3] Triggering manual sync via API ...
curl -s -X POST http://localhost:3000/api/sync/manual ^
  -H "Content-Type: application/json" ^
  -d "{\"accountId\":\"local-account\",\"provider\":\"linkedin-browser\"}"
echo.

echo.
echo [3/3] Sync job queued. Opening Inbox in browser ...
start "" "http://localhost:3000/inbox"

echo.
echo ============================================================
echo  Done. Check the Inbox tab - threads should appear shortly.
echo  Watch the worker window for progress logs.
echo ============================================================
echo.
pause