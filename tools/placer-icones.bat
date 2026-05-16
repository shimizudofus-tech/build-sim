@echo off

cd /d "%~dp0.."

echo.

echo === Placer les icones (dossier icone / vrais noms) ===

echo.



where py >nul 2>&1 && set PY=py -3

if not defined PY where python >nul 2>&1 && set PY=python

if not defined PY (

  echo Python introuvable — installe Python 3 puis relance.

  pause

  exit /b 1

)



if exist "assets\icone\*.png" goto run_named

if exist "assets\icones\*.png" goto run_named

if exist "assets\import\passive-*.png" goto run_named

if exist "assets\import\skill-*.png" goto run_named



echo Aucun PNG nomme dans assets\icone\ — essai import numerote 01-57...

echo.

%PY% tools\assign_by_number.py

goto done



:run_named

%PY% tools\import_named_icons.py



:done

set ERR=%ERRORLEVEL%

echo.

echo Rapport : tools\last_copy.log

echo Liste   : tools\inventaire-icones.txt

echo.

if %ERR% equ 0 (

  echo Succes — Ctrl+F5 sur index.html

) else (

  echo Incomplet — ouvre inventaire-icones.txt pour les fichiers manquants.

)

pause

exit /b %ERR%


