@echo off
rem Builds Task Tracker with the C# compiler that ships with Windows (.NET Framework 4.8).
rem Nothing needs to be installed. Output: bin\TaskTracker.exe
setlocal
cd /d "%~dp0"

set "FW=%WINDIR%\Microsoft.NET\Framework64\v4.0.30319"
if not exist "%FW%\csc.exe" set "FW=%WINDIR%\Microsoft.NET\Framework\v4.0.30319"
if not exist "%FW%\csc.exe" (
  echo csc.exe from .NET Framework 4.x was not found
  exit /b 1
)

set "OUT=%~1"
if "%OUT%"=="" set "OUT=bin\TaskTracker.exe"
if not exist bin mkdir bin

"%FW%\csc.exe" /nologo /target:winexe /optimize+ /codepage:65001 /out:"%OUT%" /win32manifest:app.manifest /win32icon:app.ico /r:"%FW%\WPF\PresentationCore.dll" /r:"%FW%\WPF\PresentationFramework.dll" /r:"%FW%\WPF\WindowsBase.dll" /r:"%FW%\System.Xaml.dll" /r:"%FW%\System.Web.Extensions.dll" /r:"%FW%\System.Windows.Forms.dll" /r:"%FW%\System.Drawing.dll" src\*.cs
if errorlevel 1 exit /b 1

echo Built: %OUT%
