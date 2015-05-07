param (
	[string]$cwd,
	[string]$args
)

Write-Verbose 'Entering CMake.ps1'
Write-Verbose "cwd = $cwd"
Write-Verbose "args = $args"

if(!$cwd)
{
    throw "cwd parameter is not set"
}

if(!(Test-Path $cwd -PathType Container))
{
	Write-Verbose "Creating directory $cwd"
    New-Item -Path $cwd -ItemType Container
}

try
{
	$cmake = Get-Command cmake.exe
	Write-Verbose "Using $cmake.Source"
}
catch
{
	throw 'Unable to find cmake.exe'
}

Write-Verbose "Setting working directory to $cwd"
Set-Location $cwd


# Import the Task.Internal dll that has all the cmdlets we need for Build
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"

Write-Verbose "Running CMake..."
Invoke-Tool -Path $cmake.Source -Arguments $args -WorkingFolder $buildPath

Write-Verbose "Leaving script CMake.ps1"




