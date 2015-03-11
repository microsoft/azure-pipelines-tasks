param (
    [string]$mavenPOMFile,
    [string]$cwd,
    [string]$options,
    [string]$goals,
    [string]$jdkVersion,
    [string]$jdkArchitecture
)

Write-Verbose 'Entering Maven.ps1'
Write-Verbose "mavenPOMFile = $mavenPOMFile"
Write-Verbose "cwd = $cwd"
Write-Verbose "options = $options"
Write-Verbose "goals = $goals"
Write-Verbose "jdkVersion = $jdkVersion"
Write-Verbose "jdkArchitecture = $jdkArchitecture"

#Verify Maven is installed correctly
try
{
    $maven = Get-Command mvn
    $mavenPath = $maven.Path
    Write-Verbose "Found Maven at $mavenPath"
}
catch
{
    throw 'Unable to find Maven. Verify it is installed correctly on the build agent: http://maven.apache.org/download.cgi.'
}

#Verify Maven POM file is specified
if(!$mavenPOMFile)
{
    throw "Maven POM file is not specified"
}
if(!(Test-Path $mavenPOMFile -PathType Leaf))
{
    throw "Maven POM file '$mavenPOMFile' does not exist or is not a valid file"
}


# Find Working directory to run Maven in. cwd is optional, we use directory of Maven POM file as Working directory if not set.
if(!$cwd)
{
    $mavenPOMFileItem = Get-Item -Path $mavenPOMFile
    $cwd = $mavenPomFileItem.Directory.FullName
}
if(!(Test-Path $cwd -PathType Container))
{
    throw "Working directory '$cwd' does not exist or is not a valid directory"
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

$mavenArguments = "-f ""$mavenPOMFile"" $options $goals"
Write-Verbose "Using Maven arguments $mavenArguments"

Write-Verbose "Running Maven..."
Invoke-Tool -Path $maven.Path -Arguments $mavenArguments -WorkingFolder $cwd

Write-Verbose "Leaving script Maven.ps1"




