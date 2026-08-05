$ErrorActionPreference = "Stop"

$ImageName = "pm-app"
$ContainerName = "pm-app"
$Port = 8000

Set-Location (Join-Path $PSScriptRoot "..")

docker build -t $ImageName .
try { docker rm -f $ContainerName 2>$null | Out-Null } catch {}
docker run -d --name $ContainerName -p "${Port}:${Port}" --env-file .env $ImageName

Write-Host "Running at http://localhost:$Port"
