# Fix: clone tao dependency via GitHub mirror + relaunch Tauri GUI
# Run from:  D:\agent\openakita-main\fix-tao-and-launch.ps1

$ErrorActionPreference = "Stop"
$projectRoot = "D:\agent\openakita-main"
$appDir = "$projectRoot\apps\setup-center"
$taoDir = "$appDir\src-tauri\vendor\tao"
$mirrors = @(
    "https://gh-proxy.com/https://github.com/SimYng/tao.git",
    "https://ghproxy.net/https://github.com/SimYng/tao.git",
    "https://github.moeyy.xyz/https://github.com/SimYng/tao.git",
    "https://kkgithub.com/SimYng/tao.git"
)

Write-Host ""
Write-Host "=== Fix tao dependency + launch Tauri GUI ===" -ForegroundColor Cyan
Write-Host ""

Set-Location $projectRoot

# 0. Activate venv
if (-not $env:VIRTUAL_ENV) {
    Write-Host "[0/4] Activating venv..." -ForegroundColor Yellow
    & ".venv\Scripts\Activate.ps1"
} else {
    Write-Host "[0/4] venv already active" -ForegroundColor Green
}

# 1. Clone tao repo via mirror (skip if already exists)
Write-Host "[1/4] Cloning tao patch dependency via GitHub mirror..." -ForegroundColor Yellow
if (Test-Path "$taoDir\Cargo.toml") {
    Write-Host "OK  tao already cloned at vendor/tao" -ForegroundColor Green
} else {
    $cloned = $false
    foreach ($mirror in $mirrors) {
        Write-Host "  Trying: $mirror" -ForegroundColor DarkGray
        git clone --depth 1 -b "fix/no-panic-destroyed-0.34.8" $mirror $taoDir 2>&1 | Out-Host
        if ($LASTEXITCODE -eq 0 -and (Test-Path "$taoDir\Cargo.toml")) {
            $cloned = $true
            Write-Host "OK  tao cloned successfully" -ForegroundColor Green
            break
        } else {
            Write-Host "  Failed, trying next mirror..." -ForegroundColor DarkYellow
            if (Test-Path $taoDir) { Remove-Item -Recurse -Force $taoDir -ErrorAction SilentlyContinue }
        }
    }
    if (-not $cloned) {
        Write-Host "ERROR: All mirrors failed. Try setting a proxy:" -ForegroundColor Red
        Write-Host "  git config --global http.proxy http://127.0.0.1:YOUR_PORT" -ForegroundColor Yellow
        Write-Host "Then re-run this script." -ForegroundColor Yellow
        exit 1
    }
}

# 2. Start backend
Write-Host "[2/4] Starting OpenAkita backend..." -ForegroundColor Yellow
$backendJob = Start-Job -ScriptBlock {
    param($root)
    Set-Location $root
    .venv\Scripts\activate
    openakita serve
} -ArgumentList $projectRoot
Start-Sleep -Seconds 3
if ($backendJob.State -ne "Running") {
    Write-Host "WARN  backend not running (LLM not configured is OK)" -ForegroundColor DarkYellow
} else {
    Write-Host "OK  backend started" -ForegroundColor Green
}

# 3. Launch Tauri GUI
Write-Host "[3/4] Launching Tauri GUI window..." -ForegroundColor Cyan
Write-Host "First compile may take 2-5 minutes (downloading + compiling Rust crates)..." -ForegroundColor DarkGray
Set-Location $appDir
npm run tauri:dev:external-backend

# 4. Cleanup
Write-Host "[4/4] Tauri exited. Stopping backend..." -ForegroundColor Yellow
Stop-Job $backendJob -ErrorAction SilentlyContinue
Remove-Job $backendJob -ErrorAction SilentlyContinue
Write-Host "Done." -ForegroundColor Green
