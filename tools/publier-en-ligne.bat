@echo off
cd /d "%~dp0.."
echo === BUILDER - publication Cloudflare Pages ===
echo.

where gh >nul 2>&1
if errorlevel 1 (
  echo Installe GitHub CLI : https://cli.github.com/
  echo Puis : gh auth login
  pause
  exit /b 1
)

gh auth status
if errorlevel 1 (
  echo Connecte-toi : gh auth login
  pause
  exit /b 1
)

if not exist .git (
  git init -b main
)

git add -A
git diff --cached --quiet
if errorlevel 1 git commit -m "Publish BUILDER site"

for /f %%u in ('gh api user -q .login') do set GHUSER=%%u
set REPO=build-sim

gh repo view "%GHUSER%/%REPO%" >nul 2>&1
if errorlevel 1 (
  gh repo create %REPO% --public --source=. --remote=origin --push
) else (
  git push -u origin main 2>nul
  git push origin main
)

echo.
echo Quand Cloudflare Pages a fini (1-2 min) :
echo   https://build-sim.pages.dev/
echo.
pause
