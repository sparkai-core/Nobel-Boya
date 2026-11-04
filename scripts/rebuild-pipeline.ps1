# Rebuild data pipeline and regenerate qobu.json
$RepoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location "$RepoRoot\tools"

Write-Host "Running data pipeline extraction & validation..." -ForegroundColor Cyan
py -3 build_data.py
Write-Host "Verifying bounding box crops..." -ForegroundColor Cyan
py -3 verify_boxes.py
Write-Host "Pipeline rebuild complete." -ForegroundColor Green
