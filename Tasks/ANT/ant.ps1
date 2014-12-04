param (
	[string]$cwd,
	[string]$options,
	[string]$targets
)

Write-Verbose 'Entering Ant.ps1'
Write-Verbose "cwd = $cwd"
Write-Verbose "options = $options"
Write-Verbose "targets = $targets"

#Verify Ant is installed correctly
try
{
	$ant = Get-Command Ant
	$antPath = $ant.Path
	Write-Verbose "Found Ant at $antPath"
}
catch
{
	throw 'Unable to find Ant. Verify it is installed correctly on the build agent: http://ant.apache.org/manual/install.html.'
}

# Find Working Directory to run Ant in
if(!$cwd)
{
    throw "Working Directory is not set"
}

if(!(Test-Path $cwd -PathType Container))
{
	throw "Working Directory $cwd does not exist or is not a valid directory"
}

Write-Verbose "Setting Working Directory to $cwd"
Set-Location $cwd

$antArguments = $options + ' ' + $targets
Write-Verbose "Using Ant arguments $antArguments"

# Import the Task.Common dll that has all the cmdlets we need for Build
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"

Write-Verbose "Running Ant..."
Invoke-Tool -Path $ant.Path -Arguments $antArguments -WorkingFolder $cwd

Write-Verbose "Leaving script Ant.ps1"




