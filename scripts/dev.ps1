# Start backend + frontend dev servers
$ErrorActionPreference = "Stop"
$projectRoot = Split-Path $PSScriptRoot -Parent

$nodeDir = "$env:LOCALAPPDATA\node-portable\node-v22.16.0-win-x64"
$env:PATH = "$nodeDir;$env:PATH"

& "$projectRoot\scripts\start-postgres.ps1"

Write-Host "Starting backend on http://localhost:4000 ..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectRoot\backend'; `$env:PATH='$nodeDir;' + `$env:PATH; npm run dev"

Start-Sleep -Seconds 3

Write-Host "Starting frontend on http://localhost:3000 ..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectRoot\frontend'; `$env:PATH='$nodeDir;' + `$env:PATH; npm run dev"

Write-Host "`nServers starting in separate windows."
Write-Host "Frontend: http://localhost:3000"
Write-Host "Login:    http://localhost:3000/login"
Write-Host "Backend:  http://localhost:4000"
Write-Host "Demo:     demo@instaautodm.com / demo1234"
Write-Host "`nIf login page fails: scripts\restart-frontend.ps1"
