@echo off
setlocal

cd /d "%~dp0"

echo Starting CPMS...
echo.
echo Admin dashboard: http://127.0.0.1:3000/
echo User gateway:    http://127.0.0.1:8000/user/
echo.
echo Keep the server window open while using the system.
echo.

start "CPMS Dev Server" cmd /k "npm.cmd run dev"

timeout /t 8 /nobreak >nul
start "" "http://127.0.0.1:3000/"
start "" "http://127.0.0.1:8000/user/"

endlocal
