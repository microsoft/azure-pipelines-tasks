param(
    [Parameter(Mandatory = $true)]
    [string]$ApiKey
)

# Install newest version of powershell management api
Install-Module -Name Microsoft.PowerShell.PSResourceGet

$makePath = Join-Path $PSScriptRoot 'make.js'
& node $makePath build

$buildPath = Join-Path $PSScriptRoot '_build'
$moduleBuildPath = Join-Path $buildPath "VstsTaskSdk"

$publishOptions = @{
    Path       = $moduleBuildPath
    ApiKey     = $ApiKey
    Repository = 'PSGallery'
    Verbose    = $true
}
Publish-PSResource @publishOptions
