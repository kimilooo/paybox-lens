@echo off
setlocal
cd /d "%~dp0"
if not exist "%~dp0runtime\node.exe" (
  echo Please extract the Windows portable ZIP from the GitHub Releases page.
  echo Source-code ZIPs do not include Node.js. See docs\EASY_START.md.
  pause
  exit /b 1
)
"%~dp0runtime\node.exe" "%~dp0scripts\portable-start.mjs"
if errorlevel 1 pause
endlocal
