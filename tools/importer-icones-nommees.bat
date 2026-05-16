@echo off
cd /d "%~dp0.."
echo.
echo === Import icônes avec vrais noms ===
echo Place tes PNG dans assets\icone\ (ou icones\ ou import\)
echo Noms attendus : passive-*.png, skill-*.png, evo-*.png, mythic-*.png
echo Manquants dans icone\ : complétés par import\54.png…57.png (anciennes images)
echo Liste complète : tools\ORDER.txt
echo.

where py >nul 2>&1 && set PY=py -3
if not defined PY where python >nul 2>&1 && set PY=python
if not defined PY (
  echo Python introuvable.
  pause
  exit /b 1
)

if not "%~1"=="" (
  %PY% tools\import_named_icons.py "%~1"
  goto after_py
)
if exist "assets\icone\" (
  %PY% tools\import_named_icons.py "assets\icone"
  goto after_py
)
%PY% tools\import_named_icons.py

:after_py
set ERR=%ERRORLEVEL%
echo.
if %ERR% equ 0 (echo Succes.) else (echo Incomplet — voir tools\last_copy.log)
pause
exit /b %ERR%
