param(
    [string]$msbuildLocation, 
    [string]$msbuildArguments, 
    [string]$solution, 
    [string]$platform,
    [string]$configuration,
    [string]$clean,
    [string]$restoreNugetPackages
)


Write-Verbose "Entering script MSBuild.ps1"
Write-Verbose "msbuildLocation = $msbuildLocation"
Write-Verbose "msbuildArguments = $msbuildArguments"
Write-Verbose "solution = $solution"
Write-Verbose "platform = $platform"
Write-Verbose "configuration = $configuration"
Write-Verbose "clean = $clean"
Write-Verbose "restoreNugetPackages = $restoreNugetPackages"

# Import the Task.Common dll that has all the cmdlets we need for Build
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"

if (!$solution)
{
    throw "solution parameter not set on script"
}

$nugetRestore = Convert-String $restoreNugetPackages Boolean
Write-Verbose "nugetRestore (converted) = $nugetRestore"
$cleanBuild = Convert-String $clean Boolean
Write-Verbose "clean (converted) = $cleanBuild"

# check for solution pattern
if ($solution.Contains("*") -or $solution.Contains("?"))
{
    Write-Verbose "Pattern found in solution parameter. Calling Find-Files."
    Write-Verbose "Find-Files -SearchPattern $solution"
    $solutionFiles = Find-Files -SearchPattern $solution
    Write-Verbose "solutionFiles = $solutionFiles"
}
else
{
    Write-Verbose "No Pattern found in solution parameter."
    $solutionFiles = ,$solution
}

if (!$solutionFiles)
{
    throw "No solution with search pattern '$solution' was found."
}

$timeline = Start-Timeline -Context $distributedTaskContext

$args = $msbuildArguments;
if ($platform)
{
    Write-Verbose "adding platform: $platform"
    $args = "$args /p:platform=`"$platform`""
}

if ($configuration)
{
    Write-Verbose "adding configuration: $configuration"
    $args = "$args /p:configuration=`"$configuration`""
}

Write-Verbose "args = $args"

if ($cleanBuild)
{
    foreach ($sf in $solutionFiles)  
    {
        Invoke-MSBuild $sf -Timeline $timeline -Targets Clean -LogFile "$sf-clean.log" -ToolLocation $msBuildLocation -CommandLineArgs $args
    }
}

$nugetPath = Get-ToolPath -Name 'NuGet.exe'
if (-not $nugetPath)
{
    Write-Warning "Unable to locate nuget.exe. Package restore will not be performed for the solutions"
}

foreach ($sf in $solutionFiles)
{
    if ($nugetPath -and $nugetRestore)
    {
        $slnFolder = $(Get-ItemProperty -Path $sf -Name 'DirectoryName').DirectoryName

        Write-Verbose "Searching for nuget package configuration files using pattern $slnFolder\**\packages.config"
        $pkgConfig = Find-Files -SearchPattern "$slnFolder\**\packages.config"
        if ($pkgConfig)
        {
            Write-Verbose "Running nuget package restore for $slnFolder"
            Invoke-Tool -Path $nugetPath -Arguments "restore `"$sf`" -NonInteractive" -WorkingFolder $slnFolder
        }
        else
        {
            Write-Verbose "No nuget package configuration files found for $sf"
        }
    }

    Invoke-MSBuild $sf -Timeline $timeline -LogFile "$sf.log" -ToolLocation $msBuildLocation -CommandLineArgs $args
}

Write-Verbose "Leaving script MSBuild.ps1"
