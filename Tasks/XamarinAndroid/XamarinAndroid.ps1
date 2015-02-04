param(
    [string]$project, 
    [string]$target, 
    [string]$package,
    [string]$configuration,
    [string]$outputDir,
    [string]$msbuildLocation, 
    [string]$msbuildArguments 
)

Write-Verbose "Entering script XamarinAndroid.ps1"
Write-Verbose "project = $project"
Write-Verbose "target = $target"
Write-Verbose "package = $package"
Write-Verbose "configuration = $configuration"
Write-Verbose "outputDir = $outputDir"
Write-Verbose "msbuildLocation = $msbuildLocation"
Write-Verbose "msbuildArguments = $msbuildArguments"

# Import the Task.Common dll that has all the cmdlets we need for Build
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"

$packageForAndroid = Convert-String $package Boolean
Write-Verbose "package (converted) = $packageForAndroid"

if (!$project)
{
    throw "project parameter not set on script"
}

# check for project pattern
if ($project.Contains("*") -or $project.Contains("?"))
{
    Write-Verbose "Pattern found in solution parameter. Calling Find-Files."
    Write-Verbose "Find-Files -SearchPattern $project"
    $projectFiles = Find-Files -SearchPattern $project
    Write-Verbose "projectFiles = $projectFiles"
}
else
{
    Write-Verbose "No Pattern found in project parameter."
    $projectFiles = ,$project
}

if (!$projectFiles)
{
    throw "No project with search pattern '$project' was found."
}

# construct build parameters
$timeline = Start-Timeline -Context $distributedTaskContext

$args = $msbuildArguments;

if ($configuration)
{
    Write-Verbose "adding configuration: $configuration"
    $args = "$args /p:configuration=$configuration"
}

if ($target)
{
    Write-Verbose "adding target: $target"
    $args = "$args /t:$target"
}

if ($packageForAndroid)
{
    Write-Verbose "adding target: PackageForAndroid"
    $args = "$args /t:PackageForAndroid"
}

if ($outputDir) 
{
    Write-Verbose "adding OutputPath: $outputDir"
    $args = "$args /p:OutputPath=$outputDir"
}

Write-Verbose "args = $args"

# build each project file
foreach ($pf in $projectFiles)
{
    Invoke-MSBuild $pf -Timeline $timeline -LogFile "$pf.log" -ToolLocation $msBuildLocation -CommandLineArgs $args
}

Write-Verbose "Leaving script XamarinAndroid.ps1"
