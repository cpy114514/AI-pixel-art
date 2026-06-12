$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$launcherProject = Join-Path $projectRoot "launcher\windows\AiPixelArtLauncher.csproj"
$publishDir = Join-Path $projectRoot "launcher\windows\publish"
$exeSource = Join-Path $publishDir "AI Pixel Art.exe"
$rootExe = Join-Path $projectRoot "AI Pixel Art.exe"
$releaseExe = Join-Path $projectRoot "release\AI Pixel Art.exe"

dotnet publish $launcherProject -c Release -r win-x64 -o $publishDir /p:PublishSingleFile=true /p:SelfContained=true

Copy-Item -LiteralPath $exeSource -Destination $rootExe -Force
Copy-Item -LiteralPath $exeSource -Destination $releaseExe -Force

Write-Host "Built $releaseExe"
