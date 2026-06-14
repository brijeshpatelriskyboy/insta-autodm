# Fix hung/broken frontend: kill port 3000, clear .next cache, restart
$ErrorActionPreference = "Stop"
$projectRoot = Split-Path $PSScriptRoot -Parent
$nodeDir = "$env:LOCALAPPDATA\node-portable\node-v22.16.0-win-x64"
$env:PATH = "$nodeDir;$env:PATH"

function Stop-PortListener([int]$Port) {
    $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    foreach ($conn in $connections) {
        Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
        Write-Host "Stopped process $($conn.OwningProcess) on port $Port"
    }
}

Write-Host "Stopping anything on port 3000..."
Stop-PortListener 3000
Start-Sleep -Seconds 2

$nextDir = Join-Path $projectRoot "frontend\.next"
if (Test-Path $nextDir) {
    Remove-Item -Recurse -Force $nextDir
    Write-Host "Cleared frontend/.next cache"
}

Write-Host "Starting frontend on http://localhost:3000 ..."
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$projectRoot\frontend'; `$env:PATH='$nodeDir;' + `$env:PATH; npm run dev"
)

Write-Host "`nFrontend restarting in a new window."
Write-Host "Login: http://localhost:3000/login"
Write-Host "Demo:  demo@instaautodm.com / demo1234"
