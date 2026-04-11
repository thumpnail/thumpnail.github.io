$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot
Write-Host "Starting local server in $PSScriptRoot"
Write-Host "Open: http://localhost:8123/pages/blog.html"
Write-Host "Open: http://localhost:8123/pages/projects.html"
python -m http.server 8123
