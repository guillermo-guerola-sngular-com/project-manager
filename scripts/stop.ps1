$ContainerName = "pm-app"

$existing = docker ps -a --filter "name=^/$ContainerName`$" --format "{{.Names}}"

if ($existing) {
    docker rm -f $ContainerName | Out-Null
    Write-Host "Stopped $ContainerName."
} else {
    Write-Host "$ContainerName was not running."
}
