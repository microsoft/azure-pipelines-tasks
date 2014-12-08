param(
    [string]$wrapperScript,   # Path to gradle wrapper. 
    [string]$cwd,             # Optional - Root directory of gradle project. Defaults to folder of gradle wrapper.
    [string]$options,         # Gradle options
    [string]$tasks            # Gradle tasks
)

Write-Verbose "Entering script Gradle.ps1"
Write-Verbose "wrapperScript = $wrapperScript"
Write-Verbose "options = $options"
Write-Verbose "tasks = $tasks"

# Import the Task.Common dll that has all the cmdlets we need for Build
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"

# Verify wrapperScript is set and is not a container
if(!$wrapperScript -or !(Test-Path -Path $wrapperScript -PathType Leaf)) 
{
    throw "Please specify the Gradle wrapper script."
}

# Find working directory. cwd is optional, we use directory of wrapper as working directory if not set.
if(!$cwd)
{
    $wrapperScriptItem = Get-Item -Path $wrapperScript
    $cwd = $wrapperScriptItem.Directory.FullName
}

Write-Verbose "Setting working directory to $cwd"
Push-Location $cwd

$arguments = "$options $tasks"
Write-Verbose "Invoking Gradle wrapper $wrapperScript $arguments"
Invoke-BatchScript -Path $wrapperScript -Arguments $arguments

Pop-Location
Write-Verbose "Leaving script Gradle.ps1"
