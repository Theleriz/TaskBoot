@echo off
rem Opens the web version of Task Tracker in its own Edge window (no tabs, no address bar).
start "" msedge --app="file:///%~dp0index.html"
