param (
    [string]$antBuildFile,
    [string]$options,
    [string]$targets,
    [string]$jdkVersion,
    [string]$jdkArchitecture
)

Write-Verbose 'Entering Ant.ps1'
Write-Verbose "antBuildFile = $antBuildFile"
Write-Verbose "options = $options"
Write-Verbose "targets = $targets"
Write-Verbose "jdkVersion = $jdkVersion"
Write-Verbose "jdkArchitecture = $jdkArchitecture"

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

# Import the Task.Common dll that has all the cmdlets we need for Build
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"

if($jdkVersion -and $jdkVersion -ne "default")
{
    $jdkPath = Get-JavaDevelopmentKitPath -Version $jdkVersion -Arch $jdkArchitecture
    if (!$jdkPath) 
    {
        throw "Could not find JDK $jdkVersion $jdkArchitecture, please make sure the selected JDK is installed properly"
    }

    Write-Host "Setting JAVA_HOME to $jdkPath"
    $env:JAVA_HOME = $jdkPath
    Write-Verbose "JAVA_HOME set to $env:JAVA_HOME"
}

Write-Verbose "Creating a new timeline for logging events"
$timeline = Start-Timeline -Context $distributedTaskContext

Write-Verbose "Running Ant..."
Invoke-Ant -AntBuildFile $antBuildFile -Options $options -Targets $targets -ToolLocation $ant.Path -Timeline $timeline

Write-Verbose "Leaving script Ant.ps1"




