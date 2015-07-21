param (
	[string]$cwd,
	[string]$cmakeArgs
)

Write-Verbose 'Entering CMake.ps1'
Write-Verbose "cwd = $cwd"
Write-Verbose "cmakeArgs = $cmakeArgs"

# Import the Task.Common dll that has all the cmdlets we need for Build
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"

if(!$cwd)
{
    throw (Get-LocalizedString -Key "Working directory parameter is not set")
}

if(!(Test-Path $cwd -PathType Container))
{
	Write-Verbose "Creating directory $cwd"
    New-Item -Path $cwd -ItemType Container
}

# Force Get-Command errors to be "terminating" errors. Otherwise, control
# will not transfer to the catch block.
$defaultErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = 'Stop'
try
{
	$cmake = Get-Command cmake.exe
	Write-Verbose ('Using {0}' -f $cmake.Path)
}
catch
{
	throw (Get-LocalizedString -Key 'Unable to find {0}' -ArgumentList 'cmake.exe')
}
finally
{
    $ErrorActionPreference = $defaultErrorActionPreference
}

Write-Verbose "Setting working directory to $cwd"
Set-Location $cwd


# Import the Task.Internal dll that has all the cmdlets we need for Build
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"

Write-Verbose "Running CMake..."
Invoke-Tool -Path $cmake.Path -Arguments $cmakeArgs -WorkingFolder $cwd

Write-Verbose "Leaving script CMake.ps1"




