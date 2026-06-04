@echo off
setlocal
set "APP_DIR=%~dp0"
cd /d "%APP_DIR%"

if exist "%APP_DIR%node\npm.cmd" (
  set "PATH=%APP_DIR%node;%PATH%"
  set "NPM_CMD=%APP_DIR%node\npm.cmd"
) else (
  set "NPM_CMD=npm"
)

if not exist ".env.local" (
  echo Missing .env.local. Copy .env.local.example to .env.local and fill VISIONARY_API_KEY.
  pause
  exit /b 1
)

start "" "http://127.0.0.1:3000"
%NPM_CMD% run dev -- --hostname 127.0.0.1 --port 3000
pause
