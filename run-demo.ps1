# One-click startup for Tutulan BOQ Platform Demo
param(
    [int]$Port = 5173,
    [switch]$BuildFirst,
    [switch]$Dev
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  TUTULAN BOQ PLATFORM - QOBU LOGISTICS COMPLEX DEMO     " -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Root: $RepoRoot" -ForegroundColor Gray

Set-Location "$RepoRoot\app"

if ($BuildFirst -or (-not (Test-Path "$RepoRoot\app\dist\index.html"))) {
    Write-Host "[1/3] Building production bundle..." -ForegroundColor Yellow
    npm run build
}

if ($Dev) {
    Write-Host "[2/2] Starting Vite Dev Server on port $Port..." -ForegroundColor Green
    Start-Job -ScriptBlock { param($p) Start-Sleep 3; Start-Process "http://localhost:$p/#/start" } -ArgumentList $Port | Out-Null
    npx vite --port $Port --open
} else {
    Write-Host "[2/2] Starting High-Performance Preview Server on port $Port..." -ForegroundColor Green
    Start-Job -ScriptBlock { param($p) Start-Sleep 2; Start-Process "http://localhost:$p/#/start" } -ArgumentList $Port | Out-Null
    npx vite preview --port $Port
}
