[cmdletbinding()]
param(
    [string]$VSLocation, # Support for vsLocation has been deprecated.
    [string]$VSVersion,
    [string]$MSBuildLocation, # Support for msBuildLocation has been deprecated.
    [string]$MSBuildVersion, # Support for msBuildVersion has been deprecated.
    [string]$MSBuildArchitecture,
    [string]$MSBuildArgs,
    [string]$Solution,
    [string]$Platform,
    [string]$Configuration,
    [string]$Clean,
    [string]$RestoreNugetPackages,
    [string]$LogProjectEvents,
    [string]$OmitDotSource)

Write-Verbose "Entering script VSBuild.ps1"
Write-Verbose "VSLocation = $VSLocation"
Write-Verbose "VSVersion = $VSVersion"
Write-Verbose "MSBuildLocation = $MSBuildLocation"
Write-Verbose "MSBuildVersion = $MSBuildVersion"
Write-Verbose "MSBuildArchitecture = $MSBuildArchitecture"
Write-Verbose "MSBuildArgs = $MSBuildArgs"
Write-Verbose "Solution = $Solution"
Write-Verbose "Platform = $Platform"
Write-Verbose "Configuration = $Configuration"
Write-Verbose "Clean = $Clean"
Write-Verbose "RestoreNugetPackages = $RestoreNugetPackages"
Write-Verbose "LogProjectEvents = $LogProjectEvents"

# Import the Task.Common and Task.Internal dll that has all the cmdlets we need for Build
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"

if (!$OmitDotSource) {
    . $PSScriptRoot\Helpers.ps1
}

if (!$Solution) {
    throw (Get-LocalizedString -Key "Solution parameter not set on script")
}

# Parse Booleans. Convert-String should be removed or renamed. It conflicts
# with Microsoft.PowerShell.Utility\Convert-String in PowerShell 5.
[bool]$RestoreNugetPackages = Convert-String $RestoreNugetPackages Boolean
Write-Verbose "RestoreNugetPackages (converted) = $RestoreNugetPackages"
[bool]$LogProjectEvents = Convert-String $LogProjectEvents Boolean
Write-Verbose "LogProjectEvents (converted) = $LogProjectEvents"
[bool]$Clean = Convert-String $Clean Boolean
Write-Verbose "Clean (converted) = $Clean"


# Warn if deprecated parameters were supplied.
if ($VSLocation) {
    Write-Warning (Get-LocalizedString -Key 'The Visual Studio location parameter has been deprecated. Ignoring value: {0}' -ArgumentList $VSLocation)
    $VSLocation = $null
}

if ($MSBuildLocation) {
    Write-Warning (Get-LocalizedString -Key 'The MSBuild location parameter has been deprecated. Ignoring value: {0}' -ArgumentList $MSBuildLocation)
    $MSBuildLocation = $null
}

if ($MSBuildVersion) {
    Write-Warning (Get-LocalizedString -Key 'The MSBuild version parameter has been deprecated. Ignoring value: {0}' -ArgumentList $MSBuildVersion)
    $MSBuildVersion = $null
}

$solutionFiles = Get-SolutionFiles -Solution $Solution
$VSVersion = Select-VSVersion -PreferredVersion $VSVersion
$MSBuildLocation = Select-MSBuildLocation -VSVersion $VSVersion -Architecture $MSBuildArchitecture
$MSBuildArgs = Format-MSBuildArguments -MSBuildArguments $MSBuildArgs -Platform $Platform -Configuration $Configuration -VSVersion $VSVersion
Invoke-BuildTools -NuGetRestore:$RestoreNuGetPackages -SolutionFiles $solutionFiles -MSBuildLocation $MSBuildLocation -MSBuildArguments $MSBuildArgs -Clean:$Clean -NoTimelineLogger:(!$LogProjectEvents)
Write-Verbose "Leaving script VSBuild.ps1"
