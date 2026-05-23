$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$log = Join-Path $PSScriptRoot "deploy-result.txt"

function Log($msg) { Add-Content -Path $log -Value $msg; Write-Host $msg }

Remove-Item $log -ErrorAction SilentlyContinue
Log "ROOT=$root"
Log "GIT=$(git --version 2>&1)"
Log "GH=$(gh --version 2>&1)"

gh auth status 2>&1 | ForEach-Object { Log $_ }
$user = (gh api user -q .login 2>&1)
Log "USER=$user"

if (-not (Test-Path .git)) { git init -b main | ForEach-Object { Log $_ } }
git add -A
$st = git status --porcelain
if ($st) { git commit -m "Deploy BUILDER" | ForEach-Object { Log $_ } }

$repo = "build-sim"
$exists = $false
try { gh repo view "$user/$repo" 2>$null | Out-Null; $exists = $true } catch {}

if (-not $exists) {
  gh repo create $repo --public --source=. --remote=origin --push 2>&1 | ForEach-Object { Log $_ }
} else {
  git remote get-url origin 2>$null | ForEach-Object { Log "REMOTE=$_" }
  if ($LASTEXITCODE -ne 0) {
    git remote add origin "https://github.com/$user/$repo.git"
  }
  git push -u origin main 2>&1 | ForEach-Object { Log $_ }
}

$url = "https://build-sim.pages.dev/"
Log "URL=$url"
Log "DONE"
