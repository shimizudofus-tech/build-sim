@echo off
cd /d "%~dp0.."
echo Serveur local : http://localhost:8765/
echo Ouvre cette adresse si le navigateur ne s'ouvre pas seul.
echo Ctrl+C pour arreter.
start "" "http://localhost:8765/"
node server.js 2>nul || py -3 -m http.server 8765 2>nul || python -m http.server 8765
