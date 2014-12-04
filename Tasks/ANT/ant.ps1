param (
	[string]$cwd,
	[string]$options,
	[string]$targets
)

Write-Verbose 'Entering ant.ps1'
Write-Verbose "cwd = $cwd"
Write-Verbose "options = $options"
Write-Verbose "targets = $targets"

#Verify ant is installed correctly
try
{
	$ant = Get-Command ant
	$antPath = $ant.Path
	Write-Verbose "Found ANT at $antPath"
}
catch
{
	throw 'Unable to find ANT, verify it is installed correctly, ANT_HOME is set and ANT_HOME\bin is added to the PATH on the build agent'
}

# Find working directory to run ANT in
if(!$cwd)
{
    throw "Working Directory is not set"
}

if(!(Test-Path $cwd -PathType Container))
{
	Write-Verbose "Creating directory $cwd"
    New-Item -Path $cwd -ItemType Container
}

Write-Verbose "Setting Working Directory to $cwd"
Set-Location $cwd

$antArguments = $options + ' ' + $targets
Write-Verbose "Using ANT arguments $antArguments"

# Import the Task.Common dll that has all the cmdlets we need for Build
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"

Write-Verbose "Running Ant..."
Invoke-Tool -Path $ant.Path -Arguments $antArguments -WorkingFolder $cwd

Write-Verbose "Leaving script Ant.ps1"




