$ErrorActionPreference = "Stop"

$ImageName = "pm-app"
$ContainerName = "pm-app"
$Port = 8000

Set-Location (Join-Path $PSScriptRoot "..")

$DataDir = Join-Path (Get-Location).Path "data"
New-Item -ItemType Directory -Force -Path $DataDir | Out-Null

docker build -t $ImageName .
try { docker rm -f $ContainerName 2>$null | Out-Null } catch {}
docker run -d --name $ContainerName -p "${Port}:${Port}" -v "${DataDir}:/app/data" --env-file .env $ImageName

Write-Host "Running at http://localhost:$Port"

Set-Location $PSScriptRoot
