[CmdletBinding()]
param()

Trace-VstsEnteringInvocation $MyInvocation
try {
    Import-VstsLocStrings "$PSScriptRoot\Task.json"
    [string]$msBuildLocationMethod = Get-VstsInput -Name MSBuildLocationMethod
    [string]$msBuildLocation = Get-VstsInput -Name MSBuildLocation
    [string]$msBuildArguments = Get-VstsInput -Name MSBuildArguments
    [string]$solution = Get-VstsInput -Name Solution -Require
    [string]$platform = Get-VstsInput -Name Platform
    [string]$configuration = Get-VstsInput -Name Configuration
    [bool]$clean = Get-VstsInput -Name Clean -AsBool
    [bool]$restoreNuGetPackages = Get-VstsInput -Name RestoreNuGetPackages -AsBool
    [bool]$logProjectEvents = Get-VstsInput -Name LogProjectEvents -AsBool
    [string]$msBuildVersion = Get-VstsInput -Name MSBuildVersion
    [string]$msBuildArchitecture = Get-VstsInput -Name MSBuildArchitecture
    . $PSScriptRoot\Select-MSBuildLocation.ps1
    Import-Module -Name $PSScriptRoot\ps_modules\MSBuildHelpers\MSBuildHelpers.psm1
    $solutionFiles = Get-SolutionFiles -Solution $solution
    $msBuildArguments = Format-MSBuildArguments -MSBuildArguments $msBuildArguments -Platform $platform -Configuration $configuration
    $msBuildLocation = Select-MSBuildLocation -Method $msBuildLocationMethod -Location $msBuildLocation -Version $msBuildVersion -Architecture $msBuildArchitecture
    $global:ErrorActionPreference = 'Continue'
    Invoke-BuildTools -NuGetRestore:$restoreNuGetPackages -SolutionFiles $solutionFiles -MSBuildLocation $msBuildLocation -MSBuildArguments $msBuildArguments -Clean:$clean -NoTimelineLogger:(!$logProjectEvents)
} finally {
    Trace-VstsLeavingInvocation $MyInvocation
}