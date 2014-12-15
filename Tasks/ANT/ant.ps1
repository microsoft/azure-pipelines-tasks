param (
	[string]$antBuildFile,
	[string]$cwd,
	[string]$options,
	[string]$targets
)

Write-Verbose 'Entering Ant.ps1'
Write-Verbose "antBuildFile = $antBuildFile"
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

#Verify Ant build file is specified
if(!$antBuildFile)
{
    throw "Ant build file is not specified"
}
if(!(Test-Path $antBuildFile -PathType Leaf))
{
	throw "Ant build file '$antBuildFile' does not exist or is not a valid file"
}


# Find Working directory to run Ant in. cwd is optional, we use directory of Ant build file as Working directory if not set.
if(!$cwd)
{
    $antBuildFileItem = Get-Item -Path $antBuildFile
	$cwd = $antBuildFileItem.Directory.FullName
}
if(!(Test-Path $cwd -PathType Container))
{
	throw "Working directory '$cwd' does not exist or is not a valid directory"
}

$antArguments = "-buildfile ""$antBuildFile"" $options $targets"
Write-Verbose "Using Ant arguments $antArguments"

# Import the Task.Common dll that has all the cmdlets we need for Build
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"

Write-Verbose "Running Ant..."
Invoke-Tool -Path $ant.Path -Arguments $antArguments -WorkingFolder $cwd

Write-Verbose "Leaving script Ant.ps1"




