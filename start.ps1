# OpenAkita start script - launches backend + frontend
# Usage:
#   .\start.ps1          - Start Tauri GUI (desktop window)
#   .\start.ps1 -Web     - Start web UI (browser only, lighter)

param(
    [switch]$Web
)

$ErrorActionPreference = "Stop"
$root = "D:\agent\openakita-main"
$appDir = "$root\apps\setup-center"

Write-Host ""
Write-Host "=== OpenAkita Launcher ===" -ForegroundColor Cyan
Write-Host ""

# 0. Activate venv
if (-not $env:VIRTUAL_ENV) {
    Write-Host "[1/3] Activating venv..." -ForegroundColor Yellow
    & "$root\.venv\Scripts\Activate.ps1"
} else {
    Write-Host "[1/3] venv active" -ForegroundColor Green
}

# 1. Start backend
Write-Host "[2/3] Starting backend (openakita serve)..." -ForegroundColor Yellow
$backend = Start-Job -ScriptBlock {
    param($root)
    Set-Location $root
    & "$root\.venv\Scripts\python.exe" -m openakita serve 2>&1
} -ArgumentList $root

Start-Sleep -Seconds 3
if ($backend.State -ne "Running") {
    Write-Host "  WARNING: backend may have failed (LLM not configured?)" -ForegroundColor DarkYellow
    Write-Host "  GUI will still open - configure LLM in Settings." -ForegroundColor DarkYellow
} else {
    Write-Host "  OK  backend running (port 18900)" -ForegroundColor Green
}

# 2. Start frontend
Set-Location $appDir

if ($Web) {
    Write-Host "[3/3] Starting web UI (Vite dev server)..." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  Browser: http://127.0.0.1:5173" -ForegroundColor Cyan
    Write-Host ""
    npx vite
} else {
    Write-Host "[3/3] Starting Tauri GUI window..." -ForegroundColor Yellow
    Write-Host "  First compile takes 2-5 min, please wait..." -ForegroundColor DarkGray
    Write-Host ""
    npx cross-env OPENAKITA_EXTERNAL_BACKEND_DEV=1 tauri dev --config src-tauri/tauri.external-backend.dev.conf.json
}

# 3. Cleanup
Write-Host ""
Write-Host "Frontend exited. Stopping backend..." -ForegroundColor Yellow
Stop-Job $backend -ErrorAction SilentlyContinue
Remove-Job $backend -ErrorAction SilentlyContinue
Write-Host "Done." -ForegroundColor Green
