# OpenAkita source setup script
# Usage: open PowerShell, cd to D:\agent\openakita-main, then run: .\setup.ps1
# If execution policy blocks, run first: Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned

$ErrorActionPreference = "Stop"
Set-Location "D:\agent\openakita-main"

Write-Host ""
Write-Host "=== OpenAkita Source Setup ===" -ForegroundColor Cyan
Write-Host ""

# 1. Activate venv (already created with Python 3.13.12)
Write-Host "[1/4] Activating virtual environment..." -ForegroundColor Yellow
if (-not (Test-Path ".\.venv\Scripts\Activate.ps1")) {
    Write-Host "venv not found, creating one with Python 3.13..." -ForegroundColor Yellow
    & "C:\Users\Administrator\.workbuddy\binaries\python\versions\3.13.12\python.exe" -m venv .venv
}
& ".\.venv\Scripts\Activate.ps1"
Write-Host "OK  Python:" (python --version) -ForegroundColor Green
Write-Host ""

# 2. Install project + windows/desktop extras (Tsinghua mirror for speed)
Write-Host "[2/4] Installing dependencies (Tsinghua mirror)..." -ForegroundColor Yellow
python -m pip install -U pip -i https://pypi.tuna.tsinghua.edu.cn/simple
python -m pip install -e ".[windows,desktop]" -i https://pypi.tuna.tsinghua.edu.cn/simple
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: dependency install failed!" -ForegroundColor Red
    exit 1
}
Write-Host "OK  dependencies installed" -ForegroundColor Green
Write-Host ""

# 3. Install Playwright Chromium (for browser automation tools)
Write-Host "[3/4] Installing Playwright Chromium..." -ForegroundColor Yellow
try { python -m playwright install chromium } catch { Write-Host "Playwright install skipped" -ForegroundColor DarkGray }
Write-Host ""

# 4. Run setup wizard
Write-Host "[4/4] Launching setup wizard (openakita init)..." -ForegroundColor Cyan
Write-Host "This will guide you through LLM API key and config setup." -ForegroundColor DarkGray
Write-Host ""
openakita init

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host " Done! Start OpenAkita with:" -ForegroundColor Green
Write-Host ""
Write-Host "   openakita" -ForegroundColor White
Write-Host ""
Write-Host " Other commands:" -ForegroundColor Green
Write-Host "   openakita --help     (see all commands)"
Write-Host "   openakita serve      (web/API mode)"
Write-Host "========================================" -ForegroundColor Green
