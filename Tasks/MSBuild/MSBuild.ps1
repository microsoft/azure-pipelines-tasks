param(
    [string]$msbuildLocation, 
    [string]$msbuildArguments, 
    [string]$solution, 
    [string]$platform,
    [string]$configuration,
    [string]$clean,
    [string]$restoreNugetPackages,
    [string]$logProjectEvents,
    [string]$msbuildVersion,
    [string]$msbuildArchitecture
)

Write-Verbose "Entering script MSBuild.ps1"
Write-Verbose "msbuildLocation = $msbuildLocation"
Write-Verbose "msbuildArguments = $msbuildArguments"
Write-Verbose "solution = $solution"
Write-Verbose "platform = $platform"
Write-Verbose "configuration = $configuration"
Write-Verbose "clean = $clean"
Write-Verbose "restoreNugetPackages = $restoreNugetPackages"
Write-Verbose "logProjectEvents = $logProjectEvents"

# Import the Task.Common and Task.Internal dll that has all the cmdlets we need for Build
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"

if (!$solution)
{
    throw (Get-LocalizedString -Key "Solution parameter not set on script")
}

$nugetRestore = Convert-String $restoreNugetPackages Boolean
Write-Verbose "nugetRestore (converted) = $nugetRestore"
$logEvents = Convert-String $logProjectEvents Boolean
Write-Verbose "logEvents (converted) = $logEvents"
$noTimelineLogger = !$logEvents
Write-Verbose "noTimelineLogger = $noTimelineLogger"
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
    throw (Get-LocalizedString -Key "No solution was found using search pattern '{0}'." -ArgumentList $solution)
}

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

if(!$msBuildLocation)
{
    if(Get-Command -Name "Get-MSBuildLocation" -ErrorAction SilentlyContinue)
    {
        if($msbuildVersion -eq "latest")
        {
            # null out $msBuildVersion before passing to cmdlet so it will default to the latest on teh machine.
            $msBuildVersion = $null
        }
            
        $msBuildLocation = Get-MSBuildLocation -Version $msbuildVersion -Architecture $msbuildArchitecture
    }  
}

if ($cleanBuild)
{
    foreach ($sf in $solutionFiles)  
    {
        Invoke-MSBuild $sf -Targets Clean -LogFile "$sf-clean.log" -ToolLocation $msBuildLocation -CommandLineArgs $args -NoTimelineLogger:$noTimelineLogger
    }
}

$nugetPath = Get-ToolPath -Name 'NuGet.exe'
if (-not $nugetPath -and $nugetRestore)
{
    Write-Warning (Get-LocalizedString -Key "Unable to locate {0}. Package restore will not be performed for the solutions" -ArgumentList 'nuget.exe')
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

    Invoke-MSBuild $sf -LogFile "$sf.log" -ToolLocation $msBuildLocation -CommandLineArgs $args  -NoTimelineLogger:$noTimelineLogger
}

Write-Verbose "Leaving script MSBuild.ps1"
