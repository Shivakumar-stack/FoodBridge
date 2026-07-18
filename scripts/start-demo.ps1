param(
  [int]$Port = 5000,
  [switch]$SkipTests,
  [switch]$VisionCheck,
  [switch]$OpenBrowser
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir
Set-Location $RepoRoot

function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Write-Ok {
  param([string]$Message)
  Write-Host "[OK] $Message" -ForegroundColor Green
}

function Write-Warn {
  param([string]$Message)
  Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Test-Command {
  param([string]$Name)
  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

Write-Host "FoodBridge demonstration runner" -ForegroundColor Green
Write-Host "Repository: $RepoRoot"

Write-Step "Checking prerequisites"
if (-not (Test-Command "node")) {
  throw "Node.js is not installed or not available on PATH."
}
if (-not (Test-Command "npm")) {
  throw "npm is not installed or not available on PATH."
}
Write-Ok "Node: $(node --version)"
Write-Ok "npm: $(npm --version)"

if (-not (Test-Path ".env")) {
  Write-Warn ".env was not found. Copy .env.example to .env and set MONGO_URI, JWT_SECRET, and SESSION_SECRET."
}

if (-not (Test-Path "node_modules")) {
  throw "node_modules was not found. Run npm install before the demo."
}
Write-Ok "Dependencies are installed"

$existingListener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($existingListener) {
  throw "Port $Port is already in use. Run with a different port, for example: npm run demo -- -Port 5063"
}
Write-Ok "Port $Port is available"

if (-not $SkipTests) {
  Write-Step "Running regression tests"
  npm test
  if ($LASTEXITCODE -ne 0) {
    throw "Tests failed. Fix the failure before demonstrating."
  }
  Write-Ok "Regression tests passed"
} else {
  Write-Warn "Skipping regression tests because -SkipTests was provided"
}

if ($VisionCheck) {
  Write-Step "Running live Hugging Face vision smoke check"
  node -e "require('dotenv').config(); const { analyzeFoodImage } = require('./backend/services/visionService'); (async () => { const result = await analyzeFoodImage('https://upload.wikimedia.org/wikipedia/commons/1/15/Red_Apple.jpg'); console.log(JSON.stringify({ success: result.success, detectedCategory: result.detectedCategory, labelsPreview: result.labels.slice(0, 3), confidence: result.confidence }, null, 2)); if (!result.success || result.detectedCategory !== 'Fruits') process.exit(1); })().catch((err) => { console.error(err.message); process.exit(1); });"
  if ($LASTEXITCODE -ne 0) {
    throw "Vision smoke check failed."
  }
  Write-Ok "Vision smoke check passed"
}

Write-Step "Starting FoodBridge backend and frontend"
$env:PORT = [string]$Port
$env:NODE_ENV = "development"

$LogDir = Join-Path $env:TEMP "foodbridge-demo"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$OutLog = Join-Path $LogDir "server-$Port.out.log"
$ErrLog = Join-Path $LogDir "server-$Port.err.log"
if (Test-Path $OutLog) { Remove-Item -LiteralPath $OutLog -Force }
if (Test-Path $ErrLog) { Remove-Item -LiteralPath $ErrLog -Force }

$ServerProcess = Start-Process `
  -FilePath "node" `
  -ArgumentList "backend/server.js" `
  -PassThru `
  -WindowStyle Hidden `
  -RedirectStandardOutput $OutLog `
  -RedirectStandardError $ErrLog

try {
  $HealthUrl = "http://localhost:$Port/api/health"
  $deadline = (Get-Date).AddSeconds(45)
  $health = $null

  Write-Step "Waiting for API health check"
  while ((Get-Date) -lt $deadline) {
    if ($ServerProcess.HasExited) {
      throw "Server exited early with code $($ServerProcess.ExitCode)."
    }

    try {
      $health = Invoke-RestMethod -Uri $HealthUrl -Method Get -TimeoutSec 3
      if ($health.success) { break }
    } catch {
      Start-Sleep -Seconds 2
    }
  }

  if (-not $health -or -not $health.success) {
    throw "Health check did not become ready at $HealthUrl."
  }

  Write-Ok "API is healthy"
  Write-Host ""
  Write-Host "Demo URLs" -ForegroundColor Green
  Write-Host "  Home:       http://localhost:$Port/pages/index.html"
  Write-Host "  Donate:     http://localhost:$Port/pages/donate.html"
  Write-Host "  Login:      http://localhost:$Port/pages/login.html"
  Write-Host "  Signup:     http://localhost:$Port/pages/signup.html"
  Write-Host "  Dashboard:  http://localhost:$Port/pages/dashboard-unified.html"
  Write-Host "  Live Map:   http://localhost:$Port/pages/live-map.html"
  Write-Host "  Health:     $HealthUrl"
  Write-Host ""
  Write-Host "Suggested demo flow" -ForegroundColor Green
  Write-Host "  1. Open Home and explain the platform."
  Write-Host "  2. Sign up or log in as a donor."
  Write-Host "  3. Submit a donation from Donate, optionally with an image."
  Write-Host "  4. Open Dashboard to show donation tracking."
  Write-Host "  5. Use NGO/volunteer accounts to claim, accept, pick up, deliver, and close."
  Write-Host "  6. Open Live Map to show realtime/map visibility."
  Write-Host ""
  Write-Host "Logs" -ForegroundColor Green
  Write-Host "  stdout: $OutLog"
  Write-Host "  stderr: $ErrLog"
  Write-Host ""

  if ($OpenBrowser) {
    Start-Process "http://localhost:$Port/pages/index.html"
  }

  Write-Host "Server is running. Press Ctrl+C in this terminal to stop it." -ForegroundColor Yellow
  Wait-Process -Id $ServerProcess.Id
} finally {
  if ($ServerProcess -and -not $ServerProcess.HasExited) {
    Write-Step "Stopping demo server"
    Stop-Process -Id $ServerProcess.Id -Force
    Write-Ok "Demo server stopped"
  }

  if (Test-Path $OutLog) {
    Write-Host ""
    Write-Host "Last server log lines" -ForegroundColor Cyan
    Get-Content $OutLog -Tail 20
  }

  if ((Test-Path $ErrLog) -and ((Get-Item $ErrLog).Length -gt 0)) {
    Write-Host ""
    Write-Host "Last server error lines" -ForegroundColor Yellow
    Get-Content $ErrLog -Tail 20
  }
}
