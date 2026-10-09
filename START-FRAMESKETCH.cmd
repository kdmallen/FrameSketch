@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo Please install Node.js 22 or newer from https://nodejs.org and run this file again.
 pause
 exit /b 1
)
where python >nul 2>nul
if errorlevel 1 (
 echo Please install Python 3.11 or newer from https://python.org with Add Python to PATH enabled.
 pause
 exit /b 1
)
if not exist .downloader-venv\Scripts\python.exe python -m venv .downloader-venv
if errorlevel 1 goto failed
.downloader-venv\Scripts\python.exe -m pip install -r scripts\downloader-requirements.txt
if errorlevel 1 goto failed
call npm ci --no-audit --no-fund
if errorlevel 1 goto failed
call npm run build
if errorlevel 1 goto failed
set "FRAMESKETCH_PYTHON=%CD%\.downloader-venv\Scripts\python.exe"
start "" http://127.0.0.1:4318
node scripts\link-downloader.mjs
pause
exit /b 0
:failed
echo Setup did not finish. Please send the error shown above.
pause
exit /b 1
