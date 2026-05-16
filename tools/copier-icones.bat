@echo off
cd /d "%~dp0"
echo.
echo === Copie des icones vers assets\png ===
echo Dossier source : %~dp0..\assets\import\
echo.

where py >nul 2>&1 && set PY=py -3
if not defined PY where python >nul 2>&1 && set PY=python
if not defined PY (
  echo Python introuvable. Installe Python depuis python.org puis relance ce fichier.
  pause
  exit /b 1
)

%PY% assign_by_number.py
set ERR=%ERRORLEVEL%

echo.
if %ERR% neq 0 (
  echo Echec. Lis le message ci-dessus ou ouvre : tools\last_copy.log
) else (
  echo Succes. Ouvre ou recharge : %~dp0..\index.html
)
echo.
pause
exit /b %ERR%
