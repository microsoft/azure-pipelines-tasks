Param(
    [string]$script,
    [string]$target,
    [string]$verbosity,
    [string]$arguments
)

Write-Verbose "Entering script $MyInvocation.MyCommand.Name"
Write-Verbose "Parameter Values"
foreach($key in $PSBoundParameters.Keys)
{
    Write-Verbose ($key + ' = ' + $PSBoundParameters[$key])
}

import-module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"

$repositoryPath = $env:BUILD_REPOSITORY_LOCALPATH;
$toolsPath = Join-Path $repositoryPath "tools";
$packagePath = Join-Path $toolsPath "packages.config";
$cakePath = Join-Path $toolsPath "Cake/Cake.exe";

$nuGetPath = Get-ToolPath -Name 'NuGet.exe';
if (!(Test-Path $nuGetPath)) {
  Throw "Could not locate NuGet.exe"
}

# Check if there's a tools directory.
if (!(Test-Path $toolsPath)) {
    Write-Verbose -Message "Creating tools directory..."
    New-Item -Path $toolsPath -Type directory | out-null;
    if (!(Test-Path $toolsPath)) {
        Throw "Could not create tools directory."
    }
}

# Install prereqs from NuGet.
Push-Location
Set-Location $toolsPath
if ((Test-Path $packagePath)) {
  # Install tools in packages.config.
  Invoke-Expression "$nuGetPath install -ExcludeVersion"
}
if (!(Test-Path $cakePath)) {
  # Install Cake if not part of packages.config.
  Invoke-Expression "$nuGetPath install Cake -ExcludeVersion"
}
Pop-Location

# Make sure that Cake has been installed.
if (!(Test-Path $cakePath)) {
    Throw "Could not find Cake.exe"
}

# Start Cake
Invoke-Expression "$cakePath `"$script`" -target=`"$target`" -verbosity=`"$verbosity`" $arguments"
exit $LASTEXITCODE
