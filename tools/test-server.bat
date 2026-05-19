@echo off
cd /d "%~dp0.."
echo.
echo Serveur de TEST — XP / energie / API locale
echo.
start "" "http://localhost:8770/test/"
node tools/test-server.mjs
