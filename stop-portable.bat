@echo off
setlocal
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
  taskkill /PID %%a /F >nul 2>nul
)
echo Image Studio server on port 3000 has been stopped if it was running.
pause
