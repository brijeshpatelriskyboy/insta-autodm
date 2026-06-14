# One-time local setup: portable Node + PostgreSQL, deps, migrate, seed
$ErrorActionPreference = "Stop"
$projectRoot = Split-Path $PSScriptRoot -Parent

# Portable Node
$nodeDir = "$env:LOCALAPPDATA\node-portable\node-v22.16.0-win-x64"
if (-not (Test-Path "$nodeDir\node.exe")) {
    Write-Host "Downloading portable Node.js..."
    $nodeZip = "$env:TEMP\node-v22.16.0-win-x64.zip"
    Invoke-WebRequest -Uri "https://nodejs.org/dist/v22.16.0/node-v22.16.0-win-x64.zip" -OutFile $nodeZip -UseBasicParsing
    New-Item -ItemType Directory -Force -Path "$env:LOCALAPPDATA\node-portable" | Out-Null
    Expand-Archive -Path $nodeZip -DestinationPath "$env:LOCALAPPDATA\node-portable" -Force
}
$env:PATH = "$nodeDir;$env:PATH"

# Portable PostgreSQL
$pgRoot = "$env:LOCALAPPDATA\insta-autodm\postgres"
if (-not (Test-Path "$pgRoot\pgsql\bin\initdb.exe")) {
    Write-Host "Downloading portable PostgreSQL..."
    $pgZip = "$env:TEMP\postgresql-16.6-1-windows-x64-binaries.zip"
    Invoke-WebRequest -Uri "https://get.enterprisedb.com/postgresql/postgresql-16.6-1-windows-x64-binaries.zip" -OutFile $pgZip -UseBasicParsing
    New-Item -ItemType Directory -Force -Path $pgRoot | Out-Null
    Expand-Archive -Path $pgZip -DestinationPath $pgRoot -Force
}

# Start PostgreSQL
& "$projectRoot\scripts\start-postgres.ps1"

# Copy env files
Copy-Item "$projectRoot\.env.example" "$projectRoot\.env" -Force
Copy-Item "$projectRoot\.env.example" "$projectRoot\backend\.env" -Force
"@`nNEXT_PUBLIC_API_URL=http://localhost:4000`n" | Set-Content "$projectRoot\frontend\.env.local" -Encoding UTF8

# Backend setup
Set-Location "$projectRoot\backend"
npm install
npm run db:generate
npm run db:migrate
npm run db:seed

Write-Host "`nSetup complete! Run scripts\dev.ps1 to start servers."
