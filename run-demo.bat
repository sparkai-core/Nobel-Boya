@echo off
setlocal
echo ==========================================================
echo   NOBEL BOQ - QOBU DEMO
echo ==========================================================
cd /d "%~dp0app"

if not exist "dist\index.html" (
    echo Building application...
    call npm run build
)

echo Starting server and launching browser...
start "" "http://localhost:5173/#/"
call npx vite preview --port 5173
pause


