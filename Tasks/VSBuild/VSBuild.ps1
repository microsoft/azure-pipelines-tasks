param(
    [string]$vsLocation, # Support for vsLocation has been deprecated.
    [string]$vsVersion,
    [string]$msBuildLocation, # Support for msBuildLocation has been deprecated.
    [string]$msBuildVersion, # Support for msBuildVersion has been deprecated.
    [string]$msBuildArchitecture,
    [string]$msBuildArgs,
    [string]$solution, 
    [string]$platform,
    [string]$configuration,
    [string]$clean,
    [string]$restoreNugetPackages,
    [string]$logProjectEvents
)

Write-Verbose "Entering script VSBuild.ps1"
Write-Verbose "vsLocation = $vsLocation"
Write-Verbose "vsVersion = $vsVersion"
Write-Verbose "msBuildLocation = $msBuildLocation"
Write-Verbose "msBuildVersion = $msBuildVersion"
Write-Verbose "msBuildArchitecture = $msBuildArchitecture"
Write-Verbose "msBuildArgs = $msBuildArgs"
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

# Warn if deprecated parameters were supplied.
if ($vsLocation)
{
    Write-Warning (Get-LocalizedString -Key 'The Visual Studio location parameter has been deprecated. Ignoring value: {0}' -ArgumentList $vsLocation)
    $vsLocation = $null
}

if ($msBuildLocation)
{
    Write-Warning (Get-LocalizedString -Key 'The MSBuild location parameter has been deprecated. Ignoring value: {0}' -ArgumentList $msBuildLocation)
    $msBuildLocation = $null
}

if ($msBuildVersion)
{
    Write-Warning (Get-LocalizedString -Key 'The MSBuild version parameter has been deprecated. Ignoring value: {0}' -ArgumentList $msBuildVersion)
    $msBuildVersion = $null
}

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

# Look for a specific version of Visual Studio.
$vsLocation = $null
if ($vsVersion -and "$vsVersion".ToUpperInvariant() -ne 'LATEST')
{
    Write-Verbose "Searching for Visual Studio version: $vsVersion"
    $vsLocation = Get-VisualStudioPath -Version $vsVersion

    # Warn if not found.
    if (!$vsLocation)
    {
        Write-Warning (Get-LocalizedString -Key 'Visual Studio not found: Version = {0}. Looking for the latest version.' -ArgumentList $vsVersion)
    }
}

# Look for the latest version of Visual Studio.
if (!$vsLocation)
{
    Write-Verbose 'Searching for the latest Visual Studio version.'
    [string[]]$vsVersions = '14.0', '12.0', '11.0', '10.0' | where { $_ -ne $vsVersion }
    foreach ($vsVersion in $vsVersions)
    {
        # Look for the specific version.
        Write-Verbose "Searching for Visual Studio version: $vsVersion"
        $vsLocation = Get-VisualStudioPath -Version $vsVersion

        # Break if found.
        if ($vsLocation)
        {
            break;
        }
    }

    # Null out the version info and warn if not found.
    if (!$vsLocation)
    {
        $vsVersion = $null
        Write-Warning (Get-LocalizedString -Key 'Visual Studio not found. Try installing a supported version of Visual Studio. See the task definition for a list of supported versions.')
    }
}

# Log the Visual Studio info.
Write-Verbose ('vsVersion = {0}' -f $vsVersion)
Write-Verbose ('vsLocation = {0}' -f $vsLocation)

# Determine which MSBuild version to use.
$msBuildVersion = $null;
if ($vsLocation)
{
    switch ($vsVersion)
    {
        '14.0' { $msBuildVersion = '14.0' }
        '12.0' { $msBuildVersion = '12.0' }
        '11.0' { $msBuildVersion = '4.0' }
        '10.0' { $msBuildVersion = '4.0' }
        default { throw (Get-LocalizedString -Key "Unexpected Visual Studio version '{0}'." -ArgumentList $vsVersion) }
    }
}

Write-Verbose "msBuildVersion = $msBuildVersion"

# Find the MSBuild location.
Write-Verbose "Finding MSBuild location."
$msBuildLocation = Get-MSBuildLocation -Version $msBuildVersion -Architecture $msBuildArchitecture
if (!$msBuildLocation)
{
    # Not found. Throw.
    throw (Get-LocalizedString -Key 'MSBuild not found: Version = {0}, Architecture = {1}' -ArgumentList $msBuildVersion, $msBuildArchitecture)
}

Write-Verbose "msBuildLocation = $msBuildLocation"

# Append additional information to the MSBuild args.
$args = $msBuildArgs;
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

if ($vsLocation)
{
    Write-Verbose ('adding VisualStudioVersion: {0}' -f $vsVersion)
    $args = ('{0} /p:VisualStudioVersion="{1}"' -f $args, $vsVersion)
}

Write-Verbose "args = $args"

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
        Write-Verbose "Running nuget package restore for $slnFolder"
        Invoke-Tool -Path $nugetPath -Arguments "restore `"$sf`" -NonInteractive" -WorkingFolder $slnFolder
    }

    if ($cleanBuild)
    {
        Invoke-MSBuild $sf -Targets Clean -LogFile "$sf-clean.log" -ToolLocation $msBuildLocation -CommandLineArgs $args -NoTimelineLogger:$noTimelineLogger
    }

    Invoke-MSBuild $sf -LogFile "$sf.log" -ToolLocation $msBuildLocation -CommandLineArgs $args  -NoTimelineLogger:$noTimelineLogger
}

Write-Verbose "Leaving script VSBuild.ps1"
