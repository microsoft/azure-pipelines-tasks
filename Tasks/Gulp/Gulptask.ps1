param(
    [string]$gulpFile,
    [string]$targets,
    [string]$arguments,
    [string]$cwd
)

# Import the Task.Common dll that has all the cmdlets we need for Build
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"

# Add node_modules\.bin to path 
$buildSourcesDirectory = Get-Variable -Context $distributedTaskContext -Name "Build.SourcesDirectory"
$nodeBinPath = Join-Path -Path $buildSourcesDirectory -ChildPath 'node_modules\.bin'
$env:PATH = $env:PATH + ';' + $nodeBinPath

if($cwd)
{
    Write-Verbose "Setting working directory to $cwd"
    Set-Location $cwd
}
else
{
    $location = Get-Location
    $cwd = $location.Path
}

try
{
    $gulp = Get-Command -Name gulp
    Write-Verbose "Using $gulp.Source"
}
catch
{
    throw 'Unable to file Gulp in path.'
}

Write-Verbose 'Running Gulp'
Invoke-Tool -Path $gulp.Source -Arguments $arguments -WorkingFolder $cwd




