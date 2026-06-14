# Portable PostgreSQL starter (no admin required)
$pgRoot = "$env:LOCALAPPDATA\insta-autodm\postgres"
$pgBin = Join-Path $pgRoot "pgsql\bin"
$dataDir = Join-Path $pgRoot "data"
$logFile = Join-Path $pgRoot "postgres.log"

if (-not (Test-Path $pgBin)) {
    Write-Error "PostgreSQL binaries not found at $pgBin. Run setup-local.ps1 first."
    exit 1
}

$env:PATH = "$pgBin;$env:PATH"

if (-not (Test-Path $dataDir)) {
    Write-Host "Initializing PostgreSQL data directory..."
    & "$pgBin\initdb.exe" -D $dataDir -U postgres -E UTF8 --auth-local=trust --auth-host=trust
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

$status = & "$pgBin\pg_ctl.exe" -D $dataDir status 2>&1
if ($status -match "no server running") {
    Write-Host "Starting PostgreSQL..."
    & "$pgBin\pg_ctl.exe" -D $dataDir -l $logFile start
    Start-Sleep -Seconds 2
}

$dbExists = & "$pgBin\psql.exe" -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname='insta_autodm'" 2>$null
if ($dbExists -ne "1") {
    Write-Host "Creating database insta_autodm..."
    & "$pgBin\createdb.exe" -U postgres insta_autodm
}

Write-Host "PostgreSQL is running on localhost:5432"
Write-Host "Database: insta_autodm | User: postgres (trust auth)"
