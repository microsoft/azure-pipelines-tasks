param(
    [string]$vsLocation, 
    [string]$vsVersion,
    [string]$msbuildLocation,
    [string]$msbuildVersion,
    [string]$msbuildArchitecture,
    [string]$msbuildArgs, 
    [string]$solution, 
    [string]$platform,
    [string]$configuration,
    [string]$clean,
    [string]$restoreNugetPackages,
    [string]$logProjectEvents
)

Write-Verbose "Entering script VSBuild.ps1"
Write-Verbose "vsLocation = $vsLocation"
Write-Verbose "msbuildLocation = $msbuildLocation"
Write-Verbose "msbuildVersion = $msbuildVersion"
Write-Verbose "msbuildArchitecture = $msbuildArchitecture"
Write-Verbose "msbuildArgs = $msbuildArgs"
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
    Write-Verbose "Pattern found in solution parameter."
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

$args = $msbuildArgs;
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

if (!$vsLocation)
{
    Write-Verbose "Finding Visual Studio install location"
    if($vsVersion -eq "latest" -or $vsVersion -eq $null)
    {
        $vsLocation = Get-VisualStudioPath
    }
    else 
    {
        $vsLocation = Get-VisualStudioPath -Version $vsVersion
    }
}

$scriptName = "VsDevCmd.bat"
$scriptLocation = [System.IO.Path]::Combine($vsLocation, "Common7\Tools", $scriptName)
Write-Verbose "scriptLocation = $scriptLocation"

if ([System.IO.File]::Exists($scriptLocation))
{
    Write-Verbose "Invoking script $scriptLocation with AllowScriptToChangeEnvironment flag"
    Invoke-BatchScript $scriptLocation -AllowScriptToChangeEnvironment
}
else
{
    Write-Warning (Get-LocalizedString -Key "Unable to find script {0}" -ArgumentList $scriptLocation)
}

if(!$msBuildLocation)
{
    if(Get-Command -Name "Get-MSBuildLocation" -ErrorAction SilentlyContinue)
    {
        if($msbuildVersion -eq "latest")
        {
            $msbuildVersion = $null
        }
        $msBuildLocation = Get-MSBuildLocation -version $msbuildVersion -architecture $msbuildArchitecture
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
    Write-Warning (Get-LocalizedString -Key "Unable to locate nuget.exe. Package restore will not be performed for the solutions")
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

Write-Verbose "Leaving script VSBuild.ps1"
