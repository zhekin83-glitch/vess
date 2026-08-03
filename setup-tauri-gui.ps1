# OpenAkita Tauri GUI setup script (source build)
# Run from PowerShell in project root:  .\setup-tauri-gui.ps1
# This builds and launches the same GUI window as the official .exe installer.
# LLM can be configured later from within the GUI (Setup Center).

$ErrorActionPreference = "Stop"
$projectRoot = "D:\agent\openakita-main"
$appDir = "$projectRoot\apps\setup-center"

Write-Host ""
Write-Host "=== OpenAkita Tauri GUI (source build) ===" -ForegroundColor Cyan
Write-Host ""

Set-Location $projectRoot

# 0. Ensure venv is active
if (-not $env:VIRTUAL_ENV) {
    Write-Host "[0/5] Activating virtual environment..." -ForegroundColor Yellow
    & ".venv\Scripts\Activate.ps1"
} else {
    Write-Host "[0/5] venv already active" -ForegroundColor Green
}

# 1. Check MSVC C++ Build Tools (Rust on Windows requires the MSVC linker)
Write-Host "[1/5] Checking MSVC C++ Build Tools..." -ForegroundColor Yellow
$vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
$hasMsvc = $false
if (Test-Path $vswhere) {
    $vcTool = & $vswhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property displayName 2>$null
    if ($vcTool) { $hasMsvc = $true }
}
if (-not $hasMsvc) {
    Write-Host "ERROR: MSVC C++ Build Tools not found." -ForegroundColor Red
    Write-Host "Rust on Windows requires the MSVC linker (link.exe)." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "1) Download Visual Studio Build Tools 2022:" -ForegroundColor White
    Write-Host "   https://visualstudio.microsoft.com/visual-cpp-build-tools/" -ForegroundColor Cyan
    Write-Host "2) In the installer, select workload: 'Desktop development with C++'" -ForegroundColor White
    Write-Host "3) Install, then re-open PowerShell and re-run this script." -ForegroundColor White
    Write-Host ""
    exit 1
}
Write-Host "OK  MSVC C++ Build Tools found" -ForegroundColor Green

# 1b. Install Rust toolchain if missing
Write-Host "Checking Rust toolchain..." -ForegroundColor Yellow
if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
    Write-Host "Rust not found. Downloading rustup-init..." -ForegroundColor Yellow
    $rustupExe = "$env:TEMP\rustup-init.exe"
    Invoke-WebRequest -Uri "https://win.rustup.rs/x86_64" -OutFile $rustupExe -UseBasicParsing
    Write-Host "Installing Rust (stable). This may take a few minutes..." -ForegroundColor Yellow
    & $rustupExe -y --default-toolchain stable --profile default
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Rust installation failed." -ForegroundColor Red
        exit 1
    }
    # Reload PATH so cargo is available in this session
    $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH", "User")
    Write-Host "OK  Rust installed" -ForegroundColor Green
} else {
    Write-Host "OK  Rust found:" (cargo --version) -ForegroundColor Green
}

# 2. Install Node.js dependencies
Write-Host "[2/5] Installing Node.js dependencies for Tauri frontend..." -ForegroundColor Yellow
Set-Location $appDir
if (-not (Test-Path "node_modules")) {
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: npm install failed." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "OK  node_modules already exists, skipping npm install" -ForegroundColor Green
}

# 3. Start OpenAkita backend (serve mode) in background
Write-Host "[3/5] Starting OpenAkita backend (openakita serve) in background..." -ForegroundColor Yellow
Set-Location $projectRoot
$backendLog = "$projectRoot\backend.log"
$backendJob = Start-Job -ScriptBlock {
    param($root)
    Set-Location $root
    .venv\Scripts\activate
    openakita serve
} -ArgumentList $projectRoot

# Wait a few seconds for backend to start
Start-Sleep -Seconds 5
if ($backendJob.State -ne "Running") {
    Write-Host "WARN  backend did not stay running (LLM not configured yet is OK)." -ForegroundColor DarkYellow
    Write-Host "      You can configure LLM later from the GUI Setup Center." -ForegroundColor DarkYellow
} else {
    Write-Host "OK  backend job started" -ForegroundColor Green
}

# 4. Launch Tauri dev window (uses external backend)
Write-Host "[4/5] Launching Tauri GUI window..." -ForegroundColor Cyan
Set-Location $appDir
Write-Host "The desktop window should appear in 30-90 seconds (Rust compile on first run)." -ForegroundColor DarkGray
npm run tauri:dev:external-backend

# 5. Cleanup when Tauri exits
Write-Host "[5/5] Tauri exited. Stopping backend job..." -ForegroundColor Yellow
Stop-Job $backendJob
Remove-Job $backendJob

Write-Host ""
Write-Host "Done." -ForegroundColor Green
