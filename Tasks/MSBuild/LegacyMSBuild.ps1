[cmdletbinding()]
param(
    [string]$MSBuildLocationMethod,
    [string]$MSBuildLocation, 
    [string]$MSBuildArguments, 
    [string]$Solution, 
    [string]$Platform,
    [string]$Configuration,
    [string]$Clean,
    [string]$RestoreNuGetPackages,
    [string]$LogProjectEvents,
    [string]$MSBuildVersion,
    [string]$MSBuildArchitecture,
    [Parameter(ValueFromRemainingArguments = $true)]
    [object[]]$RemainingArguments)

Write-Verbose "Entering script MSBuild.ps1"
Write-Verbose "MSBuildLocationMethod = $MSBuildLocationMethod"
Write-Verbose "MSBuildLocation = $MSBuildLocation"
Write-Verbose "MSBuildArguments = $MSBuildArguments"
Write-Verbose "Solution = $Solution"
Write-Verbose "Platform = $Platform"
Write-Verbose "Configuration = $Configuration"
Write-Verbose "Clean = $Clean"
Write-Verbose "RestoreNuGetPackages = $RestoreNuGetPackages"
Write-Verbose "LogProjectEvents = $LogProjectEvents"
Write-Verbose "MSBuildVersion = $MSBuildVersion"
Write-Verbose "MSBuildArchitecture = $MSBuildArchitecture"
$OFS = " "
Write-Verbose "RemainingArguments = $RemainingArguments"

# Import the Task.Common and Task.Internal dll that has all the cmdlets we need for Build
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"

. $PSScriptRoot\LegacyHelpers.ps1

# Parse Booleans. Convert-String should be removed or renamed. It conflicts
# with Microsoft.PowerShell.Utility\Convert-String in PowerShell 5.
[bool]$RestoreNuGetPackages = Convert-String $RestoreNuGetPackages Boolean
Write-Verbose "RestoreNuGetPackages (converted) = $RestoreNuGetPackages"
[bool]$LogProjectEvents = Convert-String $LogProjectEvents Boolean
Write-Verbose "LogProjectEvents (converted) = $LogProjectEvents"
[bool]$Clean = Convert-String $Clean Boolean
Write-Verbose "Clean (converted) = $Clean"

$solutionFiles = Get-SolutionFiles -Solution $Solution
$MSBuildArguments = Format-MSBuildArguments -MSBuildArguments $MSBuildArguments -Platform $Platform -Configuration $Configuration
$MSBuildLocation = Select-MSBuildLocation -Method $MSBuildLocationMethod -Location $MSBuildLocation -Version $MSBuildVersion -Architecture $MSBuildArchitecture
Invoke-BuildTools -NuGetRestore:$RestoreNuGetPackages -SolutionFiles $solutionFiles -MSBuildLocation $MSBuildLocation -MSBuildArguments $MSBuildArguments -Clean:$Clean -NoTimelineLogger:(!$LogProjectEvents)
Write-Verbose "Leaving script MSBuild.ps1"
