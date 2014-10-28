param (
	[string]$srcRoot,
	[string]$buildDirName,
	[string]$args
)

Write-Verbose 'Entering CMake.ps1'
Write-Verbose "srcRoot = $srcRoot"
Write-Verbose "buildDirName = $buildDirName"
Write-Verbose "args = $args"

if(!$srcRoot)
{
    throw "srcRoot parameter is not set"
}

if(!(Test-Path $srcRoot -PathType Container))
{
    throw "srcRoot does not exist"
}

try
{
	$cmake = Get-Command cmake.exe
}
catch
{
	throw 'Unable to find cmake.exe'
}

Set-Location $srcRoot

$buildPath = Join-Path -Path $srcRoot -ChildPath $buildDirName

if(!(Test-Path $buildPath -PathType Container))
{
    New-Item -Path $buildPath -ItemType Container
}

Set-Location $buildPath

# Import the Task.Common dll that has all the cmdlets we need for Build
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"

Write-Output "Building from $buildPath"
Write-Output "Generating Files"

Invoke-Tool -Path $cmake.Source -Arguments $srcRoot -WorkingFolder $buildPath

if($args)
{
    $args = "--build $args $buildPath"
}
else
{
    $args = "--build $buildPath"
}

Invoke-Tool -Path $cmake.Source -Arguments $args -WorkingFolder $buildPath

Write-Verbose "Leaving script CMake.ps1"




