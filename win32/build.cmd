@echo off
rem Builds Task Tracker for Windows: the web app (..\web) and the WebView2 shell (this folder).
rem Requirements: Node.js 22.12+ and .NET SDK 8 or newer.
rem Usage: build.cmd [output folder]   (default: dist\TaskTracker)
setlocal
cd /d "%~dp0"
set "DOTNET_CLI_TELEMETRY_OPTOUT=1"
set "DOTNET_NOLOGO=1"

set "OUT=%~1"
if "%OUT%"=="" set "OUT=dist\TaskTracker"

where npm >nul 2>nul
if errorlevel 1 (
  echo npm was not found. Install Node.js 22.12 or newer.
  exit /b 1
)

set "DOTNET="
for %%I in (dotnet.exe) do set "DOTNET=%%~$PATH:I"
if not defined DOTNET if exist "%ProgramFiles%\dotnet\dotnet.exe" set "DOTNET=%ProgramFiles%\dotnet\dotnet.exe"
if not defined DOTNET (
  echo .NET SDK was not found. Install it, for example: winget install Microsoft.DotNet.SDK.10
  exit /b 1
)

echo === Web app
pushd ..\web
if not exist node_modules (
  call npm ci
  if errorlevel 1 goto :fail_web
)
call npm run build
if errorlevel 1 goto :fail_web
popd

echo === Windows shell
"%DOTNET%" publish TaskTracker.csproj -c Release -o "%OUT%"
if errorlevel 1 exit /b 1

echo.
echo Built: %OUT%\TaskTracker.exe
exit /b 0

:fail_web
popd
echo Web build failed.
exit /b 1
